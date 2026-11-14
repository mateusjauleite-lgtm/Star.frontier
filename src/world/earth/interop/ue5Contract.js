/**
 * Engine-neutral handoff contract for the Earth system.
 *
 * This file does not load Unreal Engine, export assets, or replace Three.js.
 * It records the stable data boundary that a future UE5 Earth project must
 * consume, keeping scientific values separate from renderer-specific units.
 */
export const EARTH_UE5_INTEROP = Object.freeze({
  id: 'star-frontier-earth-ue5-interop',
  contractVersion: '1.0.0',
  status: 'contract-only',
  sourceRuntime: 'three.js',
  targetRuntime: 'unreal-engine-5',
  runtimeDependency: false,
  automaticMigration: false,
  recommendedExchangeFormat: 'glb',
  interchangeStandard: 'glTF 2.0',
  handoff: Object.freeze({
    geometry: 'static-meshes',
    materials: 'portable-pbr-subset',
    textures: 'external-or-embedded-glb-textures',
    animation: 'not-required-for-first-earth-prototype',
    metadata: 'versioned-json-sidecar',
    scientificUnits: 'SI-with-kilometres-for-planetary-altitudes',
    visualScale: 'explicit-project-config-not-implicit-physical-scale'
  }),
  coordinatePolicy: Object.freeze({
    source: 'three.js-world-coordinate-system',
    target: 'unreal-engine-world-coordinate-system',
    conversion: 'delegate-axis-and-handedness-conversion-to-validated-gltf-import-export-pipeline',
    upAxis: 'record-and-verify-on-round-trip',
    distanceUnits: 'record-export-scale-explicitly'
  }),
  earthLayers: Object.freeze([
    'interior',
    'surface',
    'terrain',
    'oceans',
    'atmosphere',
    'clouds',
    'lighting'
  ]),
  portability: Object.freeze({
    portable: ['static-meshes', 'base-color-textures', 'normal-textures', 'roughness-metallic-data', 'basic-pbr-materials'],
    rebuildInTarget: ['atmosphere-scattering', 'cloud-shading', 'volumetric-effects', 'lighting-and-post-process'],
    keepAsScientificData: ['mass', 'mean-radius-km', 'gravity', 'altitude-km', 'pressure', 'density', 'temperature', 'rotation', 'axial-tilt']
  }),
  migrationGates: Object.freeze([
    'reviewed-earth-dataset-and-asset-rights',
    'repeatable-glb-round-trip',
    'visual-parity-review',
    'android-device-profile-and-performance-test',
    'memory-and-thermal-test',
    'approved-fallback-and-baseline-preservation'
  ])
});

export function getEarthEngineInteropStatus() {
  return {
    contract: EARTH_UE5_INTEROP.id,
    version: EARTH_UE5_INTEROP.contractVersion,
    status: EARTH_UE5_INTEROP.status,
    targetRuntime: EARTH_UE5_INTEROP.targetRuntime,
    runtimeDependency: EARTH_UE5_INTEROP.runtimeDependency,
    automaticMigration: EARTH_UE5_INTEROP.automaticMigration,
    layersCovered: [...EARTH_UE5_INTEROP.earthLayers]
  };
}
