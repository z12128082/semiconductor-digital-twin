import {
  getCategoryLayerSummaries,
  getFederatedModelSummaries,
  getTelemetryCategorySummaries,
  getTelemetryForItem,
  getTelemetryHistoryForItem,
  getTelemetryOverviewSummary,
  getSpatialTreeSummary,
  getSelectedSpatialTreeNodeSummary,
  getSelectedIfcItemSummary,
  getIfcLoadSummary,
  subscribeTelemetry,
  subscribeLayerState,
  subscribeSelectedSpatialTreeNodeSummary,
  subscribeSpatialTreeSummary,
  subscribeSelectedIfcItemSummary,
  subscribeIfcLoadSummary,
  resetLayerState,
  type CategoryLayerSummary,
  type FederatedModelSummary,
  type IfcLoadSummary,
  type SelectedSpatialTreeNodeSummary,
  type SpatialTreeNodeSummary,
  type SelectedIfcItemSummary,
} from './state'

export function createAppShell(root: HTMLDivElement): {
  onCategoryLayerChange: (
    handler: (payload: { category: string; modelId: string; visible: boolean }) => void,
  ) => () => void
  onCategoryLayerIsolate: (
    handler: (payload: { category: string; modelId: string }) => void,
  ) => () => void
  onCategoryLayerOpacityChange: (
    handler: (payload: { category: string; modelId: string; opacity: number }) => void,
  ) => () => void
  dispose: () => void
  ifcFileInput: HTMLInputElement
  onFederatedModelIsolate: (
    handler: (payload: { modelId: string }) => void,
  ) => () => void
  onFederatedModelRename: (
    handler: (payload: { modelId: string; modelLabel: string }) => void,
  ) => () => void
  onFederatedModelFit: (
    handler: (payload: { modelId: string }) => void,
  ) => () => void
  onFederatedModelOpacityChange: (
    handler: (payload: { modelId: string; opacity: number }) => void,
  ) => () => void
  onFederatedModelVisibilityChange: (
    handler: (payload: { modelId: string; visible: boolean }) => void,
  ) => () => void
  onFederatedModelRemove: (
    handler: (payload: { modelId: string }) => void,
  ) => () => void
  onResetLayers: (handler: () => void) => () => void
  onSpatialTreeNodeSelect: (
    handler: (payload: { category: string; localId: number | null; modelId: string | null }) => void,
  ) => () => void
  sceneHost: HTMLDivElement
} {
  root.innerHTML = `
    <div class="app-shell">
      <div class="app-frame">
        <header class="topbar">
          <div class="topbar-badge">Semiconductor Digital Twin Demo</div>
        </header>

        <main class="main-layout">
          <section class="scene-panel">
            <div class="scene-host" id="scene-host" aria-label="Digital twin scene"></div>

            <div class="scene-overlay">
              <div class="viewer-hud">
                <strong>Fab Ops Viewer</strong>
                <span class="viewer-hud-dot"></span>
                <span>IFC + telemetry</span>
              </div>
              <div class="viewer-dock">
                <span class="status-chip"><strong>IFC</strong> Ready</span>
                <span class="status-chip"><strong>Mock</strong> Live</span>
              </div>
            </div>
          </section>

          <aside class="sidebar">
            <nav class="sidebar-tabs" id="sidebar-tabs">
              <button class="sidebar-tab" data-tab="ops" data-active="true" type="button">Ops</button>
              <button class="sidebar-tab" data-tab="item" data-active="false" type="button">Item</button>
              <button class="sidebar-tab" data-tab="tree" data-active="false" type="button">Tree</button>
            </nav>

            <section class="panel panel-compact sidebar-panel" data-panel="ops" data-visible="true">
              <div class="panel-header-row">
                <h2>Operations</h2>
                <div class="ifc-actions">
                  <label class="ifc-picker" for="ifc-file-input">Choose IFC file</label>
                  <input id="ifc-file-input" type="file" accept=".ifc" multiple />
                </div>
              </div>

              <div class="ifc-status">
                <span class="ifc-status-badge" id="ifc-status-badge">Idle</span>
                <p id="ifc-status-detail"></p>
              </div>
              <div class="telemetry-stream">
                <span class="telemetry-pill" data-status="idle" id="telemetry-stream-state">IDLE</span>
                <span class="telemetry-meta" id="telemetry-last-updated">Last update: —</span>
                <span class="telemetry-meta" id="telemetry-stale-seconds">Stale: 0s</span>
              </div>
              <div class="ops-meta-row">
                <span class="tree-count" id="loaded-model-count">0 models loaded</span>
              </div>
              <div class="ops-grid">
                <div class="metric-card compact">
                  <span>Live items</span>
                  <strong id="telemetry-live-count">0</strong>
                </div>
                <div class="metric-card compact">
                  <span>Normal</span>
                  <strong id="telemetry-normal-count">0</strong>
                </div>
                <div class="metric-card compact warning">
                  <span>Warning</span>
                  <strong id="telemetry-warning-count">0</strong>
                </div>
                <div class="metric-card compact alert">
                  <span>Alert</span>
                  <strong id="telemetry-alert-count">0</strong>
                </div>
              </div>
              <dl class="ifc-summary compact-summary" id="ifc-summary">
                <div><dt>File</dt><dd id="ifc-file-name"></dd></div>
                <div><dt>Source</dt><dd id="ifc-source"></dd></div>
                <div><dt>Nodes</dt><dd id="ifc-spatial-count"></dd></div>
                <div><dt>Items</dt><dd id="ifc-item-count"></dd></div>
                <div><dt>GUIDs</dt><dd id="ifc-guid-count"></dd></div>
                <div><dt>Categories</dt><dd id="ifc-category-count"></dd></div>
              </dl>
              <div class="alert-summary">
                <div class="panel-header-row compact-row">
                  <h3>Alert Summary</h3>
                  <span class="tree-count">By category</span>
                </div>
                <div class="alert-summary-empty" id="alert-summary-empty"></div>
                <div class="alert-summary-list" id="alert-summary-list"></div>
              </div>
            </section>

            <section class="panel panel-compact sidebar-panel" data-panel="item" data-visible="false">
              <div class="panel-header-row">
                <h3 id="selected-ifc-title">Selected IFC Item</h3>
                <span class="telemetry-pill" data-status="idle" id="selected-ifc-status">Idle</span>
              </div>
              <div class="selected-ifc-empty" id="selected-ifc-empty"></div>
              <dl class="ifc-summary compact-summary">
                <div><dt>Local ID</dt><dd id="selected-ifc-local-id"></dd></div>
                <div><dt>Item ID</dt><dd id="selected-ifc-item-id"></dd></div>
                <div><dt>Category</dt><dd id="selected-ifc-category"></dd></div>
                <div><dt>GUID</dt><dd id="selected-ifc-guid"></dd></div>
                <div><dt>Updated</dt><dd id="selected-ifc-updated"></dd></div>
                <div><dt>Power</dt><dd id="selected-ifc-power"></dd></div>
              </dl>
              <div class="telemetry-grid">
                <div class="telemetry-card">
                  <span>Utilization</span>
                  <strong id="selected-ifc-utilization">—</strong>
                </div>
                <div class="telemetry-card">
                  <span>Temp</span>
                  <strong id="selected-ifc-temperature">—</strong>
                </div>
                <div class="telemetry-card">
                  <span>Pressure</span>
                  <strong id="selected-ifc-pressure">—</strong>
                </div>
              </div>
              <div class="telemetry-trend">
                <div class="panel-header-row compact-row">
                  <h3>Last 30s</h3>
                  <span class="tree-count">Utilization / Temp</span>
                </div>
                <div class="telemetry-trend-empty" id="telemetry-trend-empty"></div>
                <div class="telemetry-trend-chart" id="telemetry-trend-chart"></div>
              </div>
              <ul class="selected-ifc-attributes" id="selected-ifc-attributes"></ul>
            </section>

            <section class="panel panel-compact panel-grow sidebar-panel" data-panel="tree" data-visible="false">
              <div class="panel-header-row">
                <h3>Spatial Tree</h3>
                <span class="tree-count" id="spatial-tree-count">0 nodes</span>
              </div>
              <div class="layer-controls">
                <div class="layer-section">
                  <div class="panel-header-row compact-row">
                    <h3>Models</h3>
                    <div class="layer-actions">
                      <button class="layer-action" data-layer-action="reset" type="button">Reset</button>
                    </div>
                  </div>
                  <div class="layer-empty" id="model-layer-empty"></div>
                  <div class="layer-list" id="model-layer-list"></div>
                </div>
                <div class="layer-section">
                  <div class="panel-header-row compact-row">
                    <h3>Categories</h3>
                    <input class="layer-search" id="category-layer-search" placeholder="Search category" type="search" />
                  </div>
                  <div class="layer-empty" id="category-layer-empty"></div>
                  <div class="layer-list" id="category-layer-list"></div>
                </div>
              </div>
              <div class="spatial-tree-shell">
                <div class="spatial-tree-empty" id="spatial-tree-empty"></div>
                <div class="spatial-tree" id="spatial-tree"></div>
              </div>
            </section>
          </aside>
        </main>
      </div>
    </div>
  `

  const sceneHost = root.querySelector<HTMLDivElement>('#scene-host')

  if (!sceneHost) {
    throw new Error('Missing scene host element.')
  }

  const statusBadge = root.querySelector<HTMLSpanElement>('#ifc-status-badge')
  const statusDetail = root.querySelector<HTMLParagraphElement>('#ifc-status-detail')
  const ifcFileInput = root.querySelector<HTMLInputElement>('#ifc-file-input')
  const sidebarTabs = root.querySelector<HTMLElement>('#sidebar-tabs')
  const fileName = root.querySelector<HTMLElement>('#ifc-file-name')
  const source = root.querySelector<HTMLElement>('#ifc-source')
  const spatialCount = root.querySelector<HTMLElement>('#ifc-spatial-count')
  const itemCount = root.querySelector<HTMLElement>('#ifc-item-count')
  const guidCount = root.querySelector<HTMLElement>('#ifc-guid-count')
  const categoryCount = root.querySelector<HTMLElement>('#ifc-category-count')
  const telemetryLiveCount = root.querySelector<HTMLElement>('#telemetry-live-count')
  const telemetryNormalCount = root.querySelector<HTMLElement>('#telemetry-normal-count')
  const telemetryWarningCount = root.querySelector<HTMLElement>('#telemetry-warning-count')
  const telemetryAlertCount = root.querySelector<HTMLElement>('#telemetry-alert-count')
  const loadedModelCount = root.querySelector<HTMLElement>('#loaded-model-count')
  const telemetryStreamState = root.querySelector<HTMLElement>('#telemetry-stream-state')
  const telemetryLastUpdated = root.querySelector<HTMLElement>('#telemetry-last-updated')
  const telemetryStaleSeconds = root.querySelector<HTMLElement>('#telemetry-stale-seconds')
  const alertSummaryEmpty = root.querySelector<HTMLElement>('#alert-summary-empty')
  const alertSummaryList = root.querySelector<HTMLElement>('#alert-summary-list')
  const selectedTitle = root.querySelector<HTMLElement>('#selected-ifc-title')
  const selectedEmpty = root.querySelector<HTMLElement>('#selected-ifc-empty')
  const selectedStatus = root.querySelector<HTMLElement>('#selected-ifc-status')
  const selectedLocalId = root.querySelector<HTMLElement>('#selected-ifc-local-id')
  const selectedItemId = root.querySelector<HTMLElement>('#selected-ifc-item-id')
  const selectedCategory = root.querySelector<HTMLElement>('#selected-ifc-category')
  const selectedGuid = root.querySelector<HTMLElement>('#selected-ifc-guid')
  const selectedUpdated = root.querySelector<HTMLElement>('#selected-ifc-updated')
  const selectedPower = root.querySelector<HTMLElement>('#selected-ifc-power')
  const selectedUtilization = root.querySelector<HTMLElement>('#selected-ifc-utilization')
  const selectedTemperature = root.querySelector<HTMLElement>('#selected-ifc-temperature')
  const selectedPressure = root.querySelector<HTMLElement>('#selected-ifc-pressure')
  const telemetryTrendEmpty = root.querySelector<HTMLElement>('#telemetry-trend-empty')
  const telemetryTrendChart = root.querySelector<HTMLElement>('#telemetry-trend-chart')
  const selectedAttributes = root.querySelector<HTMLUListElement>('#selected-ifc-attributes')
  const modelLayerEmpty = root.querySelector<HTMLElement>('#model-layer-empty')
  const modelLayerList = root.querySelector<HTMLElement>('#model-layer-list')
  const categoryLayerEmpty = root.querySelector<HTMLElement>('#category-layer-empty')
  const categoryLayerList = root.querySelector<HTMLElement>('#category-layer-list')
  const categoryLayerSearch = root.querySelector<HTMLInputElement>('#category-layer-search')
  const spatialTreeEmpty = root.querySelector<HTMLElement>('#spatial-tree-empty')
  const spatialTreeCount = root.querySelector<HTMLElement>('#spatial-tree-count')
  const spatialTree = root.querySelector<HTMLElement>('#spatial-tree')

  if (
    !statusBadge ||
    !statusDetail ||
    !ifcFileInput ||
    !sidebarTabs ||
    !fileName ||
    !source ||
    !spatialCount ||
    !itemCount ||
    !guidCount ||
    !categoryCount ||
    !telemetryLiveCount ||
    !telemetryNormalCount ||
    !telemetryWarningCount ||
    !telemetryAlertCount ||
    !loadedModelCount ||
    !telemetryStreamState ||
    !telemetryLastUpdated ||
    !telemetryStaleSeconds ||
    !alertSummaryEmpty ||
    !alertSummaryList ||
    !selectedTitle ||
    !selectedEmpty ||
    !selectedStatus ||
    !selectedLocalId ||
    !selectedItemId ||
    !selectedCategory ||
    !selectedGuid ||
    !selectedUpdated ||
    !selectedPower ||
    !selectedUtilization ||
    !selectedTemperature ||
    !selectedPressure ||
    !telemetryTrendEmpty ||
    !telemetryTrendChart ||
    !selectedAttributes ||
    !modelLayerEmpty ||
    !modelLayerList ||
    !categoryLayerEmpty ||
    !categoryLayerList ||
    !categoryLayerSearch ||
    !spatialTreeEmpty ||
    !spatialTreeCount ||
    !spatialTree
  ) {
    throw new Error('Missing IFC status UI elements.')
  }

  const renderSummary = (summary: IfcLoadSummary): void => {
    statusBadge.textContent = summary.status.toUpperCase()
    statusBadge.dataset.status = summary.status
    statusDetail.textContent = summary.statusDetail
    fileName.textContent = summary.fileName
    source.textContent = summary.source === 'local' ? 'Local file picker' : 'Bundled sample'
    spatialCount.textContent = String(summary.spatialNodeCount)
    itemCount.textContent = String(summary.itemCount)
    guidCount.textContent = String(summary.guidCount)
    categoryCount.textContent = String(summary.categoryCount)
    loadedModelCount.textContent = `${summary.loadedModelCount} models loaded`
  }

  renderSummary(getIfcLoadSummary())
  const unsubscribe = subscribeIfcLoadSummary(renderSummary)

  const renderSelectedItem = (summary: SelectedIfcItemSummary): void => {
    const telemetry = getTelemetryForItem(summary.modelId, summary.localId)
    const history = getTelemetryHistoryForItem(summary.modelId, summary.localId)
    selectedTitle.textContent = summary.title
    selectedEmpty.textContent =
      summary.status === 'empty' ? 'Click any IFC element to inspect its BIM data.' : ''
    selectedStatus.textContent = telemetry ? telemetry.status.toUpperCase() : 'IDLE'
    selectedStatus.dataset.status = telemetry?.status ?? 'idle'
    selectedLocalId.textContent =
      summary.localId === null ? '—' : String(summary.localId)
    selectedItemId.textContent = summary.itemId === null ? '—' : String(summary.itemId)
    selectedCategory.textContent = summary.category
    selectedGuid.textContent = summary.guid
    selectedUpdated.textContent = telemetry?.lastUpdated ?? '—'
    selectedPower.textContent = telemetry ? `${telemetry.powerKw} kW` : '—'
    selectedUtilization.textContent = telemetry ? `${telemetry.utilization}%` : '—'
    selectedTemperature.textContent = telemetry ? `${telemetry.temperatureC} C` : '—'
    selectedPressure.textContent = telemetry ? `${telemetry.pressureBar} bar` : '—'
    if (history.length < 2) {
      telemetryTrendEmpty.textContent = 'Waiting for telemetry history...'
      telemetryTrendChart.innerHTML = ''
    } else {
      telemetryTrendEmpty.textContent = ''
      telemetryTrendChart.innerHTML = renderTelemetryTrend(history)
    }
    selectedAttributes.innerHTML = summary.attributes
      .map(
        (attribute) =>
          `<li><strong>${attribute.label}</strong><span>${attribute.value}</span></li>`,
      )
      .join('')
  }

  renderSelectedItem(getSelectedIfcItemSummary())
  const unsubscribeSelection = subscribeSelectedIfcItemSummary(renderSelectedItem)
  const unsubscribeTelemetry = subscribeTelemetry(() => {
    const overview = getTelemetryOverviewSummary()
    const categorySummaries = getTelemetryCategorySummaries()
    telemetryLiveCount.textContent = String(overview.liveItemCount)
    telemetryNormalCount.textContent = String(overview.normalCount)
    telemetryWarningCount.textContent = String(overview.warningCount)
    telemetryAlertCount.textContent = String(overview.alertCount)
    telemetryStreamState.textContent = overview.streamState.toUpperCase()
    telemetryStreamState.dataset.status = overview.streamState
    telemetryLastUpdated.textContent = `Last update: ${overview.lastUpdated}`
    telemetryStaleSeconds.textContent = `Stale: ${overview.staleSeconds}s`
    if (categorySummaries.length === 0) {
      alertSummaryEmpty.textContent = 'No live category summary yet.'
      alertSummaryList.innerHTML = ''
    } else {
      alertSummaryEmpty.textContent = ''
      alertSummaryList.innerHTML = categorySummaries
        .slice(0, 4)
        .map(
          (summary) => `
            <div class="alert-summary-item">
              <div class="alert-summary-name">${summary.category}</div>
              <div class="alert-summary-badges">
                <span class="alert-badge normal">${summary.normalCount}</span>
                <span class="alert-badge warning">${summary.warningCount}</span>
                <span class="alert-badge alert">${summary.alertCount}</span>
              </div>
            </div>
          `,
        )
        .join('')
    }
    renderSelectedItem(getSelectedIfcItemSummary())
  })

  const renderLayerControls = (): void => {
    const models = getFederatedModelSummaries()
    const categories = getCategoryLayerSummaries().filter((layer) =>
      layer.category.toLowerCase().includes(categoryLayerSearch.value.trim().toLowerCase()),
    )

    if (models.length === 0) {
      modelLayerEmpty.textContent = 'No loaded IFC models yet.'
      modelLayerList.innerHTML = ''
    } else {
      modelLayerEmpty.textContent = ''
      modelLayerList.innerHTML = renderModelLayerControls(models)
    }

    if (categories.length === 0) {
      categoryLayerEmpty.textContent = 'No category layers yet.'
      categoryLayerList.innerHTML = ''
    } else {
      categoryLayerEmpty.textContent = ''
      categoryLayerList.innerHTML = renderCategoryLayerControls(categories)
    }
  }

  renderLayerControls()
  const unsubscribeLayers = subscribeLayerState(renderLayerControls)
  categoryLayerSearch.addEventListener('input', renderLayerControls)

  const renderSpatialTree = (tree: SpatialTreeNodeSummary[]): void => {
    if (tree.length === 0) {
      spatialTreeEmpty.textContent = 'Spatial hierarchy will appear after an IFC model is parsed.'
      spatialTree.innerHTML = ''
      spatialTreeCount.textContent = '0 nodes'
      return
    }

    spatialTreeEmpty.textContent = ''
    spatialTreeCount.textContent = `${countSpatialTreeNodes(tree)} nodes`
    spatialTree.innerHTML = renderSpatialTreeNodes(tree)
  }

  renderSpatialTree(getSpatialTreeSummary())
  const unsubscribeTree = subscribeSpatialTreeSummary(renderSpatialTree)

  const renderSelectedSpatialTreeNode = (
    selected: SelectedSpatialTreeNodeSummary,
  ): void => {
    const labels = Array.from(
      root.querySelectorAll<HTMLElement>('.spatial-tree-label'),
    )

    for (const label of labels) {
      const modelId = label.dataset.modelId ?? null
      const localId =
        label.dataset.localId === 'null' || !label.dataset.localId
          ? null
          : Number(label.dataset.localId)
      label.dataset.active =
        localId === selected.localId && modelId === selected.modelId ? 'true' : 'false'
    }
  }

  renderSelectedSpatialTreeNode(getSelectedSpatialTreeNodeSummary())
  const unsubscribeSelectedTree = subscribeSelectedSpatialTreeNodeSummary(
    renderSelectedSpatialTreeNode,
  )

  const onSpatialTreeNodeSelect = (
    handler: (payload: { category: string; localId: number | null; modelId: string | null }) => void,
  ): (() => void) => {
    const listener = (event: Event): void => {
      const target = resolveEventElement(event.target)

      if (!target) {
        return
      }

      const button = target.closest<HTMLElement>('.spatial-tree-label')

      if (!button) {
        return
      }

      handler({
        category: button.dataset.category ?? 'Unknown',
        localId:
          button.dataset.localId === 'null' || !button.dataset.localId
            ? null
            : Number(button.dataset.localId),
        modelId: button.dataset.modelId ?? null,
      })
    }

    spatialTree.addEventListener('click', listener)

    return () => {
      spatialTree.removeEventListener('click', listener)
    }
  }

  const onFederatedModelVisibilityChange = (
    handler: (payload: { modelId: string; visible: boolean }) => void,
  ): (() => void) => {
    const listener = (event: Event): void => {
      const target = event.target

      if (!(target instanceof HTMLInputElement)) {
        return
      }

      if (target.dataset.layerType !== 'model-visible' || !target.dataset.modelId) {
        return
      }

      handler({
        modelId: target.dataset.modelId,
        visible: target.checked,
      })
    }

    modelLayerList.addEventListener('change', listener)

    return () => {
      modelLayerList.removeEventListener('change', listener)
    }
  }

  const onFederatedModelIsolate = (
    handler: (payload: { modelId: string }) => void,
  ): (() => void) => {
    const listener = (event: Event): void => {
      const target = resolveEventElement(event.target)

      if (!target) {
        return
      }

      const button = target.closest<HTMLElement>('[data-layer-action="isolate-model"]')

      if (!button || !button.dataset.modelId) {
        return
      }

      handler({
        modelId: button.dataset.modelId,
      })
    }

    modelLayerList.addEventListener('click', listener)

    return () => {
      modelLayerList.removeEventListener('click', listener)
    }
  }

  const onFederatedModelRename = (
    handler: (payload: { modelId: string; modelLabel: string }) => void,
  ): (() => void) => {
    const listener = (event: Event): void => {
      const target = resolveEventElement(event.target)

      if (!target) {
        return
      }

      const button = target.closest<HTMLElement>('[data-layer-action="rename-model"]')

      if (!button || !button.dataset.modelId) {
        return
      }

      const container = button.closest<HTMLElement>('.layer-item')
      const input = container?.querySelector<HTMLInputElement>('input[data-layer-type="model-label"]')

      if (!input) {
        return
      }

      handler({
        modelId: button.dataset.modelId,
        modelLabel: input.value.trim() || button.dataset.modelId,
      })
    }

    modelLayerList.addEventListener('click', listener)

    return () => {
      modelLayerList.removeEventListener('click', listener)
    }
  }

  const onFederatedModelFit = (
    handler: (payload: { modelId: string }) => void,
  ): (() => void) => {
    const listener = (event: Event): void => {
      const target = resolveEventElement(event.target)

      if (!target) {
        return
      }

      const button = target.closest<HTMLElement>('[data-layer-action="fit-model"]')

      if (!button || !button.dataset.modelId) {
        return
      }

      handler({
        modelId: button.dataset.modelId,
      })
    }

    modelLayerList.addEventListener('click', listener)

    return () => {
      modelLayerList.removeEventListener('click', listener)
    }
  }

  const onFederatedModelOpacityChange = (
    handler: (payload: { modelId: string; opacity: number }) => void,
  ): (() => void) => {
    const listener = (event: Event): void => {
      const target = event.target

      if (!(target instanceof HTMLInputElement)) {
        return
      }

      if (target.dataset.layerType !== 'model-opacity' || !target.dataset.modelId) {
        return
      }

      handler({
        modelId: target.dataset.modelId,
        opacity: Number(target.value),
      })
    }

    modelLayerList.addEventListener('input', listener)

    return () => {
      modelLayerList.removeEventListener('input', listener)
    }
  }

  const onCategoryLayerChange = (
    handler: (payload: { category: string; modelId: string; visible: boolean }) => void,
  ): (() => void) => {
    const listener = (event: Event): void => {
      const target = event.target

      if (!(target instanceof HTMLInputElement)) {
        return
      }

      if (
        target.dataset.layerType !== 'category-visible' ||
        !target.dataset.modelId ||
        !target.dataset.category
      ) {
        return
      }

      handler({
        category: target.dataset.category,
        modelId: target.dataset.modelId,
        visible: target.checked,
      })
    }

    categoryLayerList.addEventListener('change', listener)

    return () => {
      categoryLayerList.removeEventListener('change', listener)
    }
  }

  const onCategoryLayerOpacityChange = (
    handler: (payload: { category: string; modelId: string; opacity: number }) => void,
  ): (() => void) => {
    const listener = (event: Event): void => {
      const target = event.target

      if (!(target instanceof HTMLInputElement)) {
        return
      }

      if (
        target.dataset.layerType !== 'category-opacity' ||
        !target.dataset.modelId ||
        !target.dataset.category
      ) {
        return
      }

      handler({
        category: target.dataset.category,
        modelId: target.dataset.modelId,
        opacity: Number(target.value),
      })
    }

    categoryLayerList.addEventListener('input', listener)

    return () => {
      categoryLayerList.removeEventListener('input', listener)
    }
  }

  const onCategoryLayerIsolate = (
    handler: (payload: { category: string; modelId: string }) => void,
  ): (() => void) => {
    const listener = (event: Event): void => {
      const target = resolveEventElement(event.target)

      if (!target) {
        return
      }

      const button = target.closest<HTMLElement>('[data-layer-action="isolate-category"]')

      if (!button || !button.dataset.modelId || !button.dataset.category) {
        return
      }

      handler({
        category: button.dataset.category,
        modelId: button.dataset.modelId,
      })
    }

    categoryLayerList.addEventListener('click', listener)

    return () => {
      categoryLayerList.removeEventListener('click', listener)
    }
  }

  const onResetLayers = (handler: () => void): (() => void) => {
    const listener = (event: Event): void => {
      const target = resolveEventElement(event.target)

      if (!target) {
        return
      }

      const button = target.closest<HTMLElement>('[data-layer-action="reset"]')

      if (!button) {
        return
      }

      resetLayerState()
      handler()
    }

    root.addEventListener('click', listener)

    return () => {
      root.removeEventListener('click', listener)
    }
  }

  const onFederatedModelRemove = (
    handler: (payload: { modelId: string }) => void,
  ): (() => void) => {
    const listener = (event: Event): void => {
      const target = resolveEventElement(event.target)

      if (!target) {
        return
      }

      const button = target.closest<HTMLElement>('[data-layer-action="remove-model"]')

      if (!button || !button.dataset.modelId) {
        return
      }

      handler({
        modelId: button.dataset.modelId,
      })
    }

    modelLayerList.addEventListener('click', listener)

    return () => {
      modelLayerList.removeEventListener('click', listener)
    }
  }

  const switchSidebarTab = (tab: 'item' | 'ops' | 'tree'): void => {
    const tabs = Array.from(root.querySelectorAll<HTMLElement>('.sidebar-tab'))
    const panels = Array.from(root.querySelectorAll<HTMLElement>('.sidebar-panel'))

    for (const button of tabs) {
      button.dataset.active = button.dataset.tab === tab ? 'true' : 'false'
    }

    for (const panel of panels) {
      panel.dataset.visible = panel.dataset.panel === tab ? 'true' : 'false'
    }
  }

  const sidebarTabListener = (event: Event): void => {
    const target = resolveEventElement(event.target)

    if (!target) {
      return
    }

    const button = target.closest<HTMLElement>('.sidebar-tab')

    if (!button) {
      return
    }

    const nextTab = button.dataset.tab

    if (nextTab === 'ops' || nextTab === 'item' || nextTab === 'tree') {
      switchSidebarTab(nextTab)
    }
  }

  sidebarTabs.addEventListener('click', sidebarTabListener)

  return {
    dispose: () => {
      unsubscribe()
      unsubscribeSelection()
      unsubscribeTelemetry()
      unsubscribeLayers()
      unsubscribeTree()
      unsubscribeSelectedTree()
      categoryLayerSearch.removeEventListener('input', renderLayerControls)
      sidebarTabs.removeEventListener('click', sidebarTabListener)
    },
    onCategoryLayerChange,
    onCategoryLayerIsolate,
    onCategoryLayerOpacityChange,
    ifcFileInput,
    onFederatedModelFit,
    onFederatedModelIsolate,
    onFederatedModelOpacityChange,
    onFederatedModelRename,
    onFederatedModelRemove,
    onFederatedModelVisibilityChange,
    onResetLayers,
    onSpatialTreeNodeSelect,
    sceneHost,
  }
}

