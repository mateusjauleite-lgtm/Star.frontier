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
export function createEarthTerrainReferenceCore({ THREE, earthSystem, scene } = {}) {
  if (!THREE || !earthSystem?.group || !scene) {
    throw new TypeError('EarthTerrainReferenceCore exige Three.js, EarthCore e cena.');
  }
  const references = new Map();
  let disposed = false;

  function resolveSurfacePosition({ latitudeDeg, longitudeDeg, elevationMeters = 0 }) {
    const surface = earthSystem.getCollisionSurface?.();
    const sample = surface?.sample?.(longitudeDeg, latitudeDeg);
    if (!sample?.localPosition || !sample?.terrainNormal) {
      throw new Error('A superfície terrestre ainda não consegue resolver esta coordenada.');
    }
    const physicalScale = earthSystem.getPhysicalScale?.();
    const elevationUnits = physicalScale?.metersToRenderUnits?.(elevationMeters) ?? elevationMeters;
    const localPosition = sample.localPosition.clone()
      .add(sample.terrainNormal.clone().multiplyScalar(elevationUnits));
    earthSystem.group.updateWorldMatrix(true, false);
    const worldPosition = localPosition.clone().applyMatrix4(earthSystem.group.matrixWorld);
    const worldNormal = sample.terrainNormal.clone()
      .transformDirection(earthSystem.group.matrixWorld).normalize();
    return { localPosition, worldPosition, worldNormal, sample };
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
    root.userData.earthTerrainReference = {
      id, ...geo, metersPerModelUnit, meshCount,
      sourceFormat: String(metadata.sourceFormat || 'runtime-object').toLowerCase()
    };
    earthSystem.group.add(root);
    const record = Object.freeze({
      id, name: String(metadata.name || id), ...geo, meshCount,
      sourceFormat: root.userData.earthTerrainReference.sourceFormat,
      object: root
    });
    references.set(id, record);
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
    earthSystem.group.remove(record.object);
    record.object.traverse(object => {
      object.geometry?.dispose?.();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.filter(Boolean).forEach(material => material.dispose?.());
    });
    references.delete(String(id));
    return true;
  }
  function dispose() {
    if (disposed) return;
    for (const id of [...references.keys()]) removeReference(id);
    disposed = true;
  }
  return Object.freeze({
    attach, importFile, getReference, listReferences, removeReference, dispose,
    resolveSurfacePosition,
    getStatus: () => ({
      state: disposed ? 'disposed' : 'ready',
      acceptedFormats: [...SUPPORTED_EXTENSIONS],
      referenceCount: references.size,
      placementMode: 'georeferenced-surface-overlay',
      modifiesGlobalElevation: false
    })
  });
}
