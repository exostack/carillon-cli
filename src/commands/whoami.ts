import { Command } from 'commander'

import { authCall, type Session } from '../client.js'
import { apiUrl, authUrl, readConfig } from '../config.js'
import { NOT_SIGNED_IN } from '../errors.js'
import { fail, printJson, table } from '../output.js'

export const whoami = new Command('whoami')
  .description('Show who is signed in, and the current context')
  .option('--json', 'machine-readable output')
  .action(async (options: { json?: boolean }) => {
    const session = await authCall<Session>('/get-session')

    if (session === null) fail(NOT_SIGNED_IN)

    const config = readConfig()

    if (options.json === true) {
      printJson({
        user: session.user,
        api_url: apiUrl(),
        auth_url: authUrl(),
        organization: config.organization_id
          ? { id: config.organization_id, name: config.organization_name ?? null }
          : null,
        app: config.app_id ? { id: config.app_id, name: config.app_name ?? null } : null,
      })

      return
    }

    table([
      ['Signed in as', `${session.user.name} <${session.user.email}>`],
      ['API', apiUrl()],
      ['Auth', authUrl()],
      [
        'Organization',
        config.organization_name ?? config.organization_id ?? '(none — run `carillon use`)',
      ],
      ['App', config.app_name ?? config.app_id ?? '(none — run `carillon use`)'],
    ])
  })
