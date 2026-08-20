import { cancel, confirm, intro, outro, select, spinner, text } from '@clack/prompts'
import { Command } from 'commander'
import pc from 'picocolors'

import {
  type AudienceDefinition,
  type AudienceFilter,
  describeFilter,
  describeFilters,
  devices,
  FIELDS,
  parseDefinition,
  resolveAudience,
  withinDays,
} from '../audience.js'
import { api, unwrap } from '../client.js'
import { requireApp } from '../context.js'
import { answered, fail, printJson, table } from '../output.js'

export const audience = new Command('audience')
  .alias('audiences')
  .description('Saved audiences of the current app')

audience
  .command('list')
  .description('List audiences')
  .option('--json', 'machine-readable output')
  .action(async (options: { json?: boolean }) => {
    const app = requireApp()
    const { data } = await unwrap(
      api().GET('/v1/apps/{appId}/audiences', { params: { path: { appId: app.id } } }),
    )

    if (options.json === true) return printJson(data)
    if (data.length === 0) {
      return console.log('No audiences yet. Create one with `carillon audience create`.')
    }

    table([
      ['NAME', 'REACHES', 'ID', 'CREATED'],
      ...data.map((entry) => [
        entry.name,
        describeFilters(entry.definition.filters),
        entry.id,
        entry.created_at,
      ]),
    ])
  })

audience
  .command('create')
  .description('Save an audience, built filter by filter')
  .action(async () => {
    const app = requireApp()

    intro(pc.bold('carillon audience create'))

    const name = answered(
      await text({
        message: 'Name',
        placeholder: 'Lapsed iOS',
        validate: (value) =>
          value !== undefined && value.trim().length > 0 ? undefined : 'A name, unique in the app.',
      }),
    ).trim()

    const filters = await buildFilters(app.id)

    const confirmed = answered(
      await confirm({ message: `Save "${name}", reaching ${describeFilters(filters)}?` }),
    )

    if (!confirmed) {
      cancel('Nothing was saved.')
      process.exit(1)
    }

    let created

    try {
      created = await unwrap(
        api().POST('/v1/apps/{appId}/audiences', {
          params: { path: { appId: app.id } },
          body: { name, definition: { filters } },
        }),
      )
    } catch (error) {
      // A name already taken is the refusal to expect here, and the API's own
      // sentence names both ways out of it.
      cancel(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }

    outro(
      `Saved ${pc.bold(created.name)}. Campaigns reach it with ` +
        `${pc.cyan(`"audience": { "audience_id": "${created.id}" }`)}.`,
    )
  })

audience
  .command('preview')
  .description('Count the devices a definition would reach, without saving anything')
  .option('--json <definition>', 'the definition, as JSON — skips the builder')
  .action(async (options: { json?: string }) => {
    const app = requireApp()

    if (options.json !== undefined) {
      const parsed = parseDefinition(options.json)

      if (parsed.kind === 'error') fail(parsed.reason)

      return printJson(await preview(app.id, parsed.definition))
    }

    intro(pc.bold('carillon audience preview'))

    const filters = await buildFilters(app.id)
    const { reachable } = await preview(app.id, { filters })

    outro(`${devices(reachable)} — ${describeFilters(filters)}.`)
  })

audience
  .command('delete <name-or-id>')
  .description('Delete a saved audience, by name or by id')
  .option('--yes', 'delete without asking')
  .action(async (nameOrId: string, options: { yes?: boolean }) => {
    const app = requireApp()
    const { data } = await unwrap(
      api().GET('/v1/apps/{appId}/audiences', { params: { path: { appId: app.id } } }),
    )
    const audience = resolveAudience(data, nameOrId)

    if (audience === undefined) {
      fail(`No audience called ${nameOrId} in ${app.name}. \`carillon audience list\` has them.`)
    }

    if (options.yes !== true) {
      const confirmed = answered(
        await confirm({
          message: `Delete "${audience.name}", reaching ${describeFilters(audience.definition.filters)}?`,
        }),
      )

      if (!confirmed) {
        cancel('Nothing was deleted.')
        process.exit(1)
      }
    }

    await unwrap(
      api().DELETE('/v1/apps/{appId}/audiences/{audienceId}', {
        params: { path: { appId: app.id, audienceId: audience.id } },
      }),
    )

    console.log(
      `Deleted ${audience.name}. Campaigns already sent to it are untouched: each one ` +
        'carries its own copy of the filters it was written against.',
    )
  })

async function preview(appId: string, definition: AudienceDefinition) {
  return unwrap(
    api().POST('/v1/apps/{appId}/audiences/preview', {
      params: { path: { appId } },
      body: { definition },
    }),
  )
}

/**
 * The builder both `create` and `preview` run: filters in, filters out, and the
 * count asked again after every change — a filter only ever narrows, so seeing
 * the audience shrink is how one knows the filter did what was meant.
 */
async function buildFilters(appId: string): Promise<AudienceFilter[]> {
  const filters: AudienceFilter[] = []

  let reachable = await count(appId, filters)

  for (;;) {
    const last = filters[filters.length - 1]
    const action = answered(
      await select({
        message: 'Audience',
        options: [
          { value: 'add', label: 'Add a filter' },
          ...(last === undefined
            ? []
            : [
                {
                  value: 'remove',
                  label: 'Remove the last filter',
                  hint: describeFilter(last),
                },
              ]),
          { value: 'done', label: 'Done', hint: devices(reachable) },
        ],
      }),
    )

    if (action === 'done') return filters

    if (action === 'remove') {
      filters.pop()
    } else {
      filters.push(await askFilter())
    }

    reachable = await count(appId, filters)
  }
}

async function count(appId: string, filters: readonly AudienceFilter[]): Promise<number> {
  const loading = spinner()

  loading.start('Counting devices')

  const { reachable } = await preview(appId, { filters: [...filters] })

  loading.stop(`${devices(reachable)} — ${describeFilters(filters)}`)

  return reachable
}

async function askFilter(): Promise<AudienceFilter> {
  const spec = answered(
    await select({
      message: 'Filter on',
      options: FIELDS.map((field) => ({ value: field, label: field.label, hint: field.hint })),
    }),
  )

  switch (spec.prompt.kind) {
    case 'choice': {
      const value = answered(
        await select({ message: spec.label, options: [...spec.prompt.choices] }),
      )

      return { field: spec.field, value } as AudienceFilter
    }
    case 'text': {
      const value = answered(
        await text({
          message: spec.label,
          placeholder: spec.prompt.placeholder,
          validate: (value) =>
            value !== undefined && value.trim().length > 0 ? undefined : 'A value to match.',
        }),
      ).trim()

      return { field: spec.field, value } as AudienceFilter
    }
    case 'days': {
      const answer = answered(
        await text({
          message: 'Seen within how many days',
          placeholder: '30',
          validate: (value) =>
            value !== undefined && withinDays(value) !== undefined
              ? undefined
              : 'A whole number of days, 1 to 365.',
        }),
      )

      return { field: 'last_active', within_days: withinDays(answer) as number }
    }
    case 'tag': {
      const key = answered(
        await text({
          message: 'Tag key',
          placeholder: 'plan',
          validate: (value) =>
            value !== undefined && value.trim().length > 0 ? undefined : 'The key of the tag.',
        }),
      ).trim()
      const value = answered(
        await text({
          message: 'Tag value',
          placeholder: 'pro',
          validate: (value) =>
            value !== undefined && value.trim().length > 0 ? undefined : 'The value it carries.',
        }),
      ).trim()

      return { field: 'tag', key, value }
    }
  }
}
