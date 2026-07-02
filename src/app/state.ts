export interface IfcLoadSummary {
  categoryCount: number
  categoryPreview: string[]
  fileName: string
  guidCount: number
  itemCount: number
  loadedModelCount: number
  source: 'bundled' | 'local'
  spatialNodeCount: number
  status: 'idle' | 'loading' | 'ready' | 'error'
  statusDetail: string
}

export interface SelectedIfcItemSummary {
  attributes: Array<{ label: string; value: string }>
  category: string
  guid: string
  itemId: number | null
  localId: number | null
  modelId: string
  modelLabel: string
  status: 'empty' | 'selected'
  title: string
}

export interface SpatialTreeNodeSummary {
  category: string
  children: SpatialTreeNodeSummary[]
  localId: number | null
  modelId: string
  modelLabel: string
}

export interface SelectedSpatialTreeNodeSummary {
  localId: number | null
  modelId: string | null
}

export type TelemetryStatus = 'normal' | 'warning' | 'alert'
export type TelemetryStreamState =
  | 'idle'
  | 'live'
  | 'stale'
  | 'disconnected'
  | 'reconnecting'

export interface TelemetryItemSummary {
  lastUpdatedAt: number
  lastUpdated: string
  localId: number
  modelId: string
  modelLabel: string
  powerKw: number
  pressureBar: number
  status: TelemetryStatus
  temperatureC: number
  utilization: number
}

export interface TelemetryHistoryPoint {
  timestamp: number
  temperatureC: number
  utilization: number
}

export interface TelemetryOverviewSummary {
  alertCount: number
  liveItemCount: number
  lastUpdated: string
  normalCount: number
  staleSeconds: number
  streamState: TelemetryStreamState
  warningCount: number
}

export interface TelemetryCategorySummary {
  alertCount: number
  category: string
  modelId: string
  modelLabel: string
  normalCount: number
  totalCount: number
  warningCount: number
}

export interface TelemetryStatusGroups {
  alert: number[]
  normal: number[]
  warning: number[]
}

export interface TelemetryStatusGroupsByModel {
  [modelId: string]: TelemetryStatusGroups
}

export interface FederatedModelSummary {
  categoryCount: number
  guidCount: number
  itemCount: number
  modelId: string
  modelLabel: string
  opacity: number
  source: 'bundled' | 'local'
  visible: boolean
}

export interface CategoryLayerSummary {
  category: string
  itemCount: number
  modelId: string
  modelLabel: string
  opacity: number
  visible: boolean
}

interface LayerStateSnapshot {
  categoryLayers: Array<{
    category: string
    modelId: string
    opacity: number
    visible: boolean
  }>
  models: Array<{
    modelId: string
    modelLabel: string
    opacity: number
    visible: boolean
  }>
}

type Listener = (summary: IfcLoadSummary) => void
type SelectionListener = (summary: SelectedIfcItemSummary) => void
type SpatialTreeListener = (tree: SpatialTreeNodeSummary[]) => void
type SelectedSpatialTreeListener = (
  selected: SelectedSpatialTreeNodeSummary,
) => void
type TelemetryListener = () => void
type LayerListener = () => void

const defaultSummary: IfcLoadSummary = {
  categoryCount: 0,
  categoryPreview: [],
  fileName: 'column-straight-rectangle-tessellation.ifc',
  guidCount: 0,
  itemCount: 0,
  loadedModelCount: 0,
  source: 'bundled',
  spatialNodeCount: 0,
  status: 'idle',
  statusDetail: 'IFC loader has not started yet.',
}

const defaultSelectionSummary: SelectedIfcItemSummary = {
  attributes: [],
  category: 'No item selected',
  guid: 'Select an IFC element in the scene.',
  itemId: null,
  localId: null,
  modelId: '',
  modelLabel: '',
  status: 'empty',
  title: 'Selected IFC Item',
}

