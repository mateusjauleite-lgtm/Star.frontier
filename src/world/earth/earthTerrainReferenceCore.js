import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const SUPPORTED_EXTENSIONS = new Set(['glb', 'gltf', 'obj', 'fbx']);
const finite = value => Number.isFinite(Number(value));

function readGeoreference(metadata) {
  const latitudeDeg = Number(metadata?.latitudeDeg);
  const longitudeDeg = Number(metadata?.longitudeDeg);
  const elevationMeters = Number(metadata?.elevationMeters ?? 0);
  if (!finite(latitudeDeg) || latitudeDeg < -90 || latitudeDeg > 90 ||
      !finite(longitudeDeg) || longitudeDeg < -180 || longitudeDeg > 180 ||
      !finite(elevationMeters)) {
    throw new TypeError('A referência exige latitude, longitude e elevação em coordenadas terrestres.');
  }
  return { latitudeDeg, longitudeDeg, elevationMeters };
}

function validateModel(root) {
  if (!root?.isObject3D) throw new TypeError('O arquivo não produziu uma malha 3D válida.');
  let meshCount = 0;
  root.traverse(object => {
    if (!object.isMesh || !object.geometry) return;
    meshCount += 1;
    const geometry = object.geometry;
    if (!geometry.attributes?.position || geometry.attributes.position.count < 3) {
      throw new TypeError('A referência contém uma malha sem vértices suficientes.');
    }
    if (!geometry.boundingBox) geometry.computeBoundingBox();
  });
  if (meshCount === 0) throw new TypeError('Nenhuma malha foi encontrada no arquivo.');
  return meshCount;
}

async function parseModel(file, extension) {
  const buffer = await file.arrayBuffer();
  if (extension === 'obj') return new OBJLoader().parse(new TextDecoder().decode(buffer));
  if (extension === 'fbx') return new FBXLoader().parse(buffer, '');
  const loader = new GLTFLoader();
  const data = buffer.slice(0);
  return new Promise((resolve, reject) => {
    loader.parse(data, '', result => resolve(result.scene), reject);
  });
}

/**
 * Receives closed terrain blocks and regional meshes as georeferenced overlays.
 * It deliberately does not replace the global DEM or claim to sculpt continents.
 */
