import { cancel, isCancel } from '@clack/prompts'
import pc from 'picocolors'

export function fail(message: string): never {
  console.error(pc.red(message))
  process.exit(1)
}

export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2))
}

export function table(rows: string[][]): void {
  const widths: number[] = []

  for (const row of rows) {
    row.forEach((cell, index) => {
      widths[index] = Math.max(widths[index] ?? 0, cell.length)
    })
  }

  for (const row of rows) {
    console.log(
      row
        .map((cell, index) => cell.padEnd(widths[index] ?? 0))
        .join('  ')
        .trimEnd(),
    )
  }
}

/** Unwraps a clack answer, turning Ctrl-C into a clean exit instead of a symbol. */
export function answered<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel('Cancelled.')
    process.exit(1)
  }

  return value as T
}