let summary = { ...defaultSummary }
let selectionSummary = { ...defaultSelectionSummary }
let spatialTreeSummary: SpatialTreeNodeSummary[] = []
let spatialTreeByModel = new Map<string, SpatialTreeNodeSummary[]>()
let selectedSpatialTreeNodeSummary: SelectedSpatialTreeNodeSummary = {
  localId: null,
  modelId: null,
}
let telemetryByEntityKey = new Map<string, TelemetryItemSummary>()
let telemetryHistoryByEntityKey = new Map<string, TelemetryHistoryPoint[]>()
let telemetryOverviewSummary: TelemetryOverviewSummary = {
  alertCount: 0,
  liveItemCount: 0,
  lastUpdated: '—',
  normalCount: 0,
  staleSeconds: 0,
  streamState: 'idle',
  warningCount: 0,
}
let telemetryStatusGroups: TelemetryStatusGroups = {
  alert: [],
  normal: [],
  warning: [],
}
let telemetryStatusGroupsByModel: TelemetryStatusGroupsByModel = {}
let telemetryCategoryLookup = new Map<string, { category: string; modelId: string; modelLabel: string }>()
let telemetryCategorySummaries: TelemetryCategorySummary[] = []
let telemetryLastUpdatedAt: number | null = null
let federatedModelSummaries: FederatedModelSummary[] = []
let categoryLayerSummaries: CategoryLayerSummary[] = []
const listeners = new Set<Listener>()
const selectionListeners = new Set<SelectionListener>()
const spatialTreeListeners = new Set<SpatialTreeListener>()
const selectedSpatialTreeListeners = new Set<SelectedSpatialTreeListener>()
const telemetryListeners = new Set<TelemetryListener>()
const layerListeners = new Set<LayerListener>()
const LAYER_STATE_STORAGE_KEY = 'semiconductor-digital-twin:layer-state'

export function getIfcLoadSummary(): IfcLoadSummary {
  return summary
}

export function setIfcLoadSummary(nextSummary: Partial<IfcLoadSummary>): void {
  summary = {
    ...summary,
    ...nextSummary,
  }

  for (const listener of listeners) {
    listener(summary)
  }
}

export function getSelectedIfcItemSummary(): SelectedIfcItemSummary {
  return selectionSummary
}

export function setSelectedIfcItemSummary(
  nextSummary: Partial<SelectedIfcItemSummary>,
): void {
  selectionSummary = {
    ...selectionSummary,
    ...nextSummary,
  }

  for (const listener of selectionListeners) {
    listener(selectionSummary)
  }
}

export function subscribeIfcLoadSummary(listener: Listener): () => void {
  listeners.add(listener)
  listener(summary)

  return () => {
    listeners.delete(listener)
  }
}

export function subscribeSelectedIfcItemSummary(
  listener: SelectionListener,
): () => void {
  selectionListeners.add(listener)
  listener(selectionSummary)

  return () => {
    selectionListeners.delete(listener)
  }
}

export function getSpatialTreeSummary(): SpatialTreeNodeSummary[] {
  return spatialTreeSummary
}

export function upsertSpatialTreeSummary(
  modelId: string,
  tree: SpatialTreeNodeSummary[],
): void {
  spatialTreeByModel.set(modelId, tree)
  spatialTreeSummary = [...spatialTreeByModel.values()].flat()

  for (const listener of spatialTreeListeners) {
    listener(spatialTreeSummary)
  }
}

export function removeSpatialTreeSummary(modelId: string): void {
  spatialTreeByModel.delete(modelId)
  spatialTreeSummary = [...spatialTreeByModel.values()].flat()

  for (const listener of spatialTreeListeners) {
    listener(spatialTreeSummary)
  }
}

export function subscribeSpatialTreeSummary(
  listener: SpatialTreeListener,
): () => void {
  spatialTreeListeners.add(listener)
  listener(spatialTreeSummary)

  return () => {
    spatialTreeListeners.delete(listener)
  }
}

export function getSelectedSpatialTreeNodeSummary(): SelectedSpatialTreeNodeSummary {
  return selectedSpatialTreeNodeSummary
}

export function setSelectedSpatialTreeNodeSummary(
  selected: SelectedSpatialTreeNodeSummary,
): void {
  selectedSpatialTreeNodeSummary = selected

  for (const listener of selectedSpatialTreeListeners) {
    listener(selectedSpatialTreeNodeSummary)
  }
}

export function subscribeSelectedSpatialTreeNodeSummary(
  listener: SelectedSpatialTreeListener,
): () => void {
  selectedSpatialTreeListeners.add(listener)
  listener(selectedSpatialTreeNodeSummary)

  return () => {
    selectedSpatialTreeListeners.delete(listener)
  }
}

export function getTelemetryForLocalId(localId: number | null): TelemetryItemSummary | null {
  return getTelemetryForItem(null, localId)
}

