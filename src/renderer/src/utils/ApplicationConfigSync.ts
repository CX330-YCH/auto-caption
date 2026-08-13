export class ApplicationConfigSync {
  private applyingRemote = false
  private remoteRevision = 0
  private readonly transmit: () => void
  private readonly scheduleAfterFlush: (callback: () => void) => void

  public constructor(
    transmit: () => void,
    scheduleAfterFlush: (callback: () => void) => void
  ) {
    this.transmit = transmit
    this.scheduleAfterFlush = scheduleAfterFlush
  }

  public send(): void {
    if (!this.applyingRemote) this.transmit()
  }

  public applyRemote(apply: () => void): void {
    this.applyingRemote = true
    const revision = ++this.remoteRevision
    apply()
    this.scheduleAfterFlush(() => {
      if (revision === this.remoteRevision) this.applyingRemote = false
    })
  }
}
