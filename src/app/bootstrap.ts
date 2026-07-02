import { createAppShell } from './create-app-shell'
import { DigitalTwinScene } from './scene/digital-twin-scene'

export function bootstrap(): void {
  const root = document.querySelector<HTMLDivElement>('#app')

  if (!root) {
    throw new Error('Missing #app root element.')
  }

  const {
    dispose,
    ifcFileInput,
    onCategoryLayerChange,
    onCategoryLayerIsolate,
    onCategoryLayerOpacityChange,
    onFederatedModelFit,
    onFederatedModelIsolate,
    onFederatedModelOpacityChange,
    onFederatedModelRename,
    onFederatedModelRemove,
    onFederatedModelVisibilityChange,
    onResetLayers,
    onSpatialTreeNodeSelect,
    sceneHost,
  } = createAppShell(root)
  const scene = new DigitalTwinScene(sceneHost)

  ifcFileInput.addEventListener('change', () => {
    const files = Array.from(ifcFileInput.files ?? [])

    if (files.length === 0) {
      return
    }

    void Promise.all(files.map((file) => scene.loadLocalIfcFile(file)))
    ifcFileInput.value = ''
  })

  const removeSpatialTreeListener = onSpatialTreeNodeSelect((payload) => {
    void scene.selectSpatialTreeNode(payload)
  })
  const removeModelVisibilityListener = onFederatedModelVisibilityChange((payload) => {
    void scene.setFederatedModelVisibility(payload)
  })
  const removeModelOpacityListener = onFederatedModelOpacityChange((payload) => {
    void scene.setFederatedModelOpacity(payload)
  })
  const removeCategoryLayerListener = onCategoryLayerChange((payload) => {
    void scene.setCategoryLayerVisibility(payload)
  })
  const removeCategoryLayerOpacityListener = onCategoryLayerOpacityChange((payload) => {
    void scene.setCategoryLayerOpacity(payload)
  })
  const removeModelIsolateListener = onFederatedModelIsolate((payload) => {
    void scene.isolateFederatedModel(payload)
  })
  const removeModelFitListener = onFederatedModelFit((payload) => {
    scene.fitSpecificModel(payload.modelId)
  })
  const removeModelRemoveListener = onFederatedModelRemove((payload) => {
    void scene.removeSpecificModel(payload.modelId)
  })
  const removeModelRenameListener = onFederatedModelRename((payload) => {
    scene.renameSpecificModel(payload)
  })
  const removeCategoryIsolateListener = onCategoryLayerIsolate((payload) => {
    void scene.isolateCategoryLayer(payload)
  })
  const removeResetLayersListener = onResetLayers(() => {
    void scene.resetAllLayers()
  })

  window.addEventListener(
    'beforeunload',
    () => {
      removeSpatialTreeListener()
      removeModelVisibilityListener()
      removeModelOpacityListener()
      removeCategoryLayerListener()
      removeCategoryLayerOpacityListener()
      removeModelIsolateListener()
      removeModelFitListener()
      removeModelRemoveListener()
      removeModelRenameListener()
      removeCategoryIsolateListener()
      removeResetLayersListener()
      dispose()
      scene.dispose()
    },
    { once: true },
  )
}
