import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  BoxGeometry,
  Clock,
  Color,
  DirectionalLight,
  Fog,
  GridHelper,
  Group,
  LineBasicMaterial,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  Vector3,
  Vector2,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  Event as ComponentsEvent,
  FastModelPicker,
} from '@thatopen/components'
import { RenderedFaces, type FragmentsModel } from '@thatopen/fragments'

import { IfcModelLoader } from './ifc-model-loader'
import { TelemetryMockController } from './telemetry-mock-controller'
import {
  getCategoryLayerSummaries,
  getFederatedModelSummaries,
  getTelemetryForItem,
  getTelemetryStatusGroupsByModel,
  getSelectedSpatialTreeNodeSummary,
  isolateCategoryLayer as isolateCategoryLayerState,
  isolateFederatedModel as isolateFederatedModelState,
  renameFederatedModel,
  resetLayerState as resetLayerStateStore,
  setCategoryLayerOpacity as setCategoryLayerOpacityState,
  setCategoryLayerVisibility as setCategoryLayerVisibilityState,
  setFederatedModelOpacity as setFederatedModelOpacityState,
  setFederatedModelVisibility as setFederatedModelVisibilityState,
  setIfcLoadSummary,
  setSelectedIfcItemSummary,
  setSelectedSpatialTreeNodeSummary,
} from '../state'

type DeviceStatus = 'normal' | 'warning' | 'alert'

interface DeviceMarker {
  readonly baseY: number
  readonly mesh: Mesh<BoxGeometry, MeshStandardMaterial>
  readonly pulseOffset: number
  readonly status: DeviceStatus
}

interface DeviceLayout {
  id: string
  position: [x: number, y: number, z: number]
  size: [x: number, y: number, z: number]
  status: DeviceStatus
}

const CAMERA_START = new Vector3(18, 16, 24)
const CAMERA_TARGET = new Vector3(0, 2.5, 0)
const STATUS_COLORS: Record<DeviceStatus, string> = {
  normal: '#69e8b2',
  warning: '#ffb454',
  alert: '#ff6b67',
}

const HIGHLIGHT_STYLE = {
  color: new Color('#6ee7ff'),
  opacity: 1,
  renderedFaces: RenderedFaces.TWO,
  transparent: false,
}

const NORMAL_COLOR = new Color('#69e8b2')
const WARNING_COLOR = new Color('#ffb454')
const ALERT_COLOR = new Color('#ff6b67')
const FEDERATED_GAP = 4

// lowest geometry of each bundled sample, in metres relative to grade
const BUNDLED_GROUND_Y: Record<string, number> = {
  'fab-building-ifc': -3.4,
  'fab-support-annex-ifc': -0.3,
}

const DEVICE_LAYOUT: DeviceLayout[] = [
  { id: 'litho-01', position: [-9, 1.5, -6], size: [3.2, 3, 2.4], status: 'normal' },
  { id: 'etch-01', position: [-4.5, 1.65, -6], size: [2.8, 3.3, 2.2], status: 'normal' },
  { id: 'cmp-01', position: [0, 1.45, -6], size: [3.1, 2.9, 2.3], status: 'warning' },
  { id: 'pvd-01', position: [4.5, 1.55, -6], size: [2.9, 3.1, 2.3], status: 'normal' },
  { id: 'cvd-01', position: [9, 1.55, -6], size: [3, 3.1, 2.2], status: 'alert' },
  { id: 'upw-loop-a', position: [-9, 1.25, 0], size: [2.8, 2.5, 2.1], status: 'normal' },
  { id: 'scrubber-02', position: [-4.5, 1.25, 0], size: [2.8, 2.5, 2.1], status: 'warning' },
  { id: 'ahu-03', position: [0, 1.35, 0], size: [3.4, 2.7, 2.1], status: 'normal' },
  { id: 'chiller-01', position: [4.5, 1.3, 0], size: [3.2, 2.6, 2.2], status: 'normal' },
  { id: 'fmcs-gateway', position: [9, 1.15, 0], size: [2.3, 2.3, 2], status: 'alert' },
  { id: 'diffusion-01', position: [-6.75, 1.6, 6], size: [3.1, 3.2, 2.2], status: 'normal' },
  { id: 'metrology-01', position: [-2.25, 1.35, 6], size: [2.5, 2.7, 2], status: 'normal' },
  { id: 'clean-buffer', position: [2.25, 1.2, 6], size: [2.3, 2.4, 2], status: 'warning' },
  { id: 'exhaust-bank', position: [6.75, 1.55, 6], size: [3.5, 3.1, 2.2], status: 'normal' },
]

