export interface ProcessTreeDependencies {
  kill: (pid: number, signal: NodeJS.Signals) => void
  taskkill: (pid: number, callback: (error: Error | null) => void) => void
}

export function shouldCreateProcessGroup(platform: NodeJS.Platform): boolean {
  return platform !== 'win32'
}

export function forceKillProcessTree(
  pid: number,
  platform: NodeJS.Platform,
  dependencies: ProcessTreeDependencies,
  callback: (error: Error | null) => void
): void {
  if (!Number.isSafeInteger(pid) || pid <= 0) {
    callback(new Error('Invalid engine process ID'))
    return
  }
  if (platform === 'win32') {
    dependencies.taskkill(pid, callback)
    return
  }
  try {
    // A detached POSIX child becomes leader of its own process group.
    dependencies.kill(-pid, 'SIGKILL')
    callback(null)
  }
  catch (error) {
    callback(error instanceof Error ? error : new Error('Process kill failed'))
  }
}
