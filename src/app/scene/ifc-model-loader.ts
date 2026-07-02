import {
  Components,
  FragmentsManager,
  IfcLoader,
} from '@thatopen/components'
import type { FragmentsModel, ItemData, SpatialTreeItem } from '@thatopen/fragments'

import {
  getFederatedModelSummary,
  removeFederatedModelSummary,
  removeTelemetryCategoryLookup,
  removeSpatialTreeSummary,
  setIfcLoadSummary,
  setTelemetryCategoryLookup,
  upsertSpatialTreeSummary,
  upsertCategoryLayerSummaries,
  upsertFederatedModelSummary,
  type SpatialTreeNodeSummary,
} from '../state'

const SAMPLE_IFC_URL = '/assets/ifc/column-straight-rectangle-tessellation.ifc'
const SAMPLE_IFC_NAME = 'column-straight-rectangle-tessellation.ifc'
const SAMPLE_IFC_COPY_URL = '/assets/ifc/column-straight-rectangle-tessellation-copy.ifc'
const SAMPLE_IFC_COPY_NAME = 'column-straight-rectangle-tessellation-copy.ifc'
const LOCAL_WASM_PATH = '/node_modules/web-ifc/'

interface IfcInput {
  bytes: Uint8Array
  fileName: string
  modelId: string
  modelLabel: string
  source: 'bundled' | 'local'
}

interface LoadedModelMetadata {
  categoryItems: Record<string, number[]>
  modelId: string
  modelLabel: string
}

export class IfcModelLoader {
  readonly components = new Components()
  readonly fragments = this.components.get(FragmentsManager)
  readonly ifcLoader = this.components.get(IfcLoader)
  private readonly modelMetadata = new Map<string, LoadedModelMetadata>()

  async setup(): Promise<void> {
    const workerUrl = await FragmentsManager.getWorker()
    this.fragments.init(workerUrl)

    await this.ifcLoader.setup({
      autoSetWasm: false,
      wasm: {
        absolute: false,
        logLevel: 0 as never,
        path: LOCAL_WASM_PATH,
      },
    })
  }

  async loadBundledSample(): Promise<FragmentsModel> {
    setIfcLoadSummary({
      fileName: SAMPLE_IFC_NAME,
      source: 'bundled',
      status: 'loading',
      statusDetail: 'Fetching bundled IFC sample and initializing parser...',
    })

    const response = await fetch(SAMPLE_IFC_URL)

    if (!response.ok) {
      throw new Error(`Failed to fetch IFC file: ${response.status}`)
    }

    const bytes = new Uint8Array(await response.arrayBuffer())

    return this.loadFromInput({
      bytes,
      fileName: SAMPLE_IFC_NAME,
      modelId: normalizeModelId(SAMPLE_IFC_NAME),
      modelLabel: SAMPLE_IFC_NAME,
      source: 'bundled',
    })
  }

  async loadBundledSampleCopy(): Promise<FragmentsModel> {
    setIfcLoadSummary({
      fileName: SAMPLE_IFC_COPY_NAME,
      source: 'bundled',
      status: 'loading',
      statusDetail: 'Fetching bundled IFC sample copy and initializing parser...',
    })

    const response = await fetch(SAMPLE_IFC_COPY_URL)

    if (!response.ok) {
      throw new Error(`Failed to fetch IFC file: ${response.status}`)
    }

    const bytes = new Uint8Array(await response.arrayBuffer())

    return this.loadFromInput({
      bytes,
      fileName: SAMPLE_IFC_COPY_NAME,
      modelId: normalizeModelId(SAMPLE_IFC_COPY_NAME),
      modelLabel: SAMPLE_IFC_COPY_NAME,
      source: 'bundled',
    })
  }

  async loadLocalFile(file: File): Promise<FragmentsModel> {
    setIfcLoadSummary({
      fileName: file.name,
      source: 'local',
      status: 'loading',
      statusDetail: 'Reading local IFC file from file picker...',
    })

    const bytes = new Uint8Array(await file.arrayBuffer())

    return this.loadFromInput({
      bytes,
      fileName: file.name,
      modelId: normalizeModelId(file.name),
      modelLabel: file.name,
      source: 'local',
    })
  }

