import type { components } from './generated/api.js'

export type AudienceFilter = components['schemas']['SavedAudienceFilter']
export type AudienceDefinition = components['schemas']['SavedAudienceDefinition']
export type SavedAudience = components['schemas']['SavedAudience']

type FieldName = AudienceFilter['field']

export type FieldPrompt =
  | { readonly kind: 'choice'; readonly choices: readonly { value: string; label: string }[] }
  | { readonly kind: 'text'; readonly placeholder: string }
  | { readonly kind: 'days' }
  | { readonly kind: 'tag' }

export interface FieldSpec {
  readonly field: FieldName
  readonly label: string
  readonly hint: string
  readonly prompt: FieldPrompt
}

/** The fields an audience filters on, in the order the builder offers them. */
export const FIELDS: readonly FieldSpec[] = [
  {
    field: 'platform',
    label: 'Platform',
    hint: 'iOS or Android',
    prompt: {
      kind: 'choice',
      choices: [
        { value: 'ios', label: 'iOS' },
        { value: 'android', label: 'Android' },
      ],
    },
  },
  {
    field: 'push_permission',
    label: 'Push permission',
    hint: 'current OS notification permission reported by the device',
    prompt: {
      kind: 'choice',
      choices: [
        { value: 'allowed', label: 'Allowed' },
        { value: 'denied', label: 'Denied' },
        { value: 'provisional', label: 'Provisional' },
        { value: 'undetermined', label: 'Undetermined' },
      ],
    },
  },
  {
    field: 'source',
    label: 'Source',
    hint: 'registered by an SDK, or loaded by an import',
    prompt: {
      kind: 'choice',
      choices: [
        { value: 'sdk', label: 'SDK' },
        { value: 'import', label: 'Import' },
      ],
    },
  },
  {
    field: 'locale',
    label: 'Locale',
    hint: 'the BCP 47 tag the device reported, compared exactly',
    prompt: { kind: 'text', placeholder: 'fr-FR' },
  },
  {
    field: 'timezone_id',
    label: 'Timezone',
    hint: 'an IANA identifier, never an offset',
    prompt: { kind: 'text', placeholder: 'Europe/Paris' },
  },
  {
    field: 'app_version',
    label: 'App version',
    hint: 'the version the device reported',
    prompt: { kind: 'text', placeholder: '3.2.1' },
  },
  {
    field: 'app_build',
    label: 'App build',
    hint: 'the build the device reported',
    prompt: { kind: 'text', placeholder: '4821' },
  },
  {
    field: 'os_version',
    label: 'OS version',
    hint: 'the operating system version the device reported',
    prompt: { kind: 'text', placeholder: '18.2' },
  },
  {
    field: 'last_active',
    label: 'Last active',
    hint: 'days since last activity, evaluated at send time',
    prompt: { kind: 'days' },
  },
  {
    field: 'tag',
    label: 'Tag',
    hint: 'device tag key and value',
    prompt: { kind: 'tag' },
  },
]

function fieldSpec(field: string): FieldSpec | undefined {
  return FIELDS.find((candidate) => candidate.field === field)
}

export function devices(count: number): string {
  return `${count} device${count === 1 ? '' : 's'}`
}

export function describeFilter(filter: AudienceFilter): string {
  switch (filter.field) {
    case 'platform':
      return filter.value === 'ios' ? 'iOS' : 'Android'
    case 'push_permission':
      return `push ${filter.value}`
    case 'source':
      return filter.value === 'sdk' ? 'registered by an SDK' : 'loaded by an import'
    case 'locale':
      return `locale ${filter.value}`
    case 'timezone_id':
      return `timezone ${filter.value}`
    case 'app_version':
      return `app version ${filter.value}`
    case 'app_build':
      return `app build ${filter.value}`
    case 'os_version':
      return `OS version ${filter.value}`
    case 'last_active':
      return `active in the last ${filter.within_days} day${filter.within_days === 1 ? '' : 's'}`
    case 'tag':
      return `tag ${filter.key}=${filter.value}`
  }
}

