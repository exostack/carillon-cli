/**
 * One sentence out of whatever the API answered.
 *
 * The internal API speaks RFC 9457 Problem Details, whose `detail` says what to
 * do next; Better Auth answers `{ message }`. Anything else falls back to a
 * plain sentence by status, so no failure ever surfaces as raw JSON.
 */
export function apiErrorMessage(status: number, body: unknown): string {
  if (body !== null && typeof body === 'object') {
    const { detail, message, title } = body as Record<string, unknown>

    for (const candidate of [detail, message, title]) {
      if (typeof candidate === 'string' && candidate.length > 0) return candidate
    }
  }

  if (status === 401) return NOT_SIGNED_IN
  if (status === 403) return 'Access denied. Check your organization role with an administrator.'
  if (status === 404) {
    return 'Not found. Check the identifier, and that `carillon use` points at the right organization and app.'
  }

  return `Request failed (HTTP ${status}). The API returned no error details.`
}

export const NOT_SIGNED_IN = 'Not signed in, or the session has expired. Run `carillon login`.'

/**
 * Thrown when the API answers 401: the stored token is missing, expired or
 * revoked. Typed so a caller can tell "sign in again" apart from "that
 * request was wrong" without matching on a sentence.
 */
export class NotSignedInError extends Error {
  constructor() {
    super(NOT_SIGNED_IN)
    this.name = 'NotSignedInError'
  }
}