export function getTelemetryForItem(
  modelId: null | string,
  localId: number | null,
): TelemetryItemSummary | null {
  if (localId === null || modelId === null) {
    return null
  }

  return telemetryByEntityKey.get(getTelemetryEntityKey(modelId, localId)) ?? null
}

export function getTelemetryOverviewSummary(): TelemetryOverviewSummary {
  return telemetryOverviewSummary
}

export function getTelemetryStatusGroups(): TelemetryStatusGroups {
  return telemetryStatusGroups
}

export function getTelemetryStatusGroupsByModel(): TelemetryStatusGroupsByModel {
  return telemetryStatusGroupsByModel
}

export function getTelemetryCategorySummaries(): TelemetryCategorySummary[] {
  return telemetryCategorySummaries
}

export function getTelemetryHistoryForLocalId(
  localId: number | null,
): TelemetryHistoryPoint[] {
  return getTelemetryHistoryForItem(null, localId)
}

export function getTelemetryHistoryForItem(
  modelId: null | string,
  localId: number | null,
): TelemetryHistoryPoint[] {
  if (localId === null || modelId === null) {
    return []
  }

  return telemetryHistoryByEntityKey.get(getTelemetryEntityKey(modelId, localId)) ?? []
}

export function getFederatedModelSummaries(): FederatedModelSummary[] {
  return federatedModelSummaries
}

export function getFederatedModelSummary(
  modelId: string,
): FederatedModelSummary | null {
  return federatedModelSummaries.find((model) => model.modelId === modelId) ?? null
}

export function getCategoryLayerSummaries(): CategoryLayerSummary[] {
  return categoryLayerSummaries
}

export function setTelemetryCategoryLookup(
  modelId: string,
  modelLabel: string,
  categoryItems: Record<string, number[]>,
): void {
  for (const [key, value] of telemetryCategoryLookup.entries()) {
    if (value.modelId === modelId) {
      telemetryCategoryLookup.delete(key)
    }
  }

  for (const [category, localIds] of Object.entries(categoryItems)) {
    for (const localId of localIds) {
      telemetryCategoryLookup.set(getTelemetryEntityKey(modelId, localId), {
        category,
        modelId,
        modelLabel,
      })
    }
  }

  telemetryCategorySummaries = buildTelemetryCategorySummaries(telemetryByEntityKey)

  for (const listener of telemetryListeners) {
    listener()
  }
}

export function setTelemetryItems(items: TelemetryItemSummary[]): void {
  telemetryByEntityKey = new Map(
    items.map((item) => [getTelemetryEntityKey(item.modelId, item.localId), item]),
  )
  telemetryLastUpdatedAt = items.length > 0 ? (items[0]?.lastUpdatedAt ?? null) : null
  telemetryHistoryByEntityKey = nextTelemetryHistory(telemetryHistoryByEntityKey, items)

  let normalCount = 0
  let warningCount = 0
  let alertCount = 0
  const normal: number[] = []
  const warning: number[] = []
  const alert: number[] = []
  const groupsByModel: TelemetryStatusGroupsByModel = {}

  for (const item of items) {
    if (!groupsByModel[item.modelId]) {
      groupsByModel[item.modelId] = {
        alert: [],
        normal: [],
        warning: [],
      }
    }

    if (item.status === 'normal') {
      normalCount += 1
      normal.push(item.localId)
      groupsByModel[item.modelId]?.normal.push(item.localId)
    } else if (item.status === 'warning') {
      warningCount += 1
      warning.push(item.localId)
      groupsByModel[item.modelId]?.warning.push(item.localId)
    } else {
      alertCount += 1
      alert.push(item.localId)
      groupsByModel[item.modelId]?.alert.push(item.localId)
    }
  }

  telemetryStatusGroups = {
    alert,
    normal,
    warning,
  }
  telemetryStatusGroupsByModel = groupsByModel
  telemetryCategorySummaries = buildTelemetryCategorySummaries(telemetryByEntityKey)

  telemetryOverviewSummary = {
    alertCount,
    liveItemCount: items.length,
    lastUpdated: telemetryLastUpdatedAt ? formatTime(telemetryLastUpdatedAt) : '—',
    normalCount,
    staleSeconds: 0,
    streamState: items.length > 0 ? 'live' : 'idle',
    warningCount,
  }

  for (const listener of telemetryListeners) {
    listener()
  }
}

