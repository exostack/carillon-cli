import { describe, expect, it } from 'vitest'

import { apiErrorMessage, NOT_SIGNED_IN } from './errors.js'

describe('apiErrorMessage', () => {
  it('prefers the problem detail, which says what to do next', () => {
    expect(
      apiErrorMessage(409, {
        title: 'Conflict',
        detail: 'A credential for apns already exists. Delete it first.',
      }),
    ).toBe('A credential for apns already exists. Delete it first.')
  })

  it('speaks Better Auth, whose refusals carry a message', () => {
    expect(apiErrorMessage(400, { message: 'Invalid email or password' })).toBe(
      'Invalid email or password',
    )
  })

  it('falls back to the problem title when there is no detail', () => {
    expect(apiErrorMessage(422, { title: 'Unprocessable' })).toBe('Unprocessable')
  })

  it('names the fix for a 401', () => {
    expect(apiErrorMessage(401, null)).toBe(NOT_SIGNED_IN)
    expect(apiErrorMessage(401, {})).toContain('carillon login')
  })

  it('says something plain for a body that says nothing', () => {
    expect(apiErrorMessage(500, null)).toBe(
      'Request failed (HTTP 500). The API returned no error details.',
    )
    expect(apiErrorMessage(503, { detail: 42 })).toContain('503')
  })
})
