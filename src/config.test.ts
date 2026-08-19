import { mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  apiUrl,
  authUrl,
  clearToken,
  configDir,
  readConfig,
  readToken,
  writeConfig,
  writeToken,
} from './config.js'

let home: string

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'carillon-cli-'))
  process.env['XDG_CONFIG_HOME'] = home
  delete process.env['CARILLON_API_URL']
  delete process.env['CARILLON_AUTH_URL']
})

afterEach(() => {
  rmSync(home, { recursive: true, force: true })
  delete process.env['XDG_CONFIG_HOME']
})

describe('the config file', () => {
  it('reads back what was written', () => {
    writeConfig({ organization_id: 'org-1', organization_name: 'Acme' })

    expect(readConfig()).toEqual({ organization_id: 'org-1', organization_name: 'Acme' })
  })

  it('is empty rather than broken when absent or corrupt', () => {
    expect(readConfig()).toEqual({})
  })
})

describe('the API URL', () => {
  it('defaults to the public API host', () => {
    expect(apiUrl()).toBe('https://api.carillon.dev')
  })

  it('is overridden by the environment, trailing slash dropped', () => {
    process.env['CARILLON_API_URL'] = 'http://localhost:28080/'

    expect(apiUrl()).toBe('http://localhost:28080')
  })

  it('falls back to the configured URL before the default', () => {
    writeConfig({ api_url: 'https://api-staging.carillon.dev', auth_url: 'kept' })

    expect(apiUrl()).toBe('https://api-staging.carillon.dev')
  })
})

describe('the auth URL', () => {
  it('defaults to the dashboard host', () => {
    expect(authUrl()).toBe('https://app.carillon.dev')
  })

  it('is overridden by the environment, trailing slash dropped', () => {
    process.env['CARILLON_AUTH_URL'] = 'http://localhost:28081/'

    expect(authUrl()).toBe('http://localhost:28081')
  })

  it('falls back to the configured URL before the default', () => {
    writeConfig({ auth_url: 'https://app-staging.carillon.dev' })

    expect(authUrl()).toBe('https://app-staging.carillon.dev')
  })
})

describe('migrating a single-URL config', () => {
  it('reads an old api_url as the auth host it pointed at', () => {
    // Before the CLI spoke two hosts, everything went through the internal
    // API on the dashboard host — so a stored api_url from that era means
    // auth_url now, and the public API falls back to its default.
    writeConfig({ api_url: 'https://app-staging.carillon.dev', organization_id: 'org-1' })

    expect(readConfig()).toEqual({
      auth_url: 'https://app-staging.carillon.dev',
      organization_id: 'org-1',
    })
    expect(authUrl()).toBe('https://app-staging.carillon.dev')
    expect(apiUrl()).toBe('https://api.carillon.dev')
  })

  it('leaves a config that already names both hosts alone', () => {
    writeConfig({ api_url: 'https://one.test', auth_url: 'https://two.test' })

    expect(readConfig()).toEqual({ api_url: 'https://one.test', auth_url: 'https://two.test' })
  })
})

describe('the token file', () => {
  it('round-trips, and is readable by its owner alone', () => {
    writeToken('a-bearer-token')

    expect(readToken()).toBe('a-bearer-token')
    expect(statSync(join(configDir(), 'credentials.json')).mode & 0o777).toBe(0o600)
  })

  it('is null when absent, and gone after clearing', () => {
    expect(readToken()).toBe(null)

    writeToken('a-bearer-token')
    clearToken()

    expect(readToken()).toBe(null)
  })
})
