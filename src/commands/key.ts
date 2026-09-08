import { select, text } from '@clack/prompts'
import { Command } from 'commander'
import pc from 'picocolors'

import { api, unwrap } from '../client.js'
import { requireApp } from '../context.js'
import { answered, fail, printJson, table } from '../output.js'

export const key = new Command('key').description('API keys of the current app')

key
  .command('list')
  .description('List keys')
  .option('--json', 'machine-readable output')
  .action(async (options: { json?: boolean }) => {
    const app = requireApp()
    const keys = await unwrap(
      api().GET('/v1/apps/{appId}/keys', { params: { path: { appId: app.id } } }),
    )

    if (options.json === true) return printJson(keys)
    if (keys.length === 0) {
      return console.log('No keys yet. Create one with `carillon key create`.')
    }

    // A mobile key ships inside app binaries and is public by construction, so
    // the server returns it whole and it is shown whole. A secret key was shown
    // once, at creation; only its prefix remains.
    table([
      ['KEY', 'TYPE', 'MODE', 'LABEL', 'REVOKED'],
      ...keys.map((entry) => [
        entry.secret ?? `${entry.prefix}…`,
        entry.type,
        entry.mode,
        entry.label ?? '',
        entry.revoked_at === null ? '' : entry.revoked_at,
      ]),
    ])
  })

key
  .command('create')
  .description('Create a key')
  .option('--type <type>', 'secret or mobile')
  .option('--mode <mode>', 'live or test', 'live')
  .option('--name <label>', 'optional key label')
  .action(async (options: { type?: string; mode: string; name?: string }) => {
    const app = requireApp()

    const type =
      options.type ??
      answered(
        await select({
          message: 'Key type',
          options: [
            {
              value: 'secret',
              label: 'Secret',
              hint: 'server-to-server — sends, reads traces, manages devices',
            },
            {
              value: 'mobile',
              label: 'Mobile',
              hint: 'registers and updates devices; reports notification opens',
            },
          ],
        }),
      )

    if (type !== 'secret' && type !== 'mobile') fail('Use --type secret or --type mobile.')
    if (options.mode !== 'live' && options.mode !== 'test') {
      fail('Use --mode live or --mode test.')
    }

    const label =
      options.name ??
      answered(await text({ message: 'Label', placeholder: 'Backend production' })) ??
      ''

    const created = await unwrap(
      api().POST('/v1/apps/{appId}/keys', {
        params: { path: { appId: app.id } },
        body: {
          type,
          mode: options.mode,
          ...(label.length === 0 ? {} : { label }),
        },
      }),
    )

    if (created.secret === null) {
      console.log(`Created ${created.type} key ${created.prefix}… (${created.id}).`)

      return
    }

    if (created.type === 'secret') {
      console.log('')
      console.log(pc.bold(pc.yellow('Copy this secret key now. It cannot be retrieved later.')))
      console.log('')
      console.log(`  ${pc.bold(created.secret)}`)
      console.log('')
      console.log('Store it in your server secret storage. If lost, revoke this key')
      console.log('and create another.')

      return
    }

    console.log(`Created mobile key (${created.id}):`)
    console.log('')
    console.log(`  ${pc.bold(created.secret)}`)
    console.log('')
    console.log('Mobile keys ship inside app binaries and stay readable in `carillon key list`.')
  })

key
  .command('revoke <id>')
  .description('Revoke a key by its id')
  .action(async (id: string) => {
    const app = requireApp()

    const revoked = await unwrap(
      api().POST('/v1/apps/{appId}/keys/{keyId}/revoke', {
        params: { path: { appId: app.id, keyId: id } },
      }),
    )

    console.log(
      `Revoked ${revoked.type} key ${revoked.prefix}… (${revoked.id}). ` +
        'Requests using this key will be rejected.',
    )
  })
