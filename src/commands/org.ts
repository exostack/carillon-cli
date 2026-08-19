import { Command } from 'commander'
import pc from 'picocolors'

import { authCall, type Organization } from '../client.js'
import { requireOrganization } from '../context.js'
import { fail, printJson, table } from '../output.js'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const org = new Command('org').description('Organizations')

org
  .command('list')
  .description('List the organizations this account belongs to')
  .option('--json', 'machine-readable output')
  .action(async (options: { json?: boolean }) => {
    const organizations = (await authCall<Organization[]>('/organization/list')) ?? []

    if (options.json === true) return printJson(organizations)
    if (organizations.length === 0) {
      return console.log('No organizations yet. Create one with `carillon org create <name>`.')
    }

    table([
      ['NAME', 'SLUG', 'ID'],
      ...organizations.map((entry) => [entry.name, entry.slug, entry.id]),
    ])
  })

org
  .command('create <name>')
  .description('Create an organization')
  .action(async (name: string) => {
    const slug = slugify(name)

    if (slug.length === 0) fail('That name leaves nothing to build a slug from.')

    const created = await authCall<Organization>('/organization/create', {
      method: 'POST',
      body: { name, slug },
    })

    if (created === null) fail('The server created nothing and said nothing.')

    console.log(`Created ${pc.bold(created.name)} (${created.id}).`)
    console.log(`Next: ${pc.cyan('carillon use')} to work in it.`)
  })

org
  .command('invite <email>')
  .description('Invite someone into the current organization')
  .option('--role <role>', 'admin or member', 'member')
  .action(async (email: string, options: { role: string }) => {
    if (!['admin', 'member'].includes(options.role)) {
      fail('The role is either `admin` or `member`.')
    }

    const organization = requireOrganization()

    await authCall('/organization/invite-member', {
      method: 'POST',
      body: { organizationId: organization.id, email, role: options.role },
    })

    console.log(`Invited ${email} to ${organization.name} as ${options.role}.`)
    console.log('They will receive an email with a link to accept.')
  })
