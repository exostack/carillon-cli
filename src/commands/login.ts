import { intro, note, outro, password as passwordPrompt, spinner, text } from '@clack/prompts'
import { Command } from 'commander'
import pc from 'picocolors'

import { openInBrowser } from '../browser.js'
import { authRequest, type Session } from '../client.js'
import { writeToken } from '../config.js'
import { answered, fail } from '../output.js'

const CLIENT_ID = 'carillon-cli'

interface DeviceGrant {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete: string
  expires_in: number
  interval: number
}

interface TokenAnswer {
  access_token?: string
  error?: string
  error_description?: string
}

/** The XXXX-XXXX shape the dashboard's input mirrors; dashes are cosmetic. */
export function formatUserCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code
}

function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000))
}

export const login = new Command('login')
  .description('Sign in through the browser (or with --email/--password, for scripts)')
  .option('--email <email>', 'account email; presence switches to password sign-in')
  .option('--password <password>', 'account password; presence switches to password sign-in')
  .action(async (options: { email?: string; password?: string }) => {
    intro(pc.bold('carillon login'))

    // Either flag opts into the password flow, which asks for nothing it can
    // read from the flags — that is what makes it scriptable in CI.
    if (options.email !== undefined || options.password !== undefined) {
      await passwordSignIn(options)

      return
    }

    await deviceSignIn()
  })

/**
 * The default: no password ever crosses this terminal. The server issues a
 * pair of codes, the browser approves the short one, and the poll on the long
 * one answers with the session token.
 */
async function deviceSignIn(): Promise<void> {
  const { body: grant, response } = await authRequest<DeviceGrant>('/device/code', {
    method: 'POST',
    body: { client_id: CLIENT_ID },
  })

  if (!response.ok || grant === null) {
    fail('The server refused to start a device sign-in. It is probably too old for this CLI.')
  }

  note(
    `${grant.verification_uri_complete}\n\nCode: ${pc.bold(formatUserCode(grant.user_code))}`,
    'Approve this sign-in in your browser',
  )

  openInBrowser(grant.verification_uri_complete)

  const working = spinner()

  working.start('Waiting for the approval in the browser')

  const token = await pollForToken(grant)

  writeToken(token)

  // Greeting aside, this proves the freshly stored token opens a session.
  const { body: session } = await authRequest<Session>('/get-session')

  working.stop(`Signed in as ${session?.user.email ?? 'you'}`)

  outro(`Next: ${pc.cyan('carillon use')} picks the organization and app to work in.`)
}

async function pollForToken(grant: DeviceGrant): Promise<string> {
  // The server names the pace and answers slow_down when it is not respected;
  // adding five seconds is RFC 8628's own prescription for that answer.
  let interval = grant.interval > 0 ? grant.interval : 5

  for (;;) {
    await sleep(interval)

    const { body, response } = await authRequest<TokenAnswer>('/device/token', {
      method: 'POST',
      body: {
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: grant.device_code,
        client_id: CLIENT_ID,
      },
    })

    if (response.ok && body?.access_token !== undefined) return body.access_token

    if (body?.error === 'authorization_pending') continue
    if (body?.error === 'slow_down') {
      interval += 5
      continue
    }

    if (body?.error === 'access_denied') {
      fail('The sign-in was denied in the browser. Nothing was granted.')
    }
    if (body?.error === 'expired_token') {
      fail('The code expired before it was approved. Run `carillon login` again for a fresh one.')
    }

    fail(body?.error_description ?? `The server answered HTTP ${response.status} mid sign-in.`)
  }
}

async function passwordSignIn(options: { email?: string; password?: string }): Promise<void> {
  const email =
    options.email ??
    answered(
      await text({
        message: 'Email',
        placeholder: 'you@company.com',
        validate: (value) =>
          value !== undefined && value.includes('@') ? undefined : 'An email address.',
      }),
    )
  const password = options.password ?? answered(await passwordPrompt({ message: 'Password' }))

  const working = spinner()

  working.start('Signing in')

  const { body, response } = await authRequest<Session>('/sign-in/email', {
    method: 'POST',
    body: { email, password },
  })

  if (!response.ok) {
    working.stop('Sign-in refused')
    fail(
      'That email and password opened nothing. Carillon has no self-registration: ' +
        'accounts come from a dashboard invitation, so ask an organization owner to ' +
        'invite you — or reset your password from the dashboard sign-in page.',
    )
  }

  const token = response.header('set-auth-token')

  if (token === null) {
    working.stop('Sign-in answered without a token')
    fail('The server did not return a bearer token. It is probably too old for CLI sign-in.')
  }

  writeToken(token)
  working.stop(`Signed in as ${body?.user.email ?? email}`)

  outro(`Next: ${pc.cyan('carillon use')} picks the organization and app to work in.`)
}
