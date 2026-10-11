import { ENDPOINT, REQUESTED_MODEL } from '../../core/checks.js';
import type { Validation } from '../../core/result.js';
import { invalid, valid } from '../../core/result.js';
import { record, text } from '../../core/value.js';

export interface TypeSafeConfiguration {
  readonly apiKey: string;
  readonly baseURL: typeof ENDPOINT;
  readonly defaultModel: typeof REQUESTED_MODEL;
  readonly logLevel: 'off';
  readonly maxRetries: 0;
  readonly loggingOverrideIgnored: boolean;
}

/** Accept only a deliberately selected snapshot; never read environment variables. */
export function validateTypeSafeConfiguration(value: unknown): Validation<TypeSafeConfiguration> {
  try {
    const v = record(value, ['apiKey', 'baseURL', 'defaultModel', 'logLevel']);
    const selected: Record<string, string | undefined> = {};
    for (const field of ['apiKey', 'baseURL', 'defaultModel', 'logLevel']) {
      const entry = v[field];
      if (entry !== undefined && typeof entry !== 'string')
        return invalid('configuration_conflict', 'configuration');
      selected[field] = entry?.trim() || undefined;
    }
    if (!selected.apiKey) return invalid('missing_key', 'configuration');
    const apiKey = text(selected.apiKey);
    if (
      (selected.baseURL !== undefined && selected.baseURL !== ENDPOINT) ||
      (selected.defaultModel !== undefined && selected.defaultModel !== REQUESTED_MODEL)
    )
      return invalid('configuration_conflict', 'configuration');
    return valid(
      Object.freeze({
        apiKey,
        baseURL: ENDPOINT,
        defaultModel: REQUESTED_MODEL,
        logLevel: 'off',
        maxRetries: 0,
        loggingOverrideIgnored: selected.logLevel !== undefined && selected.logLevel !== 'off',
      }),
    );
  } catch {
    return invalid('configuration_conflict', 'configuration');
  }
}
