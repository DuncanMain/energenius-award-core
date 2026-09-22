import { ServiceUnavailableException } from '@nestjs/common';

export const BLOCKCHAIN_PROVIDER_UNAVAILABLE =
  'BLOCKCHAIN_PROVIDER_UNAVAILABLE';
export const RPC_MAX_ATTEMPTS = 3;
export const RPC_RETRY_DELAYS_MS = [50, 100] as const;

type UnknownRecord = Record<string, unknown>;

export interface RpcDiagnostic {
  message: string;
  traceId: string | null;
  providerCode: string | number | null;
  httpStatus: number | null;
}

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null
    ? (value as UnknownRecord)
    : null;
}

function nestedValues(error: unknown, key: string): unknown[] {
  const values: unknown[] = [];
  const visited = new Set<unknown>();

  const visit = (value: unknown, depth: number) => {
    if (depth > 4 || value === null || value === undefined) return;
    if (typeof value === 'object') {
      if (visited.has(value)) return;
      visited.add(value);
    }
    const record = asRecord(value);
    if (!record) return;
    if (key in record) values.push(record[key]);
    for (const childKey of [
      'error',
      'info',
      'response',
      'body',
      'data',
      'cause',
    ]) {
      visit(record[childKey], depth + 1);
    }
  };

  visit(error, 0);
  return values;
}

function stringValues(error: unknown): string[] {
  const values: string[] = [];
  for (const key of ['message', 'shortMessage', 'reason', 'details']) {
    for (const value of nestedValues(error, key)) {
      if (typeof value === 'string' && value.trim()) values.push(value.trim());
    }
  }
  if (error instanceof Error && error.message.trim())
    values.push(error.message);
  return Array.from(new Set(values));
}

function firstCode(error: unknown): string | number | null {
  for (const value of nestedValues(error, 'code')) {
    if (typeof value === 'string' || typeof value === 'number') return value;
  }
  return null;
}

function firstHttpStatus(error: unknown): number | null {
  let firstStatus: number | null = null;
  for (const key of ['status', 'statusCode', 'httpStatus', 'responseStatus']) {
    for (const value of nestedValues(error, key)) {
      const status =
        typeof value === 'number'
          ? value
          : typeof value === 'string' && /^\d{3}(?:\s|$)/.test(value)
            ? Number(value.slice(0, 3))
            : null;
      if (status !== null) {
        firstStatus ??= status;
        if (status >= 500 && status <= 599) return status;
      }
    }
  }
  return firstStatus;
}

function firstTraceId(error: unknown, messages: string[]): string | null {
  const directValues = [
    ...nestedValues(error, 'traceId'),
    ...nestedValues(error, 'trace_id'),
  ].filter((value): value is string => typeof value === 'string');
  const direct = directValues.find(value => value.trim());
  if (direct) return direct.trim().slice(0, 128);

  for (const value of messages) {
    const match = value.match(/trace[-_ ]?id\s*[:=]\s*([A-Za-z0-9._:-]+)/i);
    if (match?.[1]) return match[1].slice(0, 128);
  }
  return null;
}

function providerMessage(error: unknown): string {
  return stringValues(error).join(' ');
}

const DETERMINISTIC_CODES = new Set([
  'CALL_EXCEPTION',
  'INSUFFICIENT_FUNDS',
  'NONCE_EXPIRED',
  'INVALID_ARGUMENT',
  'INVALID_PARAMS',
  'VALUE_MISMATCH',
  'BAD_DATA',
  'ACTION_REJECTED',
  'UNPREDICTABLE_GAS_LIMIT',
  'UNSUPPORTED_OPERATION',
  -32600,
  -32601,
  -32602,
]);

const DETERMINISTIC_MESSAGE =
  /execution reverted|contract revert|reverted|insufficient funds|nonce|invalid argument|invalid parameter|invalid params|invalid request|method not found|unsupported operation|user rejected|already known|replacement transaction underpriced|intrinsic gas too low|gas required exceeds allowance|invalid opcode|validation failed/i;

/**
 * Return true only for errors which are safe to retry at the RPC boundary.
 * Contract and request errors deliberately win over a generic SERVER_ERROR/status.
 */
export function isTransientRpcError(error: unknown): boolean {
  if (error instanceof TransientRpcError) return true;
  const codes = nestedValues(error, 'code').filter(
    (value): value is string | number =>
      typeof value === 'string' || typeof value === 'number'
  );
  const code = codes[0] ?? null;
  const message = providerMessage(error);

  if (
    codes.some(value =>
      DETERMINISTIC_CODES.has(
        typeof value === 'string' ? value.toUpperCase() : value
      )
    ) ||
    DETERMINISTIC_MESSAGE.test(message)
  ) {
    return false;
  }

  const status = firstHttpStatus(error);
  if (status !== null && status >= 500 && status <= 599) return true;
  if (
    codes.some(value =>
      typeof value === 'string'
        ? ['SERVER_ERROR', 'TIMEOUT', 'NETWORK_ERROR'].includes(
            value.toUpperCase()
          ) || value === '19'
        : value === 19
    )
  ) {
    return true;
  }
  if (/temporary internal error/i.test(message)) return true;

  return /ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|UND_ERR_CONNECT_TIMEOUT|socket hang up|network error|fetch failed|request timed out|timeout|temporarily unavailable/i.test(
    `${String(code ?? '')} ${message}`
  );
}

