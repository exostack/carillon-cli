import { intro, outro, password as passwordPrompt, spinner, text } from '@clack/prompts'
import { Command } from 'commander'
import pc from 'picocolors'

import { authRequest, type Session } from '../client.js'
import { writeToken } from '../config.js'
import { answered, fail } from '../output.js'

export const login = new Command('login')
  .description('Sign in with email and password')
  .option('--email <email>', 'account email')
  .option('--password <password>', 'account password (prompted for when omitted)')
  .action(async (options: { email?: string; password?: string }) => {
    intro(pc.bold('carillon login'))

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
  })