/** Filters narrow together, so the summary reads as one sentence of conditions. */
export function describeFilters(filters: readonly AudienceFilter[]): string {
  return filters.length === 0 ? 'everyone' : filters.map(describeFilter).join(', ')
}

/** The whole number of days a last_active filter accepts, or undefined. */
export function withinDays(value: string): number | undefined {
  if (!/^\d+$/.test(value.trim())) return undefined

  const days = Number(value.trim())

  return days >= 1 && days <= 365 ? days : undefined
}

export type ParsedDefinition =
  { kind: 'ok'; definition: AudienceDefinition } | { kind: 'error'; reason: string }

/** Reads a definition typed on the command line — every refusal names the fix. */
export function parseDefinition(source: string): ParsedDefinition {
  let parsed: unknown

  try {
    parsed = JSON.parse(source)
  } catch {
    return { kind: 'error', reason: 'Invalid JSON. Use an object such as {"filters": []}.' }
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { kind: 'error', reason: 'A definition is an object, like {"filters": []}.' }
  }

  const filters = (parsed as Record<string, unknown>)['filters']

  if (!Array.isArray(filters)) {
    return {
      kind: 'error',
      reason: 'Include a `filters` array. An empty array matches all eligible devices.',
    }
  }

  const checked: AudienceFilter[] = []

  for (const entry of filters) {
    const filter = parseFilter(entry)

    if (filter.kind === 'error') return filter

    checked.push(filter.filter)
  }

  return { kind: 'ok', definition: { filters: checked } }
}

type ParsedFilter = { kind: 'ok'; filter: AudienceFilter } | { kind: 'error'; reason: string }

function refuse(reason: string): ParsedFilter {
  return { kind: 'error', reason }
}

function parseFilter(entry: unknown): ParsedFilter {
  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
    return refuse('Every filter is an object naming a `field`.')
  }

  const record = entry as Record<string, unknown>
  const spec = typeof record['field'] === 'string' ? fieldSpec(record['field']) : undefined

  if (spec === undefined) {
    return refuse(
      `\`${String(record['field'])}\` is not a field an audience filters on. ` +
        `The fields are ${FIELDS.map((candidate) => candidate.field).join(', ')}.`,
    )
  }

  const value = record['value']

  // The shapes are the spec's, checked here so a typo is answered by the
  // terminal rather than by a round trip.
  switch (spec.prompt.kind) {
    case 'choice': {
      const allowed = spec.prompt.choices.map((choice) => choice.value)

      if (typeof value !== 'string' || !allowed.includes(value)) {
        return refuse(`\`${spec.field}\` takes one of ${allowed.join(', ')}.`)
      }

      return { kind: 'ok', filter: { field: spec.field, value } as AudienceFilter }
    }
    case 'text': {
      if (typeof value !== 'string' || value.length === 0) {
        return refuse(`\`${spec.field}\` takes a value, like "${spec.prompt.placeholder}".`)
      }

      return { kind: 'ok', filter: { field: spec.field, value } as AudienceFilter }
    }
    case 'days': {
      const days = record['within_days']

      if (typeof days !== 'number' || !Number.isInteger(days) || days < 1 || days > 365) {
        return refuse('`last_active` takes `within_days`, a whole number of days from 1 to 365.')
      }

      return { kind: 'ok', filter: { field: 'last_active', within_days: days } }
    }
    case 'tag': {
      const key = record['key']

      if (typeof key !== 'string' || key.length === 0) {
        return refuse('`tag` takes a `key` and a `value`, like {"key": "plan", "value": "pro"}.')
      }
      if (typeof value !== 'string' || value.length === 0) {
        return refuse('`tag` takes a `key` and a `value`, like {"key": "plan", "value": "pro"}.')
      }

      return { kind: 'ok', filter: { field: 'tag', key, value } }
    }
  }
}

/** An audience is named by whoever types, and identified by its id — both reach it. */
export function resolveAudience(
  audiences: readonly SavedAudience[],
  nameOrId: string,
): SavedAudience | undefined {
  return (
    audiences.find((entry) => entry.id === nameOrId) ??
    audiences.find((entry) => entry.name.toLowerCase() === nameOrId.toLowerCase())
  )
}