function countSpatialTreeNodes(nodes: SpatialTreeNodeSummary[]): number {
  return nodes.reduce(
    (total, node) => total + 1 + countSpatialTreeNodes(node.children),
    0,
  )
}

function renderSpatialTreeNodes(
  nodes: SpatialTreeNodeSummary[],
  depth = 0,
): string {
  return nodes
    .map((node) => {
      const indent = depth * 16
      const label = node.localId === null ? node.category : `${node.category} (#${node.localId})`
      const children =
        node.children.length > 0 ? renderSpatialTreeNodes(node.children, depth + 1) : ''

      return `
        <div class="spatial-tree-node" style="--depth:${indent}px">
          <button
            class="spatial-tree-label"
            data-active="false"
            data-category="${node.category}"
            data-local-id="${node.localId === null ? 'null' : String(node.localId)}"
            data-model-id="${node.modelId}"
            type="button"
          >
            ${node.modelLabel} / ${label}
          </button>
          ${children}
        </div>
      `
    })
    .join('')
}

function renderModelLayerControls(models: FederatedModelSummary[]): string {
  return models
    .map(
      (model) => `
        <div class="layer-item">
          <div class="layer-item-head">
            <label class="layer-toggle grow">
              <input
                data-layer-type="model-visible"
                data-model-id="${model.modelId}"
                type="checkbox"
                ${model.visible ? 'checked' : ''}
              />
              <input
                class="layer-rename"
                data-layer-type="model-label"
                data-model-id="${model.modelId}"
                type="text"
                value="${model.modelLabel}"
              />
            </label>
            <div class="layer-inline-actions">
              <span class="layer-count">${model.itemCount} items</span>
              <button class="layer-action" data-layer-action="rename-model" data-model-id="${model.modelId}" type="button">Save</button>
              <button class="layer-action" data-layer-action="fit-model" data-model-id="${model.modelId}" type="button">Fit</button>
              <button class="layer-action" data-layer-action="isolate-model" data-model-id="${model.modelId}" type="button">Isolate</button>
              <button class="layer-action danger" data-layer-action="remove-model" data-model-id="${model.modelId}" type="button">Remove</button>
            </div>
          </div>
          <input
            class="layer-opacity"
            data-layer-type="model-opacity"
            data-model-id="${model.modelId}"
            max="1"
            min="0.15"
            step="0.05"
            type="range"
            value="${model.opacity}"
          />
        </div>
      `,
    )
    .join('')
}

