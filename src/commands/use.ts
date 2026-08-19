import { intro, log, outro, select, spinner } from '@clack/prompts'
import { Command } from 'commander'
import pc from 'picocolors'

import { api, authCall, type Organization, unwrap } from '../client.js'
import { readConfig, writeConfig } from '../config.js'
import { answered } from '../output.js'

export const use = new Command('use')
  .description('Pick the organization and app the other commands work in')
  .action(async () => {
    intro(pc.bold('carillon use'))

    const loading = spinner()

    loading.start('Loading organizations')

    const organizations = (await authCall<Organization[]>('/organization/list')) ?? []

    loading.stop(`${organizations.length} organization(s)`)

    if (organizations.length === 0) {
      outro('This account belongs to no organization. Create one with `carillon org create`.')
      process.exit(1)
    }

    const organization =
      organizations.length === 1
        ? organizations[0]!
        : pick(
            organizations,
            answered(
              await select({
                message: 'Organization',
                options: organizations.map((entry) => ({
                  value: entry.id,
                  label: entry.name,
                  hint: entry.slug,
                })),
              }),
            ),
          )

    if (organizations.length === 1) log.info(`Organization: ${organization.name}`)

    const apps = await unwrap(
      api().GET('/v1/organizations/{organizationId}/apps', {
        params: { path: { organizationId: organization.id } },
      }),
    )

    const previous = readConfig()

    if (apps.length === 0) {
      writeConfig({
        ...(previous.api_url === undefined ? {} : { api_url: previous.api_url }),
        ...(previous.auth_url === undefined ? {} : { auth_url: previous.auth_url }),
        organization_id: organization.id,
        organization_name: organization.name,
      })
      outro(`Using ${organization.name}. No apps yet — create one with \`carillon app create\`.`)

      return
    }

    const app =
      apps.length === 1
        ? apps[0]!
        : pick(
            apps,
            answered(
              await select({
                message: 'App',
                options: apps.map((entry) => ({ value: entry.id, label: entry.name })),
              }),
            ),
          )

    if (apps.length === 1) log.info(`App: ${app.name}`)

    writeConfig({
      ...(previous.api_url === undefined ? {} : { api_url: previous.api_url }),
      ...(previous.auth_url === undefined ? {} : { auth_url: previous.auth_url }),
      organization_id: organization.id,
      organization_name: organization.name,
      app_id: app.id,
      app_name: app.name,
    })

    outro(`Using ${pc.bold(organization.name)} / ${pc.bold(app.name)}.`)
  })

function pick<T extends { id: string }>(entries: readonly T[], id: string): T {
  return entries.find((entry) => entry.id === id) as T
}