export function resetTelemetryItems(): void {
  telemetryByEntityKey = new Map()
  telemetryHistoryByEntityKey = new Map()
  telemetryLastUpdatedAt = null
  telemetryCategorySummaries = []
  telemetryStatusGroups = {
    alert: [],
    normal: [],
    warning: [],
  }
  telemetryStatusGroupsByModel = {}
  telemetryOverviewSummary = {
    alertCount: 0,
    liveItemCount: 0,
    lastUpdated: '—',
    normalCount: 0,
    staleSeconds: 0,
    streamState: 'idle',
    warningCount: 0,
  }

  for (const listener of telemetryListeners) {
    listener()
  }
}

export function subscribeTelemetry(listener: TelemetryListener): () => void {
  telemetryListeners.add(listener)
  listener()

  return () => {
    telemetryListeners.delete(listener)
  }
}

export function subscribeLayerState(listener: LayerListener): () => void {
  layerListeners.add(listener)
  listener()

  return () => {
    layerListeners.delete(listener)
  }
}

export function upsertFederatedModelSummary(summary: FederatedModelSummary): void {
  const persisted = getPersistedLayerState()
  const persistedModel = persisted.models.find((model) => model.modelId === summary.modelId)

  federatedModelSummaries = sortFederatedModels([
    ...federatedModelSummaries.filter((model) => model.modelId !== summary.modelId),
    {
      ...summary,
      modelLabel: persistedModel?.modelLabel ?? summary.modelLabel,
      opacity: persistedModel?.opacity ?? summary.opacity,
      visible: persistedModel?.visible ?? summary.visible,
    },
  ])
  setIfcLoadSummary({
    loadedModelCount: federatedModelSummaries.length,
  })
  persistLayerState()

  for (const listener of layerListeners) {
    listener()
  }
}

export function removeFederatedModelSummary(modelId: string): void {
  federatedModelSummaries = federatedModelSummaries.filter(
    (model) => model.modelId !== modelId,
  )
  categoryLayerSummaries = categoryLayerSummaries.filter(
    (layer) => layer.modelId !== modelId,
  )
  setIfcLoadSummary({
    loadedModelCount: federatedModelSummaries.length,
  })
  persistLayerState()

  for (const listener of layerListeners) {
    listener()
  }
}

export function upsertCategoryLayerSummaries(
  modelId: string,
  modelLabel: string,
  categoryItems: Record<string, number[]>,
): void {
  const persisted = getPersistedLayerState()
  const previous = categoryLayerSummaries.filter((layer) => layer.modelId !== modelId)
  const next = Object.entries(categoryItems).map(([category, localIds]) => ({
    category,
    itemCount: localIds.length,
    modelId,
    modelLabel,
    opacity:
      persisted.categoryLayers.find(
        (layer) => layer.modelId === modelId && layer.category === category,
      )?.opacity ??
      categoryLayerSummaries.find(
        (layer) => layer.modelId === modelId && layer.category === category,
      )?.opacity ?? 1,
    visible:
      persisted.categoryLayers.find(
        (layer) => layer.modelId === modelId && layer.category === category,
      )?.visible ??
      categoryLayerSummaries.find(
        (layer) => layer.modelId === modelId && layer.category === category,
      )?.visible ?? true,
  }))

  categoryLayerSummaries = [...previous, ...next].sort((left, right) => {
    if (left.modelLabel !== right.modelLabel) {
      return left.modelLabel.localeCompare(right.modelLabel)
    }

    return left.category.localeCompare(right.category)
  })
  persistLayerState()

  for (const listener of layerListeners) {
    listener()
  }
}

export function setFederatedModelVisibility(modelId: string, visible: boolean): void {
  federatedModelSummaries = federatedModelSummaries.map((model) =>
    model.modelId === modelId ? { ...model, visible } : model,
  )
  persistLayerState()

  for (const listener of layerListeners) {
    listener()
  }
}

export function setFederatedModelOpacity(modelId: string, opacity: number): void {
  federatedModelSummaries = federatedModelSummaries.map((model) =>
    model.modelId === modelId ? { ...model, opacity } : model,
  )
  persistLayerState()

  for (const listener of layerListeners) {
    listener()
  }
}

