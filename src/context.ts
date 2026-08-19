import { readConfig } from './config.js'
import { fail } from './output.js'

export interface Selected {
  readonly id: string
  readonly name: string
}

export function requireOrganization(): Selected {
  const config = readConfig()

  if (config.organization_id === undefined) {
    fail('No organization selected. Run `carillon use` first.')
  }

  return { id: config.organization_id, name: config.organization_name ?? config.organization_id }
}

export function requireApp(): Selected {
  const config = readConfig()

  if (config.app_id === undefined) {
    fail('No app selected. Run `carillon use` first.')
  }

  return { id: config.app_id, name: config.app_name ?? config.app_id }
}