export class DigitalTwinScene {
  private readonly clock = new Clock()
  private readonly controls: OrbitControls
  private readonly camera: PerspectiveCamera
  private readonly host: HTMLDivElement
  private readonly ifcLoader = new IfcModelLoader()
  private readonly telemetry = new TelemetryMockController()
  private readonly ifcPicker: FastModelPicker
  private readonly ifcPickerResizeEvent: ComponentsEvent<Vector2>
  private readonly ifcPickerWorld: {
    camera: { three: PerspectiveCamera }
    onDisposed: ComponentsEvent<unknown>
    renderer: {
      onResize: ComponentsEvent<Vector2>
      three: WebGLRenderer
    }
    scene: { three: Scene }
    uuid: string
  }
  private readonly pointer = new Vector2()
  private readonly renderer: WebGLRenderer
  private readonly resizeObserver: ResizeObserver
  private readonly scene = new Scene()
  private readonly deviceMarkers: DeviceMarker[] = []
  private readonly placeholderGroup = new Group()
  private readonly federatedBounds = new Box3()
  private readonly ifcModels = new Map<string, FragmentsModel>()
  private lastTelemetryPaintSignatureByModel = new Map<string, string>()
  private frameHandle = 0

  constructor(host: HTMLDivElement) {
    this.host = host
    ;(window as unknown as Record<string, unknown>).__twinScene = this
    this.scene.background = new Color('#05070d')
    this.scene.fog = new Fog('#05070d', 36, 200)

    this.camera = new PerspectiveCamera(42, 1, 0.1, 250)
    this.camera.position.copy(CAMERA_START)

    this.renderer = new WebGLRenderer({ antialias: true })
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    this.host.append(this.renderer.domElement)

    this.ifcPickerResizeEvent = new ComponentsEvent<Vector2>()
    this.ifcPickerWorld = {
      camera: { three: this.camera },
      onDisposed: new ComponentsEvent<unknown>(),
      renderer: {
        onResize: this.ifcPickerResizeEvent,
        three: this.renderer,
      },
      scene: { three: this.scene },
      uuid: 'ifc-picking-world',
    }
    this.ifcPicker = new FastModelPicker(
      this.ifcLoader.components,
      this.ifcPickerWorld as never,
    )

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.target.copy(CAMERA_TARGET)
    this.controls.minDistance = 10
    this.controls.maxDistance = 96
    this.controls.maxPolarAngle = MathUtils.degToRad(78)
    this.renderer.domElement.addEventListener('click', (event) => {
      void this.handleSceneClick(event)
    })

    this.setupLights()
    this.setupEnvironment()
    this.buildPlaceholderFab()
    void this.loadBundledIfcSample()

    this.resizeObserver = new ResizeObserver(() => {
      this.resize()
    })
    this.resizeObserver.observe(this.host)

    this.resize()
    this.animate = this.animate.bind(this)
    this.frameHandle = window.requestAnimationFrame(this.animate)
  }

  dispose(): void {
    window.cancelAnimationFrame(this.frameHandle)
    this.resizeObserver.disconnect()
    this.controls.dispose()
    this.ifcPicker.dispose()
    this.ifcLoader.dispose()
    this.telemetry.stop()
    this.renderer.dispose()
    this.host.replaceChildren()
  }

  private setupLights(): void {
    const ambient = new AmbientLight('#d8ecff', 0.55)
    const keyLight = new DirectionalLight('#dff3ff', 2.6)
    keyLight.position.set(14, 22, 10)

    const rimLight = new DirectionalLight('#6ee7ff', 0.8)
    rimLight.position.set(-10, 8, -12)

    this.scene.add(ambient, keyLight, rimLight)
  }