  private async loadFromInput(input: IfcInput): Promise<FragmentsModel> {
    setIfcLoadSummary({
      categoryCount: 0,
      categoryPreview: [],
      fileName: input.fileName,
      guidCount: 0,
      itemCount: 0,
      source: input.source,
      spatialNodeCount: 0,
      status: 'loading',
      statusDetail: 'Converting IFC into fragments and attaching it to the scene...',
    })

    const model = await this.ifcLoader.load(input.bytes, true, input.modelId)

    const [spatialStructure, categories, guids, localIds, categoryItems] = await Promise.all([
      model.getSpatialStructure(),
      model.getCategories(),
      model.getGuids(),
      model.getLocalIds(),
      model.getItemsOfCategories([/.*/]),
    ])

    upsertFederatedModelSummary({
      categoryCount: categories.length,
      guidCount: guids.length,
      itemCount: localIds.length,
      modelId: input.modelId,
      modelLabel: input.modelLabel,
      opacity: 1,
      source: input.source,
      visible: true,
    })
    upsertCategoryLayerSummaries(input.modelId, input.modelLabel, categoryItems)
    setTelemetryCategoryLookup(input.modelId, input.modelLabel, categoryItems)
    upsertSpatialTreeSummary(
      input.modelId,
      buildSpatialTreeSummary(input.modelId, input.modelLabel, spatialStructure),
    )
    this.modelMetadata.set(input.modelId, {
      categoryItems,
      modelId: input.modelId,
      modelLabel: input.modelLabel,
    })
    setIfcLoadSummary({
      categoryCount: categories.length,
      categoryPreview: categories.slice(0, 5),
      fileName: input.fileName,
      guidCount: guids.length,
      itemCount: localIds.length,
      source: input.source,
      spatialNodeCount: countSpatialNodes(spatialStructure),
      status: 'ready',
      statusDetail: 'IFC parsed successfully. Scene is now rendered from BIM export data.',
    })

    return model
  }

  dispose(): void {
    this.components.dispose()
  }

  removeModel(modelId: string): void {
    this.modelMetadata.delete(modelId)
    removeFederatedModelSummary(modelId)
    removeTelemetryCategoryLookup(modelId)
    removeSpatialTreeSummary(modelId)
  }

  async getItemDetails(
    model: FragmentsModel,
    localId: number,
    itemId: number,
  ): Promise<{
    attributes: Array<{ label: string; value: string }>
    category: string
    guid: string
    itemId: number
    localId: number
    modelId: string
    modelLabel: string
  }> {
    const metadata = this.modelMetadata.get(model.modelId)
    const [guid, categories, itemData] = await Promise.all([
      model.getGuidsByLocalIds([localId]),
      metadata ? Promise.resolve(metadata.categoryItems) : model.getItemsOfCategories([/.*/]),
      model.getItemsData([localId], {
        attributesDefault: true,
      }),
    ])

    const category = findCategoryForLocalId(categories, localId) ?? 'Unknown category'
    const [rawGuid] = guid
    const [rawItemData] = itemData

    return {
      attributes: extractAttributes(rawItemData),
      category,
      guid: rawGuid ?? 'GUID unavailable',
      itemId,
      localId,
      modelId: model.modelId,
      modelLabel: this.getModelLabel(model.modelId),
    }
  }

  getCategoryLocalIds(modelId: string, category: string): number[] {
    return [...(this.modelMetadata.get(modelId)?.categoryItems[category] ?? [])]
  }

  getModelLabel(modelId: string): string {
    return (
      getFederatedModelSummary(modelId)?.modelLabel ??
      this.modelMetadata.get(modelId)?.modelLabel ??
      modelId
    )
  }

  renameModel(modelId: string, modelLabel: string): void {
    const metadata = this.modelMetadata.get(modelId)

    if (!metadata) {
      return
    }

    this.modelMetadata.set(modelId, {
      ...metadata,
      modelLabel,
    })
  }
}

function countSpatialNodes(node: SpatialTreeItem): number {
  const children = Array.isArray(node.children) ? node.children : []

  return 1 + children.reduce((total, child) => total + countSpatialNodes(child), 0)
}

function buildSpatialTreeSummary(
  modelId: string,
  modelLabel: string,
  node: SpatialTreeItem,
): SpatialTreeNodeSummary[] {
  return [toSpatialTreeSummaryNode(modelId, modelLabel, node)]
}

function toSpatialTreeSummaryNode(
  modelId: string,
  modelLabel: string,
  node: SpatialTreeItem,
): SpatialTreeNodeSummary {
  return {
    category: node.category ?? 'Unknown',
    children: (node.children ?? []).map((child) =>
      toSpatialTreeSummaryNode(modelId, modelLabel, child),
    ),
    localId: node.localId,
    modelId,
    modelLabel,
  }
}

function findCategoryForLocalId(
  categories: Record<string, number[]>,
  localId: number,
): string | null {
  for (const [category, localIds] of Object.entries(categories)) {
    if (localIds.includes(localId)) {
      return category
    }
  }

  return null
}

function extractAttributes(itemData: ItemData | undefined): Array<{ label: string; value: string }> {
  if (!itemData) {
    return []
  }

  const ignoredKeys = new Set(['IsDefinedBy', 'DefinesOccurrence', 'HasAssociations'])
  const attributes: Array<{ label: string; value: string }> = []

  for (const [key, value] of Object.entries(itemData)) {
    if (ignoredKeys.has(key) || Array.isArray(value)) {
      continue
    }

    attributes.push({
      label: key,
      value: stringifyAttributeValue(value),
    })
  }

  return attributes.slice(0, 8)
}

function stringifyAttributeValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—'
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return '[object]'
    }
  }

  return String(value)
}

function normalizeModelId(fileName: string): string {
  return fileName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}
