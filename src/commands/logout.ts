import { Command } from 'commander'

import { authRequest } from '../client.js'
import { clearToken, readToken } from '../config.js'

export const logout = new Command('logout')
  .description('Sign out and forget the stored token')
  .action(async () => {
    if (readToken() !== null) {
      // Best effort: the point is revoking the session server-side, but a
      // token the server no longer recognises still deserves to be forgotten.
      await authRequest('/sign-out', { method: 'POST', body: {} }).catch(() => undefined)
    }

    clearToken()
    console.log('Signed out.')
  })
