import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ChainService } from './chain.service';
import {
  BlockchainProviderUnavailableException,
  TransientRpcError,
  withRpcRetry,
} from './rpc.errors';

describe('ChainService', () => {
  let service: ChainService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChainService,
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get<ChainService>(ChainService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('applies the shared retry policy to a read-only contract call', async () => {
    const balanceOf = jest
      .fn()
      .mockRejectedValueOnce({ status: 503, message: 'RPC unavailable' })
      .mockResolvedValue(123n);
    (service as any).encoin = { balanceOf };

    await expect(service.balanceOf('0xabc')).resolves.toBe(123n);
    expect(balanceOf).toHaveBeenCalledTimes(2);
  });

  it('retries a transient dRPC error and returns the eventual read result', async () => {
    const operation = jest.fn() as jest.Mock<Promise<string>, []>;
    operation
      .mockRejectedValueOnce({
        code: 19,
        message: 'Temporary internal error. Please retry, trace-id: amoy-123',
      })
      .mockResolvedValue('0xresult');
    const sleep = jest.fn().mockResolvedValue(undefined);

    await expect(withRpcRetry(operation, 'getCode', { sleep })).resolves.toBe(
      '0xresult'
    );
    expect(operation).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(50);
  });

  it('exhausts transient retries and keeps the safe trace-id diagnostic', async () => {
    const operation = (
      jest.fn() as jest.Mock<Promise<never>, []>
    ).mockRejectedValue({
      status: 500,
      message: 'Temporary internal error. Please retry, trace-id: amoy-456',
    });

    const error = await withRpcRetry(operation, 'balanceOf', {
      sleep: jest.fn().mockResolvedValue(undefined),
    }).catch(value => value);

    expect(error).toBeInstanceOf(TransientRpcError);
    expect((error as Error).message).toContain('trace-id: amoy-456');
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('does not retry deterministic contract errors', async () => {
    const error = Object.assign(new Error('execution reverted: paused'), {
      code: 'CALL_EXCEPTION',
    });
    const operation = (
      jest.fn() as jest.Mock<Promise<never>, []>
    ).mockRejectedValue(error);

    await expect(
      withRpcRetry(operation, 'paused', {
        sleep: jest.fn().mockResolvedValue(undefined),
      })
    ).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('does not retry a transient write broadcast and maps it to HTTP 503', async () => {
    const write = jest.fn().mockRejectedValue({
      code: 'SERVER_ERROR',
      message: 'Temporary internal error, trace-id: write-789',
    });
    (service as any).encoin = { award: write };

    const result = service.submitAward('0xabc', 1n);
    await expect(result).rejects.toBeInstanceOf(
      BlockchainProviderUnavailableException
    );
    await expect(result).rejects.toMatchObject({
      code: 'BLOCKCHAIN_PROVIDER_UNAVAILABLE',
      traceId: 'write-789',
      status: 503,
    });
    expect(write).toHaveBeenCalledTimes(1);
  });
});