export function renameFederatedModel(modelId: string, modelLabel: string): void {
  federatedModelSummaries = sortFederatedModels(
    federatedModelSummaries.map((model) =>
      model.modelId === modelId ? { ...model, modelLabel } : model,
    ),
  )
  categoryLayerSummaries = sortCategoryLayers(
    categoryLayerSummaries.map((layer) =>
      layer.modelId === modelId ? { ...layer, modelLabel } : layer,
    ),
  )
  telemetryByEntityKey = new Map(
    [...telemetryByEntityKey.entries()].map(([key, item]) => [
      key,
      item.modelId === modelId ? { ...item, modelLabel } : item,
    ]),
  )
  telemetryCategoryLookup = new Map(
    [...telemetryCategoryLookup.entries()].map(([key, value]) => [
      key,
      value.modelId === modelId ? { ...value, modelLabel } : value,
    ]),
  )
  telemetryCategorySummaries = telemetryCategorySummaries.map((summary) =>
    summary.modelId === modelId ? { ...summary, modelLabel } : summary,
  )
  if (selectionSummary.modelId === modelId) {
    selectionSummary = {
      ...selectionSummary,
      modelLabel,
    }
  }
  spatialTreeSummary = spatialTreeSummary.map((node) =>
    renameSpatialTreeNodeModelLabel(node, modelId, modelLabel),
  )
  spatialTreeByModel = new Map(
    [...spatialTreeByModel.entries()].map(([key, nodes]) => [
      key,
      nodes.map((node) => renameSpatialTreeNodeModelLabel(node, modelId, modelLabel)),
    ]),
  )
  persistLayerState()

  for (const listener of layerListeners) {
    listener()
  }

  for (const listener of spatialTreeListeners) {
    listener(spatialTreeSummary)
  }

  for (const listener of selectionListeners) {
    listener(selectionSummary)
  }
}

export function setCategoryLayerVisibility(
  modelId: string,
  category: string,
  visible: boolean,
): void {
  categoryLayerSummaries = categoryLayerSummaries.map((layer) =>
    layer.modelId === modelId && layer.category === category
      ? { ...layer, visible }
      : layer,
  )
  persistLayerState()

  for (const listener of layerListeners) {
    listener()
  }
}

export function setCategoryLayerOpacity(
  modelId: string,
  category: string,
  opacity: number,
): void {
  categoryLayerSummaries = categoryLayerSummaries.map((layer) =>
    layer.modelId === modelId && layer.category === category
      ? { ...layer, opacity }
      : layer,
  )
  persistLayerState()

  for (const listener of layerListeners) {
    listener()
  }
}

export function isolateFederatedModel(modelId: string): void {
  federatedModelSummaries = federatedModelSummaries.map((model) => ({
    ...model,
    visible: model.modelId === modelId,
  }))
  categoryLayerSummaries = categoryLayerSummaries.map((layer) => ({
    ...layer,
    visible: layer.modelId === modelId,
  }))
  persistLayerState()

  for (const listener of layerListeners) {
    listener()
  }
}

export function isolateCategoryLayer(modelId: string, category: string): void {
  federatedModelSummaries = federatedModelSummaries.map((model) => ({
    ...model,
    visible: model.modelId === modelId,
  }))
  categoryLayerSummaries = categoryLayerSummaries.map((layer) => ({
    ...layer,
    visible: layer.modelId === modelId && layer.category === category,
  }))
  persistLayerState()

  for (const listener of layerListeners) {
    listener()
  }
}

export function resetLayerState(): void {
  federatedModelSummaries = federatedModelSummaries.map((model) => ({
    ...model,
    opacity: 1,
    visible: true,
  }))
  categoryLayerSummaries = categoryLayerSummaries.map((layer) => ({
    ...layer,
    opacity: 1,
    visible: true,
  }))
  persistLayerState()

  for (const listener of layerListeners) {
    listener()
  }
}

export function setTelemetryStreamState(streamState: TelemetryStreamState): void {
  telemetryOverviewSummary = {
    ...telemetryOverviewSummary,
    lastUpdated: telemetryLastUpdatedAt ? formatTime(telemetryLastUpdatedAt) : '—',
    staleSeconds: telemetryLastUpdatedAt
      ? Math.max(0, Math.floor((Date.now() - telemetryLastUpdatedAt) / 1000))
      : 0,
    streamState,
  }

  for (const listener of telemetryListeners) {
    listener()
  }
}

