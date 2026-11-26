import * as THREE from 'three';

export const TERRESTRIAL_BASE_PROFILE = Object.freeze({
  id: 'bt-br-01',
  name: 'Base Terrestre Brasil – BT-01',
  bodyId: 'earth',
  latitudeDeg: -22.2964,
  longitudeDeg: -48.5570,
  elevationMeters: 0,
  region: 'Jaú, São Paulo, Brasil'
});

export function createTerrestrialTransportBase({ THREE: Three = THREE, earthSystem, earthTerrainReferenceCore } = {}) {
  if (!Three || !earthSystem?.getSurfaceFrame || !earthTerrainReferenceCore?.resolveSurfacePosition) {
    throw new TypeError('A BT-01 exige o referencial da Terra e o resolvedor DEM.');
  }
  let placement = earthTerrainReferenceCore.resolveSurfacePosition({
    latitudeDeg: TERRESTRIAL_BASE_PROFILE.latitudeDeg,
    longitudeDeg: TERRESTRIAL_BASE_PROFILE.longitudeDeg,
    elevationMeters: TERRESTRIAL_BASE_PROFILE.elevationMeters
  });
  const root = new Three.Group();
  root.name = 'Terrestrial-Transport-Base-BT-BR-01';
  root.position.copy(placement.localPosition);
  root.quaternion.setFromUnitVectors(new Three.Vector3(0, 1, 0), placement.sample.terrainNormal.clone().normalize());
  let demAnchored = false;
  root.userData.terrestrialBase = { ...TERRESTRIAL_BASE_PROFILE, placement: 'reference-sphere-pending-dem' };

  const dark = new Three.MeshStandardMaterial({ color: 0x172638, metalness: 0.82, roughness: 0.34 });
  const alloy = new Three.MeshStandardMaterial({ color: 0x9aabb9, metalness: 0.78, roughness: 0.3 });
  const white = new Three.MeshStandardMaterial({ color: 0xcbd7df, metalness: 0.46, roughness: 0.42 });
  const blue = new Three.MeshStandardMaterial({ color: 0x167fc0, emissive: 0x063b70, emissiveIntensity: 0.9, metalness: 0.45, roughness: 0.28 });
  const glow = new Three.MeshBasicMaterial({ color: 0x56d9ff, transparent: true, opacity: 0.72 });
  const green = new Three.MeshBasicMaterial({ color: 0x71e6ba });
  const concrete = new Three.MeshStandardMaterial({ color: 0x56636a, metalness: 0.08, roughness: 0.94 });
  const marking = new Three.MeshBasicMaterial({ color: 0xf0c76a });

  const addBox = (parent, name, size, position, material) => {
    const mesh = new Three.Mesh(new Three.BoxGeometry(...size), material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const addCylinder = (parent, name, radiusTop, radiusBottom, height, position, material, segments = 48) => {
    const mesh = new Three.Mesh(new Three.CylinderGeometry(radiusTop, radiusBottom, height, segments), material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // Área de chegada: laje métrica ampla, sem alterar o ponto geodésico da base.
  // O topo fica praticamente no nível do DEM; a fundação do edifício permanece acima.
  addBox(root, 'BT01-Arrival-Apron', [44, 0.18, 42], [0, -0.055, 0], concrete);
  addBox(root, 'BT01-Arrival-Outline-Front', [38, 0.025, 0.14], [0, 0.05, 19.4], marking);
  addBox(root, 'BT01-Arrival-Outline-Rear', [38, 0.025, 0.14], [0, 0.05, -19.4], marking);
  addBox(root, 'BT01-Arrival-Outline-Port', [0.14, 0.025, 38.8], [-19, 0.05, 0], marking);
  addBox(root, 'BT01-Arrival-Outline-Starboard', [0.14, 0.025, 38.8], [19, 0.05, 0], marking);

  // Complexo modular ancorado ao relevo DEM: pátio, edifício de operações e plataforma.
  addBox(root, 'BT01-Reinforced-Foundation', [25, 0.48, 19], [-4.5, 0.28, -11], dark);
  addBox(root, 'BT01-Operations-Hall', [13, 5.2, 9], [-4.5, 3.1, -11], white);
  addBox(root, 'BT01-Operations-Roof', [13.8, 0.42, 9.8], [-4.5, 5.9, -11], alloy);
  addBox(root, 'BT01-Front-Window-Band', [10.5, 1.25, 0.08], [-4.5, 3.65, -6.43], blue);
  addBox(root, 'BT01-Side-Window-Band', [0.08, 1.25, 6.8], [2.04, 3.65, -11], blue);
  addBox(root, 'BT01-Entry-Canopy', [5.4, 0.22, 2.2], [-4.5, 2.7, -5.4], alloy);
  addBox(root, 'BT01-Entry-Portal', [3.1, 2.8, 0.22], [-4.5, 1.7, -6.3], dark);

  const pad = new Three.Group();
  pad.name = 'BT01-Transporter-Pad';
  // O centro da plataforma coincide com a coordenada geodésica usada pelo transporte.
  // Assim, a chegada ocorre sobre o pad, sem deslocar o destino nem a Terra.
  pad.position.set(0, -0.55, 0);
  root.add(pad);
  // Caminho físico entre a plataforma de transporte e a entrada do edifício.
  addBox(root, 'BT01-Arrival-Walkway', [2.6, 0.07, 6.8], [-4.5, 0.09, -3.0], alloy);
  addCylinder(pad, 'BT01-Pad-Foundation', 7.2, 7.5, 0.62, [0, 0, 0], dark, 64);
  addCylinder(pad, 'BT01-Pad-Upper-Ring', 6.8, 6.8, 0.16, [0, 0.38, 0], alloy, 64);
  addCylinder(pad, 'BT01-Pad-Deck', 6.3, 6.3, 0.12, [0, 0.51, 0], dark, 64);
  addCylinder(pad, 'BT01-Pad-Emitter', 2.15, 2.15, 0.07, [0, 0.61, 0], blue, 48);
  addCylinder(pad, 'BT01-Pad-Emitter-Glow', 2.5, 2.5, 0.025, [0, 0.66, 0], glow, 48);
  for (let i = 0; i < 6; i += 1) {
    const angle = i * Math.PI / 3;
    const x = Math.cos(angle) * 5.35, z = Math.sin(angle) * 5.35;
    addCylinder(pad, 'BT01-Pad-Emitter-Column-' + (i + 1), 0.12, 0.18, 3.25, [x, 2.18, z], alloy, 12);
    addCylinder(pad, 'BT01-Pad-Emitter-Head-' + (i + 1), 0.55, 0.48, 0.2, [x, 3.82, z], alloy, 24);
    addCylinder(pad, 'BT01-Pad-Emitter-Lens-' + (i + 1), 0.36, 0.36, 0.045, [x, 3.95, z], glow, 24);
  }
  addCylinder(pad, 'BT01-Pad-Upper-Emitter', 1.15, 1.15, 0.22, [0, 4.05, 0], dark, 32);
  addCylinder(pad, 'BT01-Pad-Upper-Lens', 0.82, 0.82, 0.05, [0, 4.19, 0], glow, 32);

  const console = new Three.Group();
  console.name = 'BT01-Return-Transport-Console';
  console.position.set(-10.7, 0.56, 6.5);
  root.add(console);
  addBox(console, 'BT01-Console-Pedestal', [1.25, 1.55, 0.9], [0, 0.78, 0], dark);
  addBox(console, 'BT01-Console-Display', [1.05, 0.72, 0.12], [0, 1.72, -0.08], blue);
  addBox(console, 'BT01-Console-Status-Light', [0.16, 0.12, 0.16], [0.42, 1.55, 0.42], green);

  // Torre de comunicação e dois painéis solares identificam a estação à distância.
  addCylinder(root, 'BT01-Comms-Mast', 0.14, 0.2, 8.5, [10.5, 4.25, -8], alloy, 16);
  addCylinder(root, 'BT01-Comms-Dish', 1.25, 0.18, 0.34, [10.5, 8.55, -8], white, 32);
  addBox(root, 'BT01-Solar-Array-Left', [5.4, 0.12, 2.8], [4.5, 1.1, -8.3], blue);
  addBox(root, 'BT01-Solar-Array-Right', [5.4, 0.12, 2.8], [4.5, 1.1, -4.8], blue);

  earthSystem.getSurfaceFrame().add(root);
  root.updateMatrixWorld(true);

  function updatePlacement() {
    const terrainStatus = earthSystem.getStatus?.().terrain;
    if (!terrainStatus?.sourceGridReady) return false;
    const next = earthTerrainReferenceCore.resolveSurfacePosition({
      latitudeDeg: TERRESTRIAL_BASE_PROFILE.latitudeDeg,
      longitudeDeg: TERRESTRIAL_BASE_PROFILE.longitudeDeg,
      elevationMeters: TERRESTRIAL_BASE_PROFILE.elevationMeters
    });
    root.position.copy(next.localPosition);
    root.quaternion.setFromUnitVectors(new Three.Vector3(0, 1, 0), next.sample.terrainNormal.clone().normalize());
    root.userData.terrestrialBase.placement = 'earth-dem-surface';
    root.updateMatrixWorld(true);
    placement = next;
    demAnchored = true;
    return true;
  }
  const baseCollisionRaycaster = new Three.Raycaster();
  const baseCollisionUp = new Three.Vector3();
  const baseCollisionDown = new Three.Vector3();
  const baseCollisionNormalMatrix = new Three.Matrix3();
  const baseWorldQuaternion = new Three.Quaternion();
  const walkableBaseMeshes = new Set([
    'BT01-Arrival-Apron', 'BT01-Reinforced-Foundation', 'BT01-Operations-Roof',
    'BT01-Arrival-Walkway', 'BT01-Pad-Deck'
  ]);

  // Consulta somente faces superiores reais da geometria visível da BT-01.
  // Não cria plano auxiliar nem collider invisível separado da estrutura.
  function sampleCollisionSurface(worldPosition) {
    if (!worldPosition?.isVector3) return null;
    root.updateWorldMatrix(true, true);
    root.getWorldQuaternion(baseWorldQuaternion);
    baseCollisionUp.set(0, 1, 0).applyQuaternion(baseWorldQuaternion).normalize();
    baseCollisionDown.copy(baseCollisionUp).negate();
    const rayOrigin = worldPosition.clone().addScaledVector(baseCollisionUp, 20);
    baseCollisionRaycaster.set(rayOrigin, baseCollisionDown);
    baseCollisionRaycaster.near = 0;
    baseCollisionRaycaster.far = 40;
    const hits = baseCollisionRaycaster.intersectObject(root, true);
    for (const hit of hits) {
      if (!walkableBaseMeshes.has(hit.object?.name)) continue;
      if (!hit.face?.normal || !hit.object?.matrixWorld) continue;
      const normal = hit.face.normal.clone()
        .applyMatrix3(baseCollisionNormalMatrix.getNormalMatrix(hit.object.matrixWorld))
        .normalize();
      if (normal.dot(baseCollisionUp) < 0.55) continue;
      return { worldPosition: hit.point.clone(), worldNormal: normal, source: 'terrestrial-base-mesh' };
    }
    return null;
  }

  const terminal = new Three.Vector3();
  const padCenter = new Three.Vector3();
  const getConsoleWorldPosition = target => {
    root.updateWorldMatrix(true, true);
    return console.getWorldPosition(target || terminal);
  };
  const getPadWorldPosition = target => {
    root.updateWorldMatrix(true, true);
    return pad.getWorldPosition(target || padCenter);
  };
  const getArrivalWorldPosition = target => {
    root.updateWorldMatrix(true, true);
    pad.updateWorldMatrix(true, false);
    return pad.localToWorld(new Three.Vector3(0, 0.57, 0), target || new Three.Vector3());
  };
  return Object.freeze({
    group: root, console, pad, getConsoleWorldPosition, getPadWorldPosition, getArrivalWorldPosition, sampleCollisionSurface,
    updatePlacement, isDemAnchored: () => demAnchored,
    getPlacement: () => placement,
    getStatus: () => ({ id: TERRESTRIAL_BASE_PROFILE.id, state: demAnchored ? 'dem-anchored' : 'waiting-for-dem', region: TERRESTRIAL_BASE_PROFILE.region }),
    getProfile: () => TERRESTRIAL_BASE_PROFILE,
    dispose() {
      root.removeFromParent();
      root.traverse(object => {
        if (!object.isMesh) return;
        object.geometry?.dispose?.();
      });
      [dark, alloy, white, blue, glow, green, concrete, marking].forEach(material => material.dispose());
    }
  });
}
