import { describe, expect, it } from 'vitest'

import { openCommandFor } from './browser.js'
import { formatUserCode } from './commands/login.js'

const URL = 'https://app.carillon.dev/device?user_code=ABCD2345'

describe('the browser opener', () => {
  it('uses each platform its own way', () => {
    expect(openCommandFor(URL, 'darwin')).toEqual({ file: 'open', args: [URL] })
    expect(openCommandFor(URL, 'linux')).toEqual({ file: 'xdg-open', args: [URL] })
    // The empty argument is `start`'s window title; without it, the URL
    // becomes the title and nothing opens.
    expect(openCommandFor(URL, 'win32')).toEqual({ file: 'cmd', args: ['/c', 'start', '', URL] })
  })
})

describe('the displayed code', () => {
  it('is split XXXX-XXXX, as the dashboard input expects to read it', () => {
    expect(formatUserCode('ABCD2345')).toBe('ABCD-2345')
  })

  it('passes through anything of another length, unguessed', () => {
    expect(formatUserCode('ABC')).toBe('ABC')
  })
})
