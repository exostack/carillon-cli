import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export interface CliConfig {
  /** The public API — management routes, under /v1. */
  api_url?: string
  /** The dashboard host — Better Auth lives there, under /api/auth. */
  auth_url?: string
  organization_id?: string
  organization_name?: string
  app_id?: string
  app_name?: string
}

const DEFAULT_API_URL = 'https://api.carillon.dev'
const DEFAULT_AUTH_URL = 'https://app.carillon.dev'

export function configDir(): string {
  const base = process.env['XDG_CONFIG_HOME'] ?? join(homedir(), '.config')

  return join(base, 'carillon')
}

function readJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T
  } catch {
    return null
  }
}

export function readConfig(): CliConfig {
  const stored = readJson<CliConfig>(join(configDir(), 'config.json')) ?? {}

  // A config written before the CLI spoke two hosts holds a single api_url —
  // and it pointed at the dashboard host, because everything went through the
  // internal API then. That is what auth_url means now, so the old value moves
  // there and the public API falls back to its default.
  if (stored.api_url !== undefined && stored.auth_url === undefined) {
    const { api_url, ...rest } = stored

    return { ...rest, auth_url: api_url }
  }

  return stored
}

export function writeConfig(config: CliConfig): void {
  mkdirSync(configDir(), { recursive: true })
  writeFileSync(join(configDir(), 'config.json'), JSON.stringify(config, null, 2) + '\n')
}

export function apiUrl(): string {
  const chosen = process.env['CARILLON_API_URL'] ?? readConfig().api_url ?? DEFAULT_API_URL

  return chosen.replace(/\/+$/, '')
}

export function authUrl(): string {
  const chosen = process.env['CARILLON_AUTH_URL'] ?? readConfig().auth_url ?? DEFAULT_AUTH_URL

  return chosen.replace(/\/+$/, '')
}

export function readToken(): string | null {
  return readJson<{ token?: string }>(join(configDir(), 'credentials.json'))?.token ?? null
}

// The token opens the whole account, so the file is owner-only. The mode
// covers creation; the chmod covers a file a previous version left looser.
export function writeToken(token: string): void {
  mkdirSync(configDir(), { recursive: true })

  const path = join(configDir(), 'credentials.json')

  writeFileSync(path, JSON.stringify({ token }, null, 2) + '\n', { mode: 0o600 })
  chmodSync(path, 0o600)
}

export function clearToken(): void {
  rmSync(join(configDir(), 'credentials.json'), { force: true })
}
