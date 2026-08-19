import { Command } from 'commander'
import pc from 'picocolors'

import { api, unwrap } from '../client.js'
import { requireOrganization } from '../context.js'
import { printJson, table } from '../output.js'

export const app = new Command('app').description('Apps of the current organization')

app
  .command('list')
  .description('List apps')
  .option('--json', 'machine-readable output')
  .action(async (options: { json?: boolean }) => {
    const organization = requireOrganization()
    const apps = await unwrap(
      api().GET('/v1/organizations/{organizationId}/apps', {
        params: { path: { organizationId: organization.id } },
      }),
    )

    if (options.json === true) return printJson(apps)
    if (apps.length === 0) {
      return console.log('No apps yet. Create one with `carillon app create <name>`.')
    }

    table([
      ['NAME', 'SLUG', 'ID', 'CREATED'],
      ...apps.map((entry) => [entry.name, entry.slug, entry.id, entry.created_at]),
    ])
  })

app
  .command('create <name>')
  .description('Create an app')
  .action(async (name: string) => {
    const organization = requireOrganization()
    const created = await unwrap(
      api().POST('/v1/organizations/{organizationId}/apps', {
        params: { path: { organizationId: organization.id } },
        body: { name },
      }),
    )

    console.log(`Created ${pc.bold(created.name)} (${created.id}).`)
    console.log(`It already holds a live mobile key — see \`carillon key list\`.`)
    console.log(`Next: ${pc.cyan('carillon use')} to make it the current app.`)
  })
