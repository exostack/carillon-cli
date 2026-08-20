import { describe, expect, it } from 'vitest'

import { slugify } from './slug.js'

describe('slugify', () => {
  it('builds the slug the dashboard would', () => {
    expect(slugify('Acme Mobile')).toBe('acme-mobile')
    expect(slugify('  Édition #2!  ')).toBe('dition-2')
  })

  it('leaves nothing for a name with no letters or digits', () => {
    expect(slugify('***')).toBe('')
  })
})