function renderCategoryLayerControls(categories: CategoryLayerSummary[]): string {
  return categories
    .map(
      (layer) => `
        <div class="layer-item compact">
          <div class="layer-item-head">
            <label class="layer-toggle">
              <input
                data-layer-type="category-visible"
                data-model-id="${layer.modelId}"
                data-category="${layer.category}"
                type="checkbox"
                ${layer.visible ? 'checked' : ''}
              />
              <span>${layer.modelLabel} / ${layer.category}</span>
            </label>
            <div class="layer-inline-actions">
              <span class="layer-count">${layer.itemCount}</span>
              <button
                class="layer-action"
                data-layer-action="isolate-category"
                data-model-id="${layer.modelId}"
                data-category="${layer.category}"
                type="button"
              >
                Isolate
              </button>
            </div>
          </div>
          <input
            class="layer-opacity"
            data-layer-type="category-opacity"
            data-model-id="${layer.modelId}"
            data-category="${layer.category}"
            max="1"
            min="0.15"
            step="0.05"
            type="range"
            value="${layer.opacity}"
          />
        </div>
      `,
    )
    .join('')
}

function renderTelemetryTrend(
  history: Array<{ temperatureC: number; utilization: number }>,
): string {
  const width = 300
  const height = 92
  const padding = 10
  const usableWidth = width - padding * 2
  const usableHeight = height - padding * 2

  const utilizationValues = history.map((point) => point.utilization)
  const temperatureValues = history.map((point) => point.temperatureC)

  const utilizationPath = buildSparklinePath(
    utilizationValues,
    width,
    height,
    padding,
    0,
    100,
  )
  const temperaturePath = buildSparklinePath(
    temperatureValues,
    width,
    height,
    padding,
    Math.min(...temperatureValues) - 1,
    Math.max(...temperatureValues) + 1,
  )

  const gridLine = `<line x1="${padding}" y1="${padding + usableHeight / 2}" x2="${padding + usableWidth}" y2="${padding + usableHeight / 2}" />`

  return `
    <svg viewBox="0 0 ${width} ${height}" class="telemetry-trend-svg" role="img" aria-label="Utilization and temperature trends">
      <g class="telemetry-grid-lines">${gridLine}</g>
      <path class="telemetry-line utilization" d="${utilizationPath}" />
      <path class="telemetry-line temperature" d="${temperaturePath}" />
    </svg>
  `
}

function resolveEventElement(target: EventTarget | null): HTMLElement | null {
  if (!target) {
    return null
  }

  if (target instanceof HTMLElement) {
    return target
  }

  if (target instanceof Node) {
    return target.parentElement
  }

  return null
}

function buildSparklinePath(
  values: number[],
  width: number,
  height: number,
  padding: number,
  minValue: number,
  maxValue: number,
): string {
  if (values.length === 0) {
    return ''
  }

  const usableWidth = width - padding * 2
  const usableHeight = height - padding * 2
  const safeMax = maxValue === minValue ? maxValue + 1 : maxValue

  return values
    .map((value, index) => {
      const x = padding + (index / Math.max(1, values.length - 1)) * usableWidth
      const normalized = (value - minValue) / (safeMax - minValue)
      const y = padding + usableHeight - normalized * usableHeight

      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}
