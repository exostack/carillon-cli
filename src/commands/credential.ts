import { readFileSync } from 'node:fs'

import { intro, outro, select, text } from '@clack/prompts'
import { Command } from 'commander'
import pc from 'picocolors'

import { api, unwrap } from '../client.js'
import { requireApp } from '../context.js'
import { apnsKeyIdFromFilename, parseFcmServiceAccount } from '../credential-material.js'
import { answered, fail, printJson, table } from '../output.js'

export const credential = new Command('credential').description(
  'Push credentials of the current app',
)

credential
  .command('list')
  .description('List credentials')
  .option('--json', 'machine-readable output')
  .action(async (options: { json?: boolean }) => {
    const app = requireApp()
    const credentials = await unwrap(
      api().GET('/v1/apps/{appId}/credentials', { params: { path: { appId: app.id } } }),
    )

    if (options.json === true) return printJson(credentials)
    if (credentials.length === 0) {
      return console.log('No credentials yet. Upload one with `carillon credential upload`.')
    }

    table([
      ['PROVIDER', 'KEY ID', 'STATUS', 'FINGERPRINT', 'LAST ERROR'],
      ...credentials.map((entry) => [
        entry.provider,
        entry.key_id,
        entry.status,
        entry.fingerprint,
        entry.last_error ?? '',
      ]),
    ])
  })

interface UploadOptions {
  provider?: string
  file?: string
  keyId?: string
  teamId?: string
  bundleId?: string
}

credential
  .command('upload')
  .description('Upload an APNs .p8 key or an FCM service account JSON')
  .option('--provider <provider>', 'apns or fcm')
  .option('--file <path>', 'the .p8 file (APNs) or service account JSON (FCM)')
  .option('--key-id <id>', 'APNs Key ID (APNs only)')
  .option('--team-id <id>', 'Apple team identifier (APNs only)')
  .option('--bundle-id <id>', 'the bundle identifier APNs routes by (APNs only)')
  .action(async (options: UploadOptions) => {
    const app = requireApp()

    intro(pc.bold('carillon credential upload'))

    const provider =
      options.provider ??
      answered(
        await select({
          message: 'Provider',
          options: [
            { value: 'apns', label: 'APNs', hint: 'iOS — a .p8 key from the Apple portal' },
            { value: 'fcm', label: 'FCM v1', hint: 'Android — a service account JSON' },
          ],
        }),
      )

    if (provider !== 'apns' && provider !== 'fcm') fail('The provider is either `apns` or `fcm`.')

    const body = provider === 'apns' ? await apnsUpload(options) : await fcmUpload(options)

    const created = await unwrap(
      api().POST('/v1/apps/{appId}/credentials', {
        params: { path: { appId: app.id } },
        body,
      }),
    )

    // The material itself is sealed on arrival and never comes back — so
    // nothing here has it to show. The fingerprint is how it is recognised.
    outro(
      `Stored ${created.provider} credential ${created.key_id} ` +
        `(${created.fingerprint}) for ${app.name} — status ${created.status}.`,
    )
  })

function material(path: string): string {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    fail(`Could not read ${path}.`)
  }
}

async function apnsUpload(options: UploadOptions) {
  const file =
    options.file ??
    answered(
      await text({
        message: 'Path to the .p8 key',
        placeholder: './AuthKey_ABC123DEFG.p8',
        validate: (value) => (value !== undefined && value.length > 0 ? undefined : 'A path.'),
      }),
    )
  const contents = material(file)
  const fromFilename = apnsKeyIdFromFilename(file)

  const keyId =
    options.keyId ??
    answered(
      await text({
        message: 'Key ID',
        ...(fromFilename === undefined ? {} : { initialValue: fromFilename }),
        validate: (value) =>
          value !== undefined && value.length > 0 ? undefined : 'The 10-character Key ID.',
      }),
    )
  const teamId =
    options.teamId ??
    answered(
      await text({
        message: 'Team ID',
        validate: (value) =>
          value !== undefined && value.length > 0 ? undefined : 'The Apple team identifier.',
      }),
    )
  const bundleId =
    options.bundleId ??
    answered(
      await text({
        message: 'Bundle ID',
        placeholder: 'com.example.app',
        validate: (value) =>
          value !== undefined && value.length > 0
            ? undefined
            : 'The app identifier APNs routes by.',
      }),
    )

  return {
    provider: 'apns' as const,
    key_id: keyId,
    team_id: teamId,
    bundle_id: bundleId,
    material: contents,
  }
}

async function fcmUpload(options: UploadOptions) {
  const file =
    options.file ??
    answered(
      await text({
        message: 'Path to the service account JSON',
        placeholder: './service-account.json',
        validate: (value) => (value !== undefined && value.length > 0 ? undefined : 'A path.'),
      }),
    )
  const contents = material(file)
  const parsed = parseFcmServiceAccount(contents)

  if (parsed.kind === 'not-json')
    fail(`${file} is not JSON — expected a Firebase service account file.`)
  if (parsed.kind === 'no-project-id') {
    fail(`${file} carries no project_id — expected a Firebase service account file.`)
  }

  return { provider: 'fcm' as const, key_id: parsed.projectId, material: contents }
}
