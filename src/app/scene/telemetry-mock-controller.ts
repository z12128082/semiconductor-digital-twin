import {
  resetTelemetryItems,
  setTelemetryStreamState,
  setTelemetryItems,
  type TelemetryItemSummary,
  type TelemetryStreamState,
  type TelemetryStatus,
} from '../state'

interface ModelTelemetryStream {
  localIds: number[]
  modelId: string
  modelLabel: string
  phaseIndex: number
  phaseTicks: number
}

interface StreamPhase {
  duration: number
  state: TelemetryStreamState
  updates: boolean
}

const STREAM_SEQUENCE: StreamPhase[] = [
  { duration: 6, state: 'live', updates: true },
  { duration: 2, state: 'stale', updates: false },
  { duration: 2, state: 'disconnected', updates: false },
  { duration: 2, state: 'reconnecting', updates: false },
]

export class TelemetryMockController {
  private intervalId: number | null = null
  private streams = new Map<string, ModelTelemetryStream>()

  upsertModel(modelId: string, modelLabel: string, localIds: number[]): void {
    const existing = this.streams.get(modelId)

    this.streams.set(modelId, {
      localIds: [...localIds],
      modelId,
      modelLabel,
      phaseIndex: existing?.phaseIndex ?? 0,
      phaseTicks: existing?.phaseTicks ?? 0,
    })

    this.publish()

    if (this.intervalId === null) {
      this.intervalId = window.setInterval(() => {
        this.advance()
      }, 1000)
    }
  }

  removeModel(modelId: string): void {
    this.streams.delete(modelId)

    if (this.streams.size === 0) {
      this.stop()
      return
    }

    this.publish()
  }

  renameModel(modelId: string, modelLabel: string): void {
    const stream = this.streams.get(modelId)

    if (!stream) {
      return
    }

    this.streams.set(modelId, {
      ...stream,
      modelLabel,
    })
    this.publish()
  }

  stop(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId)
      this.intervalId = null
    }

    this.streams.clear()
    resetTelemetryItems()
  }

  private advance(): void {
    for (const stream of this.streams.values()) {
      stream.phaseTicks += 1

      const phase = STREAM_SEQUENCE[stream.phaseIndex]

      if (!phase) {
        continue
      }

      if (stream.phaseTicks >= phase.duration) {
        stream.phaseIndex = (stream.phaseIndex + 1) % STREAM_SEQUENCE.length
        stream.phaseTicks = 0
      }
    }

    const state = this.resolveGlobalState()
    setTelemetryStreamState(state)

    if (state === 'live') {
      this.publish()
    }
  }

  private publish(): void {
    const now = Date.now()
    const items: TelemetryItemSummary[] = []

    for (const stream of this.streams.values()) {
      for (const localId of stream.localIds) {
        items.push(buildTelemetryItem(stream.modelId, stream.modelLabel, localId, now))
      }
    }

    setTelemetryItems(items)
  }

  private resolveGlobalState(): TelemetryStreamState {
    if (this.streams.size === 0) {
      return 'idle'
    }

    const phases = [...this.streams.values()].map(
      (stream) => STREAM_SEQUENCE[stream.phaseIndex]?.state ?? 'idle',
    )

    if (phases.includes('disconnected')) {
      return 'disconnected'
    }

    if (phases.includes('reconnecting')) {
      return 'reconnecting'
    }

    if (phases.includes('stale')) {
      return 'stale'
    }

    return 'live'
  }
}

function buildTelemetryItem(
  modelId: string,
  modelLabel: string,
  localId: number,
  now: number,
): TelemetryItemSummary {
  const phase = now / 1000 + localId * 0.37
  const utilization = clamp(54 + Math.sin(phase) * 23 + Math.cos(phase * 0.31) * 8, 18, 98)
  const temperatureC = round(20 + utilization / 11 + Math.sin(phase * 0.47) * 1.7, 1)
  const pressureBar = round(0.94 + Math.cos(phase * 0.23) * 0.06, 3)
  const powerKw = round(18 + utilization * 0.42 + Math.sin(phase * 0.67) * 4, 1)

  return {
    lastUpdatedAt: now,
    lastUpdated: new Date(now).toLocaleTimeString('zh-TW', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    localId,
    modelId,
    modelLabel,
    powerKw,
    pressureBar,
    status: deriveStatus(utilization, temperatureC),
    temperatureC,
    utilization: round(utilization, 1),
  }
}

function deriveStatus(utilization: number, temperatureC: number): TelemetryStatus {
  if (utilization >= 86 || temperatureC >= 28) {
    return 'alert'
  }

  if (utilization >= 72 || temperatureC >= 25.5) {
    return 'warning'
  }

  return 'normal'
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
