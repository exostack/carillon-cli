import { request as insecureRequest } from 'node:http'
import { request as secureRequest } from 'node:https'

import createClient from 'openapi-fetch'

import { apiUrl, authUrl, readToken } from './config.js'
import { apiErrorMessage, NotSignedInError } from './errors.js'
import type { paths } from './generated/api.js'

function bearer(): Record<string, string> {
  const token = readToken()

  return token === null ? {} : { authorization: `Bearer ${token}` }
}

export function api() {
  return createClient<paths>({ baseUrl: apiUrl(), headers: bearer() })
}

interface FetchResult<T> {
  data?: T
  error?: unknown
  response: Response
}

/** Resolves the data or throws with the API's own sentence — never both. */
export async function unwrap<T>(request: Promise<FetchResult<T>>): Promise<T> {
  let result: FetchResult<T>

  try {
    result = await request
  } catch (cause) {
    throw new Error(unreachable(cause, apiUrl()), { cause })
  }

  if (result.response.status === 401) throw new NotSignedInError()
  if (!result.response.ok) throw new Error(apiErrorMessage(result.response.status, result.error))

  return result.data as T
}

export interface AuthResponse {
  readonly status: number
  readonly ok: boolean
  header(name: string): string | null
}

/**
 * Better Auth owns everything under /api/auth on the DASHBOARD host — account
 * and organization operations never left it — and is not in the OpenAPI spec,
 * so those endpoints are called directly — over node:http rather than fetch,
 * deliberately. Undici stamps `sec-fetch-mode` on every request and refuses to
 * let it go, which makes Better Auth's CSRF gate demand a browser Origin a
 * terminal does not have. A bare request carries neither header, and is the
 * non-browser client that gate already lets through.
 */
export async function authRequest<T>(
  path: string,
  init?: { method?: 'GET' | 'POST'; body?: unknown },
): Promise<{ body: T | null; response: AuthResponse }> {
  const target = new URL(`${authUrl()}/api/auth${path}`)
  const transport = target.protocol === 'https:' ? secureRequest : insecureRequest
  const payload = init?.body === undefined ? null : JSON.stringify(init.body)

  return new Promise((resolve, reject) => {
    const request = transport(
      target,
      {
        method: init?.method ?? 'GET',
        headers: {
          'content-type': 'application/json',
          ...(payload === null ? {} : { 'content-length': Buffer.byteLength(payload) }),
          ...bearer(),
        },
      },
      (response) => {
        const chunks: Buffer[] = []

        response.on('data', (chunk: Buffer) => chunks.push(chunk))
        response.on('end', () => {
          const status = response.statusCode ?? 0

          let body: T | null

          try {
            body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as T
          } catch {
            body = null
          }

          resolve({
            body,
            response: {
              status,
              ok: status >= 200 && status < 300,
              header: (name) => {
                const value = response.headers[name.toLowerCase()]

                return typeof value === 'string' ? value : (value?.[0] ?? null)
              },
            },
          })
        })
      },
    )

    request.on('error', (cause) => reject(new Error(unreachable(cause, authUrl()), { cause })))

    if (payload !== null) request.write(payload)
    request.end()
  })
}

/** The same call, for the callers that have nothing to add to a refusal. */
export async function authCall<T>(
  path: string,
  init?: { method?: 'GET' | 'POST'; body?: unknown },
): Promise<T | null> {
  const { body, response } = await authRequest<T>(path, init)

  if (response.status === 401) throw new NotSignedInError()
  if (!response.ok) throw new Error(apiErrorMessage(response.status, body))

  return body
}

function unreachable(cause: unknown, base: string): string {
  const reason =
    cause instanceof Error
      ? cause.cause instanceof Error
        ? cause.cause.message
        : cause.message
      : String(cause)

  return (
    `Could not reach ${base} (${reason}). Is it up, and the CLI pointed at the ` +
    'right hosts (CARILLON_API_URL for the API, CARILLON_AUTH_URL for sign-in)?'
  )
}

export interface Organization {
  id: string
  name: string
  slug: string
}

export interface Session {
  user: { id: string; name: string; email: string }
}
