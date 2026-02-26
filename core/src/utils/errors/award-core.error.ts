export class AwardCoreError extends Error {
  constructor(
    public code:
      | 'VALIDATION_ERROR'
      | 'UNKNOWN_ACTION'
      | 'MAXCOUNT_EXCEEDED'
      | 'INSUFFICIENT_BALANCE'
      | 'INTERNAL_ERROR',
    message: string
  ) {
    super(message);
    this.name = 'AwardCoreError';
  }
}
