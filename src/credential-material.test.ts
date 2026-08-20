import { describe, expect, it } from 'vitest'

import { apnsKeyIdFromFilename, parseFcmServiceAccount } from './credential-material.js'

describe('apnsKeyIdFromFilename', () => {
  it('reads the key id Apple put in the filename', () => {
    expect(apnsKeyIdFromFilename('./keys/AuthKey_ABC123DEFG.p8')).toBe('ABC123DEFG')
  })

  it('offers nothing for a file named some other way', () => {
    expect(apnsKeyIdFromFilename('./keys/apns.p8')).toBeUndefined()
    expect(apnsKeyIdFromFilename('AuthKey_abc.p8')).toBeUndefined()
  })
})

describe('parseFcmServiceAccount', () => {
  it('finds the Firebase project id', () => {
    expect(parseFcmServiceAccount('{"project_id":"acme-app"}')).toEqual({
      kind: 'ok',
      projectId: 'acme-app',
    })
  })

  it('tells JSON that is not JSON apart from JSON missing the id', () => {
    expect(parseFcmServiceAccount('not json').kind).toBe('not-json')
    expect(parseFcmServiceAccount('{"type":"service_account"}').kind).toBe('no-project-id')
    expect(parseFcmServiceAccount('{"project_id":""}').kind).toBe('no-project-id')
    expect(parseFcmServiceAccount('null').kind).toBe('no-project-id')
  })
})