function safeDiagnostic(error: unknown): RpcDiagnostic {
  const messages = stringValues(error);
  const message = messages.join(' ');
  const code = firstCode(error);
  const status = firstHttpStatus(error);
  const traceId = firstTraceId(error, messages);

  let category = 'Blockchain RPC provider unavailable';
  if (
    /temporary internal error/i.test(message) ||
    code === 19 ||
    code === '19'
  ) {
    category = 'Temporary blockchain provider error';
  } else if (status !== null && status >= 500 && status <= 599) {
    category = `Blockchain RPC provider returned HTTP ${status}`;
  } else if (String(code).toUpperCase() === 'SERVER_ERROR') {
    category = 'Blockchain RPC server error';
  } else if (
    /ECONN|ETIMEDOUT|EAI_AGAIN|network|socket|fetch failed/i.test(message)
  ) {
    category = 'Blockchain RPC network error';
  }

  return {
    message: `${category}${traceId ? ` (trace-id: ${traceId})` : ''}`,
    traceId,
    providerCode: code,
    httpStatus: status,
  };
}

export class TransientRpcError extends ServiceUnavailableException {
  readonly code = BLOCKCHAIN_PROVIDER_UNAVAILABLE;
  readonly operation: string;
  readonly diagnostic: RpcDiagnostic;
  readonly traceId: string | null;
  readonly causeError: unknown;

  constructor(
    diagnostic: RpcDiagnostic,
    operation = 'rpc',
    causeError?: unknown
  ) {
    super(`${BLOCKCHAIN_PROVIDER_UNAVAILABLE}: ${diagnostic.message}`);
    this.name = 'TransientRpcError';
    this.message = diagnostic.message;
    this.operation = operation;
    this.diagnostic = diagnostic;
    this.traceId = diagnostic.traceId;
    this.causeError = causeError;
  }
}

/** A write-path variant makes the intent clear to callers and logs. */
export class BlockchainProviderUnavailableException extends TransientRpcError {
  constructor(
    source: TransientRpcError | unknown,
    operation = source instanceof TransientRpcError ? source.operation : 'rpc'
  ) {
    const transient =
      source instanceof TransientRpcError
        ? source
        : toTransientRpcError(source, operation);
    const diagnostic = transient?.diagnostic ?? safeDiagnostic(source);
    super(diagnostic, operation, source);
    this.name = 'BlockchainProviderUnavailableException';
  }
}

export function toTransientRpcError(
  error: unknown,
  operation = 'rpc'
): TransientRpcError | null {
  if (error instanceof BlockchainProviderUnavailableException) return error;
  if (error instanceof TransientRpcError) return error;
  return isTransientRpcError(error)
    ? new TransientRpcError(safeDiagnostic(error), operation, error)
    : null;
}

export function toBlockchainProviderUnavailable(
  error: unknown,
  operation = 'rpc'
): BlockchainProviderUnavailableException | null {
  if (error instanceof BlockchainProviderUnavailableException) return error;
  const transient = toTransientRpcError(error, operation);
  return transient
    ? new BlockchainProviderUnavailableException(transient, operation)
    : null;
}

export function getRpcDiagnostic(error: unknown): RpcDiagnostic {
  if (error instanceof TransientRpcError) return error.diagnostic;
  return safeDiagnostic(error);
}

export interface RpcRetryOptions {
  maxAttempts?: number;
  delaysMs?: readonly number[];
  sleep?: (milliseconds: number) => Promise<void>;
}

const defaultSleep = (milliseconds: number) =>
  new Promise<void>(resolve => setTimeout(resolve, milliseconds));

/** Execute one read-only RPC operation with at most three bounded attempts. */
export async function withRpcRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  options: RpcRetryOptions = {}
): Promise<T> {
  const maxAttempts = Math.min(
    RPC_MAX_ATTEMPTS,
    Math.max(1, options.maxAttempts ?? RPC_MAX_ATTEMPTS)
  );
  const delays = options.delaysMs ?? RPC_RETRY_DELAYS_MS;
  const sleep = options.sleep ?? defaultSleep;
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      return await operation();
    } catch (error) {
      const transient = toTransientRpcError(error, operationName);
      if (!transient || attempt >= maxAttempts) throw transient ?? error;
      await sleep(delays[Math.min(attempt - 1, delays.length - 1)] ?? 0);
    }
  }

  throw new Error(`RPC operation ${operationName} did not run`);
}
