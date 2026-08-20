import { basename } from 'node:path'

/** Apple names the download after the key, so the id is usually already in hand. */
export function apnsKeyIdFromFilename(file: string): string | undefined {
  return /^AuthKey_([A-Z0-9]+)\.p8$/.exec(basename(file))?.[1]
}

export type FcmServiceAccount =
  { kind: 'ok'; projectId: string } | { kind: 'not-json' } | { kind: 'no-project-id' }

export function parseFcmServiceAccount(contents: string): FcmServiceAccount {
  let parsed: unknown

  try {
    parsed = JSON.parse(contents)
  } catch {
    return { kind: 'not-json' }
  }

  const projectId =
    parsed !== null && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)['project_id']
      : undefined

  if (typeof projectId !== 'string' || projectId.length === 0) return { kind: 'no-project-id' }

  return { kind: 'ok', projectId }
}