  private setupEnvironment(): void {
    // deep-space deck below the sub-fab level; the IFC building provides
    // slabs, columns, and walls, so the environment stays minimal
    const ground = new Mesh(
      new PlaneGeometry(320, 320),
      new MeshStandardMaterial({
        color: '#04060b',
        roughness: 1,
        metalness: 0,
      }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.set(0, -3.78, 0)
    this.scene.add(ground)

    const grid = new GridHelper(160, 80, 0x6ee7ff, 0x123244)
    const gridMaterial = grid.material as LineBasicMaterial
    gridMaterial.transparent = true
    gridMaterial.opacity = 0.22
    gridMaterial.depthWrite = false
    grid.position.set(0, -3.74, 0)
    this.scene.add(grid)

    const aisle = new Mesh(
      new PlaneGeometry(28, 2.6),
      new MeshStandardMaterial({
        color: '#12314a',
        emissive: '#123a52',
        emissiveIntensity: 0.3,
        metalness: 0.08,
        roughness: 0.72,
      }),
    )
    aisle.rotation.x = -Math.PI / 2
    aisle.position.set(0, 0.14, 0)
    this.scene.add(aisle)
  }

  private buildPlaceholderFab(): void {
    const equipmentGroup = this.placeholderGroup

    for (const [index, device] of DEVICE_LAYOUT.entries()) {
      const material = new MeshStandardMaterial({
        color: STATUS_COLORS[device.status],
        emissive: STATUS_COLORS[device.status],
        emissiveIntensity: device.status === 'alert' ? 0.45 : 0.16,
        roughness: 0.42,
        metalness: 0.2,
      })

      const mesh = new Mesh(new BoxGeometry(...device.size), material)
      mesh.name = device.id
      mesh.position.set(...device.position)
      mesh.receiveShadow = true
      equipmentGroup.add(mesh)

      this.deviceMarkers.push({
        baseY: device.position[1],
        mesh,
        pulseOffset: index * 0.45,
        status: device.status,
      })
    }

    const pipeRackMaterial = new MeshStandardMaterial({
      color: '#2f627f',
      roughness: 0.44,
      metalness: 0.24,
    })

    const pipeRacks = [
      new Vector3(-10.8, 4.4, -2.8),
      new Vector3(0, 4.4, -2.8),
      new Vector3(10.8, 4.4, -2.8),
      new Vector3(-5.4, 4.4, 3.8),
      new Vector3(5.4, 4.4, 3.8),
    ]

    for (const rackPosition of pipeRacks) {
      const rack = new Mesh(new BoxGeometry(5.8, 0.36, 1.6), pipeRackMaterial)
      rack.position.copy(rackPosition)
      equipmentGroup.add(rack)
    }

    this.scene.add(equipmentGroup)
  }

  async loadLocalIfcFile(file: File): Promise<void> {
    await this.loadIfcModel(() => this.ifcLoader.loadLocalFile(file), false)
  }

  async setFederatedModelVisibility(payload: {
    modelId: string
    visible: boolean
  }): Promise<void> {
    const model = this.ifcModels.get(payload.modelId)

    if (!model) {
      return
    }

    model.object.visible = payload.visible
    setFederatedModelVisibilityState(payload.modelId, payload.visible)
  }

  async setFederatedModelOpacity(payload: {
    modelId: string
    opacity: number
  }): Promise<void> {
    const model = this.ifcModels.get(payload.modelId)

    if (!model) {
      return
    }

    await model.setOpacity(undefined, payload.opacity)
    setFederatedModelOpacityState(payload.modelId, payload.opacity)
  }

  async setCategoryLayerVisibility(payload: {
    category: string
    modelId: string
    visible: boolean
  }): Promise<void> {
    const model = this.ifcModels.get(payload.modelId)

    if (!model) {
      return
    }

    const layer = getCategoryLayerSummaries().find(
      (item) => item.modelId === payload.modelId && item.category === payload.category,
    )

    if (!layer) {
      return
    }

    const localIds = this.ifcLoader.getCategoryLocalIds(payload.modelId, payload.category)
    await model.setVisible(localIds, payload.visible)
    setCategoryLayerVisibilityState(payload.modelId, payload.category, payload.visible)
  }

  async setCategoryLayerOpacity(payload: {
    category: string
    modelId: string
    opacity: number
  }): Promise<void> {
    const model = this.ifcModels.get(payload.modelId)

    if (!model) {
      return
    }

    const localIds = this.ifcLoader.getCategoryLocalIds(payload.modelId, payload.category)
    await model.setOpacity(localIds, payload.opacity)
    setCategoryLayerOpacityState(payload.modelId, payload.category, payload.opacity)
  }

  renameSpecificModel(payload: {
    modelId: string
    modelLabel: string
  }): void {
    this.ifcLoader.renameModel(payload.modelId, payload.modelLabel)
    this.telemetry.renameModel(payload.modelId, payload.modelLabel)
    renameFederatedModel(payload.modelId, payload.modelLabel)
  }

  fitSpecificModel(modelId: string): void {
    const model = this.ifcModels.get(modelId)

    if (!model) {
      return
    }

    const box = model.box.clone().applyMatrix4(model.object.matrixWorld)
    this.fitCameraToBounds(box)
  }

  async removeSpecificModel(modelId: string): Promise<void> {
    const model = this.ifcModels.get(modelId)

    if (!model) {
      return
    }

    this.scene.remove(model.object)
    await model.dispose()
    this.ifcLoader.removeModel(modelId)
    this.telemetry.removeModel(modelId)
    this.ifcModels.delete(modelId)
    this.lastTelemetryPaintSignatureByModel.delete(modelId)

    if (this.ifcModels.size === 0) {
      this.placeholderGroup.visible = true
      this.clearSelectedItem()
      return
    }

    const selected = getSelectedSpatialTreeNodeSummary()

    if (selected.modelId === modelId) {
      this.clearSelectedItem()
    }

    this.fitCameraToAllModels()
  }

  async isolateFederatedModel(payload: { modelId: string }): Promise<void> {
    isolateFederatedModelState(payload.modelId)

    for (const [modelId, model] of this.ifcModels) {
      model.object.visible = modelId === payload.modelId
    }
  }

  async isolateCategoryLayer(payload: {
    category: string
    modelId: string
  }): Promise<void> {
    isolateCategoryLayerState(payload.modelId, payload.category)

    for (const [modelId, model] of this.ifcModels) {
      const categories = getCategoryLayerSummaries().filter((layer) => layer.modelId === modelId)

      for (const layer of categories) {
        const localIds = this.ifcLoader.getCategoryLocalIds(modelId, layer.category)
        await model.setVisible(localIds, layer.visible)
      }

      model.object.visible = modelId === payload.modelId
    }
  }

  async resetAllLayers(): Promise<void> {
    resetLayerStateStore()

    for (const [modelId, model] of this.ifcModels) {
      model.object.visible = true
      await model.resetVisible()
      await model.resetOpacity(undefined)

      const categories = getCategoryLayerSummaries().filter((layer) => layer.modelId === modelId)

      for (const layer of categories) {
        const localIds = this.ifcLoader.getCategoryLocalIds(modelId, layer.category)
        await model.setVisible(localIds, true)
        await model.setOpacity(localIds, 1)
      }
    }
  }

  async selectSpatialTreeNode(payload: {
    category: string
    localId: number | null
    modelId?: string | null
  }): Promise<void> {
    const modelId = payload.modelId

    if (!modelId || payload.localId === null) {
      this.clearSelectedItem()
      return
    }

    const model = this.ifcModels.get(modelId)

    if (!model) {
      return
    }

    setSelectedSpatialTreeNodeSummary({
      localId: payload.localId,
      modelId,
    })
    await this.resetHighlights()

    await this.highlightLocalId(modelId, payload.localId)

    const details = await this.ifcLoader.getItemDetails(
      model,
      payload.localId,
      payload.localId,
    )

    setSelectedIfcItemSummary({
      ...details,
      status: 'selected',
      title: `Selected IFC Item #${details.localId}`,
    })
  }

  private async loadBundledIfcSample(): Promise<void> {
    await this.loadIfcModel(() => this.ifcLoader.loadBundledSample(), true)
    await this.loadIfcModel(() => this.ifcLoader.loadBundledSampleCopy(), false)
  }

  private async loadIfcModel(
    loadModel: () => Promise<FragmentsModel>,
    replaceExisting: boolean,
  ): Promise<void> {
    try {
      await this.ifcLoader.setup()

      if (replaceExisting) {
        await this.disposeAllLoadedIfcModels()
      }

      const model = await loadModel()
      model.useCamera(this.camera)
      this.positionFederatedModel(model)
      this.scene.add(model.object)
      this.ifcModels.set(model.modelId, model)
      // the placeholder equipment is the live gear inside the bundled fab;
      // keep it whenever that building is present
      this.placeholderGroup.visible = this.ifcModels.has('fab-building-ifc')
      const localIds = await model.getLocalIds()
      this.telemetry.upsertModel(
        model.modelId,
        this.ifcLoader.getModelLabel(model.modelId),
        localIds.slice(0, 120),
      )
      this.fitCameraToAllModels()
      if (replaceExisting) {
        this.clearSelectedItem()
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown IFC loading error.'

      setIfcLoadSummary({
        status: 'error',
        statusDetail: `IFC loading failed. Placeholder scene remains active. ${detail}`,
      })
    }
  }

  private async disposeAllLoadedIfcModels(): Promise<void> {
    for (const [modelId, model] of this.ifcModels) {
      this.scene.remove(model.object)
      await model.dispose()
      this.ifcLoader.removeModel(modelId)
      this.telemetry.removeModel(modelId)
    }

    this.ifcModels.clear()
    this.lastTelemetryPaintSignatureByModel.clear()
    this.federatedBounds.makeEmpty()
    this.placeholderGroup.visible = true
    setSelectedSpatialTreeNodeSummary({ localId: null, modelId: null })
  }

  private clearSelectedItem(): void {
    setSelectedSpatialTreeNodeSummary({ localId: null, modelId: null })
    setSelectedIfcItemSummary({
      attributes: [],
      category: 'No item selected',
      guid: 'Click any IFC element to inspect its BIM data.',
      itemId: null,
      localId: null,
      modelId: '',
      modelLabel: '',
      status: 'empty',
      title: 'Selected IFC Item',
    })
  }

  private async handleSceneClick(event: MouseEvent): Promise<void> {
    if (this.ifcModels.size === 0) {
      return
    }

    this.controls.update()
    this.camera.updateProjectionMatrix()
    this.camera.updateWorldMatrix(true, true)
    for (const model of this.ifcModels.values()) {
      model.object.updateWorldMatrix(true, true)
    }

    const bounds = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
    this.pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1

    await this.ifcLoader.fragments.core.update(true)
    const result = await this.ifcPicker.getFullPick(this.pointer)

    if (!result) {
      this.clearSelectedItem()
      return
    }

    const model = this.ifcModels.get(result.modelId)

    if (!model) {
      this.clearSelectedItem()
      return
    }

    const details = await this.ifcLoader.getItemDetails(
      model,
      result.localId,
      result.itemId,
    )

    await this.resetHighlights()
    await this.highlightLocalId(details.modelId, details.localId)
    setSelectedSpatialTreeNodeSummary({
      localId: details.localId,
      modelId: details.modelId,
    })
    setSelectedIfcItemSummary({
      ...details,
      status: 'selected',
      title: `Selected IFC Item #${details.localId}`,
    })
  }

  private async highlightLocalId(modelId: string, localId: number): Promise<void> {
    const model = this.ifcModels.get(modelId)

    if (!model) {
      return
    }

    const telemetry = getTelemetryForItem(modelId, localId)
    const color =
      telemetry?.status === 'alert'
        ? new Color('#ff6b67')
        : telemetry?.status === 'warning'
          ? new Color('#ffb454')
          : new Color('#69e8b2')

    await model.highlight([localId], {
      ...HIGHLIGHT_STYLE,
      color,
    })
  }

  private async applyTelemetryColors(): Promise<void> {
    for (const [modelId, model] of this.ifcModels) {
      if (!getFederatedModelSummaries().find((item) => item.modelId === modelId)?.visible) {
        continue
      }

      const groups = getTelemetryStatusGroupsByModel()[modelId] ?? {
        alert: [],
        normal: [],
        warning: [],
      }
      const signature = [
        groups.normal.join(','),
        groups.warning.join(','),
        groups.alert.join(','),
      ].join('|')

      if (signature === this.lastTelemetryPaintSignatureByModel.get(modelId)) {
        continue
      }

      this.lastTelemetryPaintSignatureByModel.set(modelId, signature)
      await model.resetColor(undefined)
      await model.setColor(groups.normal, NORMAL_COLOR)
      await model.setColor(groups.warning, WARNING_COLOR)
      await model.setColor(groups.alert, ALERT_COLOR)
    }
  }

  private async resetHighlights(): Promise<void> {
    for (const model of this.ifcModels.values()) {
      await model.resetHighlight()
    }
  }

  private positionFederatedModel(model: FragmentsModel): void {
    // Fragments normalises each model's origin unpredictably and updates
    // model.box asynchronously, so re-base every model from the box it has
    // at load time (still local then) and track federation bounds
    // synchronously ourselves: centre on XZ, ground the lowest geometry at
    // the sample's known below-grade depth (or at grade for local files),
    // and stack additional models along +X.
    const local = model.box.clone()
    const groundY = BUNDLED_GROUND_Y[model.modelId] ?? 0
    const centerX = (local.min.x + local.max.x) / 2
    const centerZ = (local.min.z + local.max.z) / 2
    const baseY = groundY - local.min.y

    if (this.ifcModels.size === 0 || this.federatedBounds.isEmpty()) {
      model.object.position.set(-centerX, baseY, -centerZ)
    } else {
      const offsetX = this.federatedBounds.max.x + FEDERATED_GAP - local.min.x
      model.object.position.set(offsetX, baseY, -centerZ)
    }

    model.object.updateWorldMatrix(true, true)
    this.federatedBounds.union(local.translate(model.object.position))
  }

  private fitCameraToAllModels(): void {
    const box = this.getFederatedBounds()

    if (!box) {
      return
    }

    this.fitCameraToBounds(box)
  }

  private fitCameraToBounds(box: Box3): void {
    const size = box.getSize(new Vector3())
    const center = box.getCenter(new Vector3())
    const maxDimension = Math.max(size.x, size.y, size.z)
    const distance = maxDimension * 1.35 || 18
    const direction = this.camera.position
      .clone()
      .sub(this.controls.target)
      .normalize()

    if (direction.lengthSq() === 0) {
      direction.copy(CAMERA_START).sub(CAMERA_TARGET).normalize()
    }

    this.controls.target.copy(center)
    this.camera.position.copy(center.clone().add(direction.multiplyScalar(distance)))
    this.camera.lookAt(center)
  }

  private getFederatedBounds(): Box3 | null {
    if (this.ifcModels.size === 0 || this.federatedBounds.isEmpty()) {
      return null
    }

    return this.federatedBounds.clone()
  }

  private resize(): void {
    const { clientWidth, clientHeight } = this.host

    if (clientWidth === 0 || clientHeight === 0) {
      return
    }

    this.camera.aspect = clientWidth / clientHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(clientWidth, clientHeight, false)
    this.ifcPickerResizeEvent.trigger(new Vector2(clientWidth, clientHeight))
  }

  private animate(): void {
    const elapsed = this.clock.getElapsedTime()

    for (const marker of this.deviceMarkers) {
      const pulse = 0.5 + Math.sin(elapsed * 2.1 + marker.pulseOffset) * 0.5
      const lift =
        marker.status === 'alert' ? 0.16 : marker.status === 'warning' ? 0.09 : 0.04

      marker.mesh.position.y = marker.baseY + pulse * lift
      marker.mesh.material.emissiveIntensity =
        marker.status === 'alert'
          ? 0.44 + pulse * 0.36
          : marker.status === 'warning'
            ? 0.22 + pulse * 0.14
            : 0.14 + pulse * 0.06
    }

    this.controls.update()
    if (this.ifcModels.size > 0) {
      void this.applyTelemetryColors()
      void this.ifcLoader.fragments.core.update(false)
    }
    this.renderer.render(this.scene, this.camera)
    this.frameHandle = window.requestAnimationFrame(this.animate)
  }
}
