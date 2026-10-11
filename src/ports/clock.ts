export interface Clock {
  monotonicMs(): number;
  wallTimeMs(): number;
  /** Must not invoke synchronously; cancellation is idempotent. */
  schedule(delayMs: number, callback: () => void): () => void;
}
export type OperationStart = Readonly<{ monotonicMs: number; wallTimeMs: number }>;
