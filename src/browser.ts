import { spawn } from 'node:child_process'

interface OpenCommand {
  readonly file: string
  readonly args: readonly string[]
}

/** Each platform's own opener; `start` is a cmd built-in, not an executable. */
export function openCommandFor(url: string, platform: NodeJS.Platform): OpenCommand {
  if (platform === 'darwin') return { file: 'open', args: [url] }
  if (platform === 'win32') return { file: 'cmd', args: ['/c', 'start', '', url] }

  return { file: 'xdg-open', args: [url] }
}

/**
 * Best effort, silent when it cannot: the URL is printed either way, and a
 * machine with no browser to open (SSH, a container) is a normal place to
 * sign in from — the flow's whole point is that the browser can be elsewhere.
 */
export function openInBrowser(url: string): void {
  const { file, args } = openCommandFor(url, process.platform)

  try {
    const child = spawn(file, [...args], { stdio: 'ignore', detached: true })

    child.on('error', () => {})
    child.unref()
  } catch {
    // The printed URL is the fallback.
  }
}