export function removeTelemetryCategoryLookup(modelId: string): void {
  for (const [key, value] of telemetryCategoryLookup.entries()) {
    if (value.modelId === modelId) {
      telemetryCategoryLookup.delete(key)
    }
  }

  telemetryCategorySummaries = buildTelemetryCategorySummaries(telemetryByEntityKey)

  for (const listener of telemetryListeners) {
    listener()
  }
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('zh-TW', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function buildTelemetryCategorySummaries(
  telemetry: Map<string, TelemetryItemSummary>,
): TelemetryCategorySummary[] {
  const summaryMap = new Map<string, TelemetryCategorySummary>()

  for (const item of telemetry.values()) {
    const categoryInfo =
      telemetryCategoryLookup.get(getTelemetryEntityKey(item.modelId, item.localId)) ?? {
        category: 'Unmapped',
        modelId: item.modelId,
        modelLabel: item.modelLabel,
      }
    const key = `${categoryInfo.modelId}:${categoryInfo.category}`
    const current = summaryMap.get(key) ?? {
      alertCount: 0,
      category: categoryInfo.category,
      modelId: categoryInfo.modelId,
      modelLabel: categoryInfo.modelLabel,
      normalCount: 0,
      totalCount: 0,
      warningCount: 0,
    }

    current.totalCount += 1

    if (item.status === 'normal') {
      current.normalCount += 1
    } else if (item.status === 'warning') {
      current.warningCount += 1
    } else {
      current.alertCount += 1
    }

    summaryMap.set(key, current)
  }

  return [...summaryMap.values()].sort((left, right) => {
    if (right.alertCount !== left.alertCount) {
      return right.alertCount - left.alertCount
    }

    if (right.warningCount !== left.warningCount) {
      return right.warningCount - left.warningCount
    }

    return right.totalCount - left.totalCount
  })
}

function renameSpatialTreeNodeModelLabel(
  node: SpatialTreeNodeSummary,
  modelId: string,
  modelLabel: string,
): SpatialTreeNodeSummary {
  return {
    ...node,
    children: node.children.map((child) =>
      renameSpatialTreeNodeModelLabel(child, modelId, modelLabel),
    ),
    modelLabel: node.modelId === modelId ? modelLabel : node.modelLabel,
  }
}

function sortCategoryLayers(
  layers: CategoryLayerSummary[],
): CategoryLayerSummary[] {
  return [...layers].sort((left, right) => {
    if (left.modelLabel !== right.modelLabel) {
      return left.modelLabel.localeCompare(right.modelLabel)
    }

    return left.category.localeCompare(right.category)
  })
}

function sortFederatedModels(
  models: FederatedModelSummary[],
): FederatedModelSummary[] {
  return [...models].sort((left, right) => left.modelLabel.localeCompare(right.modelLabel))
}

function nextTelemetryHistory(
  previous: Map<string, TelemetryHistoryPoint[]>,
  items: TelemetryItemSummary[],
): Map<string, TelemetryHistoryPoint[]> {
  const next = new Map<string, TelemetryHistoryPoint[]>()

  for (const item of items) {
    const key = getTelemetryEntityKey(item.modelId, item.localId)
    const history = previous.get(key) ?? []
    const appended = [
      ...history,
      {
        temperatureC: item.temperatureC,
        timestamp: item.lastUpdatedAt,
        utilization: item.utilization,
      },
    ]

    next.set(key, appended.slice(-30))
  }

  return next
}

export function getTelemetryEntityKey(modelId: string, localId: number): string {
  return `${modelId}::${localId}`
}

function getPersistedLayerState(): LayerStateSnapshot {
  if (typeof window === 'undefined') {
    return { categoryLayers: [], models: [] }
  }

  try {
    const raw = window.localStorage.getItem(LAYER_STATE_STORAGE_KEY)

    if (!raw) {
      return { categoryLayers: [], models: [] }
    }

    return JSON.parse(raw) as LayerStateSnapshot
  } catch {
    return { categoryLayers: [], models: [] }
  }
}

function persistLayerState(): void {
  if (typeof window === 'undefined') {
    return
  }

  const snapshot: LayerStateSnapshot = {
    categoryLayers: categoryLayerSummaries.map((layer) => ({
      category: layer.category,
      modelId: layer.modelId,
      opacity: layer.opacity,
      visible: layer.visible,
    })),
    models: federatedModelSummaries.map((model) => ({
      modelId: model.modelId,
      modelLabel: model.modelLabel,
      opacity: model.opacity,
      visible: model.visible,
    })),
  }

  window.localStorage.setItem(LAYER_STATE_STORAGE_KEY, JSON.stringify(snapshot))
}
