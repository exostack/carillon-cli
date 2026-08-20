import { describe, expect, it } from 'vitest'

import {
  type AudienceFilter,
  describeFilters,
  devices,
  parseDefinition,
  resolveAudience,
  type SavedAudience,
  withinDays,
} from './audience.js'

function saved(id: string, name: string): SavedAudience {
  return { id, name, definition: { filters: [] }, created_at: '2026-01-01T00:00:00.000Z' }
}

describe('describeFilters', () => {
  it('says everyone when nothing narrows', () => {
    expect(describeFilters([])).toBe('everyone')
  })

  it('reads every field as a condition, in the order they were added', () => {
    const filters: AudienceFilter[] = [
      { field: 'platform', value: 'ios' },
      { field: 'push_permission', value: 'allowed' },
      { field: 'source', value: 'import' },
      { field: 'locale', value: 'fr-FR' },
      { field: 'timezone_id', value: 'Europe/Paris' },
      { field: 'app_version', value: '3.2.1' },
      { field: 'app_build', value: '4821' },
      { field: 'os_version', value: '18.2' },
      { field: 'last_active', within_days: 30 },
      { field: 'tag', key: 'plan', value: 'pro' },
    ]

    expect(describeFilters(filters)).toBe(
      'iOS, push allowed, loaded by an import, locale fr-FR, timezone Europe/Paris, ' +
        'app version 3.2.1, app build 4821, OS version 18.2, active in the last 30 days, ' +
        'tag plan=pro',
    )
  })

  it('counts a single day and a single device in the singular', () => {
    expect(describeFilters([{ field: 'last_active', within_days: 1 }])).toBe(
      'active in the last 1 day',
    )
    expect(devices(1)).toBe('1 device')
    expect(devices(0)).toBe('0 devices')
  })
})

describe('withinDays', () => {
  it('takes a whole number of days inside the year the API allows', () => {
    expect(withinDays('30')).toBe(30)
    expect(withinDays(' 1 ')).toBe(1)
    expect(withinDays('365')).toBe(365)
  })

  it('refuses everything else, rather than rounding it', () => {
    expect(withinDays('0')).toBeUndefined()
    expect(withinDays('366')).toBeUndefined()
    expect(withinDays('7.5')).toBeUndefined()
    expect(withinDays('a week')).toBeUndefined()
    expect(withinDays('')).toBeUndefined()
  })
})

describe('parseDefinition', () => {
  it('reads a definition the API would accept', () => {
    expect(
      parseDefinition(
        '{"filters":[{"field":"platform","value":"ios"},{"field":"tag","key":"plan","value":"pro"}]}',
      ),
    ).toEqual({
      kind: 'ok',
      definition: {
        filters: [
          { field: 'platform', value: 'ios' },
          { field: 'tag', key: 'plan', value: 'pro' },
        ],
      },
    })
  })

  it('reads an empty filter list as everyone', () => {
    expect(parseDefinition('{"filters":[]}')).toEqual({ kind: 'ok', definition: { filters: [] } })
  })

  it('keeps only what the field carries, dropping the rest', () => {
    expect(parseDefinition('{"filters":[{"field":"locale","value":"fr-FR","note":"hi"}]}')).toEqual(
      {
        kind: 'ok',
        definition: { filters: [{ field: 'locale', value: 'fr-FR' }] },
      },
    )
  })

  it('names the fix for a definition that is not one', () => {
    expect(parseDefinition('not json')).toMatchObject({ kind: 'error' })
    expect(parseDefinition('[]')).toMatchObject({ kind: 'error' })
    expect(parseDefinition('{}')).toMatchObject({ kind: 'error' })
    expect(parseDefinition('{"filters":{}}')).toMatchObject({ kind: 'error' })
  })

  it('refuses a field an audience does not filter on, and lists the ones it does', () => {
    const parsed = parseDefinition('{"filters":[{"field":"country","value":"FR"}]}')

    expect(parsed.kind).toBe('error')
    expect(parsed.kind === 'error' && parsed.reason).toContain('push_permission')
  })

  it('refuses a value outside what the field accepts', () => {
    expect(parseDefinition('{"filters":[{"field":"platform","value":"web"}]}')).toMatchObject({
      kind: 'error',
    })
    expect(parseDefinition('{"filters":[{"field":"locale","value":""}]}')).toMatchObject({
      kind: 'error',
    })
    expect(parseDefinition('{"filters":[{"field":"last_active","within_days":0}]}')).toMatchObject({
      kind: 'error',
    })
    expect(
      parseDefinition('{"filters":[{"field":"last_active","within_days":"30"}]}'),
    ).toMatchObject({ kind: 'error' })
    expect(parseDefinition('{"filters":[{"field":"tag","value":"pro"}]}')).toMatchObject({
      kind: 'error',
    })
  })
})

describe('resolveAudience', () => {
  const audiences = [saved('id-1', 'Lapsed iOS'), saved('id-2', 'Everyone')]

  it('finds an audience by its id', () => {
    expect(resolveAudience(audiences, 'id-2')?.name).toBe('Everyone')
  })

  it('finds an audience by the name a person would type', () => {
    expect(resolveAudience(audiences, 'lapsed ios')?.id).toBe('id-1')
  })

  it('prefers an id over a name, since an id is never ambiguous', () => {
    const collision = [saved('id-1', 'Lapsed iOS'), saved('Lapsed iOS', 'Something else')]

    expect(resolveAudience(collision, 'Lapsed iOS')?.name).toBe('Something else')
  })

  it('finds nothing for a name no audience carries', () => {
    expect(resolveAudience(audiences, 'Churned')).toBeUndefined()
  })
})
