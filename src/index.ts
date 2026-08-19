import { createRequire } from 'node:module'

import { Command } from 'commander'

import { app } from './commands/app.js'
import { credential } from './commands/credential.js'
import { key } from './commands/key.js'
import { login } from './commands/login.js'
import { logout } from './commands/logout.js'
import { org } from './commands/org.js'
import { use } from './commands/use.js'
import { whoami } from './commands/whoami.js'
import { fail } from './output.js'

const { version } = createRequire(import.meta.url)('../package.json') as { version: string }

const program = new Command('carillon')
  .description('The Carillon command line — push notifications, from a terminal.')
  .version(version)

for (const command of [login, logout, whoami, org, use, app, credential, key]) {
  program.addCommand(command)
}

program.parseAsync(process.argv).catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error))
})