export function createEarthTerrainReferenceCore({ THREE, earthSystem, scene, onReferenceRegistered = null, onReferenceRemoved = null } = {}) {
  if (!THREE || !earthSystem?.group || !scene) {
    throw new TypeError('EarthTerrainReferenceCore exige Three.js, EarthCore e cena.');
  }
  const references = new Map();
  const terrainRaycaster = new THREE.Raycaster();
  const inverseFrameQuaternion = new THREE.Quaternion();
  const bodyFixedFrame = earthSystem.getSurfaceFrame?.() ?? earthSystem.group;
  const collisionSurface = earthSystem.getCollisionSurface?.();
  const originalSurfaceSample = collisionSurface?.sample ?? null;
  let disposed = false;

  function findRegionalTerrainHit(fallback) {
    const terrainReferences = [...references.values()].filter(reference =>
      reference.surfaceRole === 'terrain' && reference.collisionEnabled
    );
    if (!terrainReferences.length) return null;
    const physicalScale = earthSystem.getPhysicalScale?.();
    const searchMeters = Math.max(100, ...terrainReferences.map(reference =>
      reference.collisionSearchDistanceMeters
    ));
    const searchUnits = physicalScale?.metersToRenderUnits?.(searchMeters) ?? searchMeters;
    const radialUp = fallback.worldNormal.clone().normalize();
    const rayOrigin = fallback.worldPosition.clone().addScaledVector(radialUp, searchUnits);
    terrainRaycaster.set(rayOrigin, radialUp.clone().negate());
    terrainRaycaster.near = 0;
    terrainRaycaster.far = searchUnits * 2;
    const intersections = [];
    for (const reference of terrainReferences) {
      reference.object.updateWorldMatrix(true, true);
      intersections.push(...terrainRaycaster.intersectObject(reference.object, true));
    }
    intersections.sort((a, b) => a.distance - b.distance);
    const hit = intersections[0];
    if (!hit?.point || !hit.face?.normal) return null;

    bodyFixedFrame.updateWorldMatrix(true, false);
    const worldPosition = hit.point.clone();
    const localPosition = bodyFixedFrame.worldToLocal(worldPosition.clone());
    const worldNormal = hit.face.normal.clone()
      .applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld))
      .normalize();
    bodyFixedFrame.getWorldQuaternion(inverseFrameQuaternion);
    const localNormal = worldNormal.clone().applyQuaternion(inverseFrameQuaternion.invert()).normalize();
    const reference = terrainReferences.find(item =>
      item.object === hit.object || item.object.getObjectById(hit.object.id) === hit.object
    ) ?? terrainReferences.find(item => {
      let parent = hit.object;
      while (parent && parent !== item.object) parent = parent.parent;
      return parent === item.object;
    });
    return {
      localPosition, worldPosition, worldNormal, terrainNormal: localNormal,
      regionalReferenceId: reference?.id ?? null,
      source: 'georeferenced-regional-mesh'
    };
  }

  function sampleSurfaceWithRegions(longitudeDeg, latitudeDeg) {
    if (typeof originalSurfaceSample !== 'function') return null;
    const baseSample = originalSurfaceSample.call(collisionSurface, longitudeDeg, latitudeDeg);
    if (!baseSample?.localPosition || !baseSample?.terrainNormal) return baseSample;
    bodyFixedFrame.updateWorldMatrix(true, false);
    const fallback = {
      worldPosition: baseSample.localPosition.clone().applyMatrix4(bodyFixedFrame.matrixWorld),
      worldNormal: baseSample.terrainNormal.clone()
        .transformDirection(bodyFixedFrame.matrixWorld).normalize()
    };
    const regionalHit = findRegionalTerrainHit(fallback);
    if (!regionalHit) return baseSample;
    return {
      ...baseSample,
      localPosition: regionalHit.localPosition,
      terrainNormal: regionalHit.terrainNormal,
      regionalReferenceId: regionalHit.regionalReferenceId,
      regionalSurface: true
    };
  }

  if (collisionSurface && typeof originalSurfaceSample === 'function') {
    collisionSurface.sample = sampleSurfaceWithRegions;
  }

  function resolveSurfacePosition({ latitudeDeg, longitudeDeg, elevationMeters = 0 }) {
    const sample = collisionSurface?.sample?.(longitudeDeg, latitudeDeg);
    if (!sample?.localPosition || !sample?.terrainNormal) {
      throw new Error('A superfície terrestre ainda não consegue resolver esta coordenada.');
    }
    const physicalScale = earthSystem.getPhysicalScale?.();
    const elevationUnits = physicalScale?.metersToRenderUnits?.(elevationMeters) ?? elevationMeters;
    const localPosition = sample.localPosition.clone()
      .add(sample.terrainNormal.clone().multiplyScalar(elevationUnits));
    bodyFixedFrame.updateWorldMatrix(true, false);
    const worldPosition = localPosition.clone().applyMatrix4(bodyFixedFrame.matrixWorld);
    const worldNormal = sample.terrainNormal.clone()
      .transformDirection(bodyFixedFrame.matrixWorld).normalize();
    return {
      localPosition, worldPosition, worldNormal, sample,
      regional: Boolean(sample.regionalSurface),
      regionalReferenceId: sample.regionalReferenceId ?? null
    };
  }

  function attach(root, metadata) {
    if (disposed) throw new Error('EarthTerrainReferenceCore foi encerrado.');
    const geo = readGeoreference(metadata);
    const meshCount = validateModel(root);
    const id = String(metadata.id || metadata.name || '').trim();
    if (!id) throw new TypeError('A referência precisa de um ID ou nome.');
    if (references.has(id)) throw new Error(`Referência já registrada: ${id}`);
    const metersPerModelUnit = Number(metadata.metersPerModelUnit ?? 1);
    if (!finite(metersPerModelUnit) || metersPerModelUnit <= 0) {
      throw new TypeError('metersPerModelUnit deve ser um número positivo.');
    }
    const placement = resolveSurfacePosition({ ...geo, elevationMeters: geo.elevationMeters });
    const physicalScale = earthSystem.getPhysicalScale?.();
    const renderUnitsPerMeter = physicalScale?.renderUnitsPerMeter ?? 1;
    const scale = metersPerModelUnit * renderUnitsPerMeter;
    root.scale.multiplyScalar(scale);
    root.position.copy(placement.localPosition);
    root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), placement.sample.terrainNormal.clone().normalize());
    root.name = `EarthTerrainReference:${id}`;
    const surfaceRole = metadata.surfaceRole === 'terrain' ? 'terrain' : 'overlay';
    const collisionEnabled = surfaceRole === 'terrain' && metadata.collisionEnabled !== false;
    const collisionSearchDistanceMeters = Number(metadata.collisionSearchDistanceMeters ?? 10000);
    if (!finite(collisionSearchDistanceMeters) || collisionSearchDistanceMeters <= 0) {
      throw new TypeError('collisionSearchDistanceMeters deve ser positivo.');
    }
    const destinationEnabled = metadata.destinationEnabled === true || surfaceRole === 'terrain';
    root.userData.earthTerrainReference = {
      id, ...geo, metersPerModelUnit, meshCount, surfaceRole, collisionEnabled,
      collisionSearchDistanceMeters, destinationEnabled,
      sourceFormat: String(metadata.sourceFormat || 'runtime-object').toLowerCase()
    };
    bodyFixedFrame.add(root);
    const record = Object.freeze({
      id, name: String(metadata.name || id), ...geo, meshCount,
      sourceFormat: root.userData.earthTerrainReference.sourceFormat,
      surfaceRole, collisionEnabled, collisionSearchDistanceMeters, destinationEnabled,
      object: root
    });
    references.set(id, record);
    onReferenceRegistered?.(record);
    return record;
  }

  async function importFile(file, metadata = {}) {
    if (!file?.name || typeof file.arrayBuffer !== 'function') throw new TypeError('Arquivo 3D inválido.');
    const extension = file.name.split('.').pop().toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(extension)) {
      throw new TypeError('Formato não suportado. Use .glb, .gltf, .obj ou .fbx.');
    }
    const root = await parseModel(file, extension);
    try {
      return attach(root, { ...metadata, name: metadata.name || file.name, sourceFormat: extension });
    } catch (error) {
      root.traverse(object => {
        object.geometry?.dispose?.();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.filter(Boolean).forEach(material => material.dispose?.());
      });
      throw error;
    }
  }

  function getReference(id) { return references.get(String(id)) ?? null; }
  function listReferences() {
    return [...references.values()].map(({ object, ...metadata }) => metadata);
  }
  function removeReference(id) {
    const record = references.get(String(id));
    if (!record) return false;
    bodyFixedFrame.remove(record.object);
    record.object.traverse(object => {
      object.geometry?.dispose?.();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.filter(Boolean).forEach(material => material.dispose?.());
    });
    references.delete(String(id));
    if (record.destinationEnabled) onReferenceRemoved?.(record);
    return true;
  }
  function dispose() {
    if (disposed) return;
    if (collisionSurface && originalSurfaceSample) collisionSurface.sample = originalSurfaceSample;
    for (const id of [...references.keys()]) removeReference(id);
    disposed = true;
  }
  return Object.freeze({
    attach, importFile, getReference, listReferences, removeReference, dispose,
    resolveSurfacePosition,
    sampleTerrainSurface: resolveSurfacePosition,
    getStatus: () => ({
      state: disposed ? 'disposed' : 'ready',
      acceptedFormats: [...SUPPORTED_EXTENSIONS],
      referenceCount: references.size,
      terrainReferenceCount: [...references.values()].filter(item => item.surfaceRole === 'terrain').length,
      collidableTerrainCount: [...references.values()].filter(item => item.collisionEnabled).length,
      placementMode: 'georeferenced-regional-terrain-with-global-dem-fallback',
      globalDemRemainsAuthoritativeOutsideRegionalMeshes: true,
      modifiesGlobalElevation: false
    })
  });
}
