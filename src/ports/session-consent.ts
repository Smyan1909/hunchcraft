import type {
  AdmissionInput,
  FinalizationInput,
  FinalizationReceipt,
  Reservation,
  SessionRead,
} from '../core/consent.js';
import type { Validation } from '../core/result.js';
export type StoreControl = Readonly<{ signal: AbortSignal; remainingMs: () => number }>;
/** UUID-owned admission and finalization must fence unresolved writes; no count refunds. */
export interface SessionConsent {
  read(
    sessionId: string,
    control: StoreControl,
    requestId?: string,
  ): Promise<Validation<SessionRead>>;
  admit(input: AdmissionInput, control: StoreControl): Promise<Validation<Reservation>>;
  check(input: Reservation, control: StoreControl): Promise<Validation<SessionRead>>;
  finalize(
    input: FinalizationInput,
    control: StoreControl,
  ): Promise<Validation<FinalizationReceipt>>;
}
