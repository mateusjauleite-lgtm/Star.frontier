import * as THREE from 'three';

const HOLOGRAM_COLOR = 0x67e8ff;

/**
 * Emissor holográfico físico, ancorado ao referencial local da nave.
 * A interface interativa permanece em um HUD HTML independente.
 */
export function createShipManagementHologram({
  parent,
  position,
  scale = 1.35
} = {}) {
  if (!parent?.add || !position ||
      ![position.x, position.y, position.z].every(Number.isFinite)) {
    throw new TypeError('O ponto de ancoragem do holograma é inválido.');
  }

  const root = new THREE.Group();
  root.name = 'ShipManagementHologramAnchor';
  root.position.set(position.x, position.y, position.z);
  root.scale.setScalar(THREE.MathUtils.clamp(Number(scale) || 1, 0.5, 2));
  root.visible = false;
  root.userData.kind = 'ship-management-hologram';
  parent.add(root);

  const materials = [];
  const addMaterial = material => (materials.push(material), material);
  const metal = addMaterial(new THREE.MeshStandardMaterial({
    color: 0x142b3a,
    metalness: 0.82,
    roughness: 0.3
  }));
  const emitterGlow = addMaterial(new THREE.MeshBasicMaterial({
    color: HOLOGRAM_COLOR,
    transparent: true,
    opacity: 0.78
  }));
  const panelMaterial = addMaterial(new THREE.MeshBasicMaterial({
    color: 0x1b9fc2,
    transparent: true,
    opacity: 0.13,
    side: THREE.DoubleSide,
    depthWrite: false
  }));
  const lineMaterial = addMaterial(new THREE.LineBasicMaterial({
    color: HOLOGRAM_COLOR,
    transparent: true,
    opacity: 0.86
  }));
  const softLineMaterial = addMaterial(new THREE.LineBasicMaterial({
    color: 0x42b9df,
    transparent: true,
    opacity: 0.48
  }));

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.78, 0.9, 0.16, 32),
    metal
  );
  base.name = 'ManagementHologramEmitterBase';
  base.position.y = 0.08;
  root.add(base);

  const emitterRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.025, 8, 48),
    emitterGlow
  );
  emitterRing.rotation.x = Math.PI / 2;
  emitterRing.position.y = 0.17;
  root.add(emitterRing);

  const projection = new THREE.Group();
  projection.name = 'ManagementHologramProjection';
  projection.position.set(0, 1.88, 0);
  root.add(projection);

  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(3.25, 3.35),
    panelMaterial
  );
  panel.name = 'ManagementHologramField';
  projection.add(panel);

  const framePlaneGeometry = new THREE.PlaneGeometry(3.35, 3.45);
  const frameGeometry = new THREE.EdgesGeometry(framePlaneGeometry);
  framePlaneGeometry.dispose();
  const frame = new THREE.LineSegments(frameGeometry, lineMaterial);
  projection.add(frame);

  const makeLine = (points, material = softLineMaterial) => {
    const geometry = new THREE.BufferGeometry().setFromPoints(
      points.map(([x, y, z = 0]) => new THREE.Vector3(x, y, z))
    );
    const line = new THREE.Line(geometry, material);
    projection.add(line);
    return line;
  };

  // Cabeçalho, divisórias e barras de telemetria: geometria 3D leve,
  // sem CanvasTexture ou renderização adicional por frame.
  makeLine([[-1.05, 0.92, 0.012], [1.05, 0.92, 0.012]], lineMaterial);
  makeLine([[-1.05, 0.48, 0.012], [1.05, 0.48, 0.012]]);
  makeLine([[-1.05, -0.58, 0.012], [1.05, -0.58, 0.012]]);
  makeLine([[-0.18, 0.42, 0.012], [-0.18, -0.52, 0.012]]);
  for (let i = 0; i < 5; i += 1) {
    const y = 0.22 - i * 0.16;
    const width = 0.45 + (i % 3) * 0.17;
    makeLine([[0.02, y, 0.014], [0.02 + width, y, 0.014]]);
  }
  for (let i = 0; i < 4; i += 1) {
    const y = -0.82 - i * 0.105;
    makeLine([[-1.02, y, 0.014], [-0.36 + (i % 2) * 0.2, y, 0.014]]);
  }

  const scanMaterial = addMaterial(new THREE.LineBasicMaterial({
    color: 0xb5f7ff, transparent: true, opacity: 0.9
  }));
  const scanLine = makeLine([[-1.52, 0, 0.025], [1.52, 0, 0.025]], scanMaterial);
  scanLine.name = 'ManagementHologramScanSweep';

  const rings = [];
  for (const [radius, tube, tilt] of [[0.58, 0.012, 0], [0.78, 0.009, 0.32]]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, tube, 6, 64),
      lineMaterial
    );
    ring.rotation.set(tilt, 0, 0);
    ring.position.set(0, -0.02, -0.08);
    projection.add(ring);
    rings.push(ring);
  }

  const markers = new THREE.Group();
  markers.position.set(0, 0, 0.035);
  projection.add(markers);
  for (let i = 0; i < 6; i += 1) {
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(i % 2 ? 0.12 : 0.2, 0.025, 0.012),
      i % 2 ? softLineMaterial : lineMaterial
    );
    marker.position.set(-0.76 + (i % 3) * 0.27, 0.68 - Math.floor(i / 3) * 0.16, 0);
    markers.add(marker);
  }

  let elapsed = 0;
  let disposed = false;

  function setVisible(visible) {
    if (disposed) return false;
    root.visible = Boolean(visible);
    return true;
  }

  function update(deltaSeconds = 0) {
    if (disposed || !root.visible) return;
    const dt = THREE.MathUtils.clamp(Number(deltaSeconds) || 0, 0, 0.05);
    elapsed += dt;
    rings[0].rotation.z = elapsed * 0.92;
    rings[1].rotation.z = -elapsed * 0.68;
    emitterRing.rotation.y = elapsed * 0.42;
    projection.position.y = 1.88 + Math.sin(elapsed * 1.55) * 0.095;
    projection.scale.setScalar(1 + Math.sin(elapsed * 1.1) * 0.018);
    scanLine.position.y = -1.42 + ((elapsed * 0.72) % 2.84);
    scanMaterial.opacity = 0.58 + (Math.sin(elapsed * 3.1) + 1) * 0.19;
    emitterGlow.opacity = 0.58 + (Math.sin(elapsed * 2.4) + 1) * 0.18;
  }

  function dispose() {
    if (disposed) return false;
    disposed = true;
    parent.remove(root);
    root.traverse(object => object.geometry?.dispose?.());
    materials.forEach(material => material.dispose());
    return true;
  }

  return Object.freeze({
    root,
    setVisible,
    update,
    dispose,
    getAnchor: () => root
  });
}


/**
 * Projeção industrial da Refinaria: compartimentos, câmara de processamento
 * e fluxo de material. Os indicadores são alimentados pela telemetria real.
 */
export function createRefineryHologram({
  parent,
  position,
  scale = 1.15,
  getTelemetry = () => null
} = {}) {
  if (!parent?.add || !position ||
      ![position.x, position.y, position.z].every(Number.isFinite)) {
    throw new TypeError('O ponto de ancoragem do holograma da Refinaria é inválido.');
  }

  const root = new THREE.Group();
  root.name = 'Dilithium-Refinery-Hologram';
  root.position.set(position.x, position.y, position.z);
  root.scale.setScalar(THREE.MathUtils.clamp(Number(scale) || 1, 0.5, 2));
  root.visible = false;
  root.userData.kind = 'dilithium-refinery-hologram';
  parent.add(root);

  const materials = [];
  const own = material => (materials.push(material), material);
  const baseMaterial = own(new THREE.MeshStandardMaterial({
    color: 0x102b3b, metalness: 0.86, roughness: 0.28
  }));
  const cyan = own(new THREE.MeshBasicMaterial({
    color: 0x54e7ff, transparent: true, opacity: 0.88
  }));
  const soft = own(new THREE.MeshBasicMaterial({
    color: 0x279fc4, transparent: true, opacity: 0.34
  }));
  const field = own(new THREE.MeshBasicMaterial({
    color: 0x168bb2, transparent: true, opacity: 0.11,
    side: THREE.DoubleSide, depthWrite: false
  }));
  const activeGlow = own(new THREE.MeshBasicMaterial({
    color: 0x5bffd0, transparent: true, opacity: 0.9
  }));

  const addMesh = (parentNode, geometry, material, name, xyz) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(...xyz);
    parentNode.add(mesh);
    return mesh;
  };

  addMesh(root, new THREE.CylinderGeometry(0.88, 1.02, 0.13, 40),
    baseMaterial, 'Refinery-Hologram-Projector-Base', [0, 0.07, 0]);
  const emitter = addMesh(root, new THREE.TorusGeometry(0.69, 0.025, 8, 48),
    cyan, 'Refinery-Hologram-Emitter-Ring', [0, 0.16, 0]);
  emitter.rotation.x = Math.PI / 2;

  const projection = new THREE.Group();
  projection.name = 'Refinery-Industrial-Projection';
  projection.position.y = 1.55;
  root.add(projection);
  addMesh(projection, new THREE.PlaneGeometry(4.6, 2.45),
    field, 'Refinery-Projection-Field', [0, 0, -0.12]);

  const makeLine = (points, material = soft) => {
    const geometry = new THREE.BufferGeometry().setFromPoints(
      points.map(([x, y, z = 0]) => new THREE.Vector3(x, y, z))
    );
    const line = new THREE.Line(geometry, material);
    projection.add(line);
    return line;
  };

  makeLine([[-2.1, 0.94, 0], [2.1, 0.94, 0]], cyan);
  makeLine([[-2.1, -0.93, 0], [2.1, -0.93, 0]], cyan);
  const stations = [];
  const stationX = [-1.45, 0, 1.45];
  const stationLabels = ['RAW-ORE', 'REFINER', 'REFINED'];
  for (let i = 0; i < stationX.length; i += 1) {
    const x = stationX[i];
    const group = new THREE.Group();
    group.position.set(x, 0.02, 0.02);
    projection.add(group);
    const shell = addMesh(group,
      i === 1
        ? new THREE.CylinderGeometry(0.38, 0.43, 0.78, 20, 1, true)
        : new THREE.BoxGeometry(0.72, 0.72, 0.42),
      i === 1 ? cyan : soft,
      'Refinery-Hologram-' + stationLabels[i], [0, 0.1, 0]);
    const core = addMesh(group,
      i === 1 ? new THREE.SphereGeometry(0.2, 16, 12) : new THREE.OctahedronGeometry(0.22, 0),
      i === 1 ? activeGlow : cyan,
      'Refinery-Hologram-Content-' + stationLabels[i], [0, 0.1, 0.24]);
    const bar = addMesh(group, new THREE.BoxGeometry(0.68, 0.055, 0.025),
      cyan, 'Refinery-Hologram-Level-' + stationLabels[i], [0, -0.54, 0.04]);
    bar.scale.x = 0.02;
    stations.push({ shell, core, bar });
  }

  const flow = makeLine([
    [-1.0, 0.1, 0.1], [-0.45, 0.1, 0.1], [0.45, 0.1, 0.1], [1.0, 0.1, 0.1]
  ], activeGlow);
  flow.name = 'Refinery-Hologram-Material-Flow';
  const scan = makeLine([[-2.0, 0, 0.14], [2.0, 0, 0.14]], cyan);
  scan.name = 'Refinery-Hologram-Scanline';

  let elapsed = 0;
  let disposed = false;
  function setVisible(visible) {
    if (disposed) return false;
    root.visible = Boolean(visible);
    return true;
  }
  function update(deltaSeconds = 0) {
    if (disposed || !root.visible) return;
    const dt = THREE.MathUtils.clamp(Number(deltaSeconds) || 0, 0, 0.05);
    elapsed += dt;
    const data = getTelemetry?.() || {};
    const raw = ratio(data.rawOre, data.rawCapacity);
    const buffer = ratio(data.refinedBuffer, data.refinedCapacity);
    const core = ratio(data.coreDilithium, data.coreCapacity);
    const processing = Boolean(data.refineryEnabled && Number(data.rawOre) > 0);
    stations[0].bar.scale.x = Math.max(0.02, raw);
    stations[1].bar.scale.x = processing ? 1 : 0.02;
    stations[2].bar.scale.x = Math.max(0.02, Math.max(buffer, core));
    stations[1].shell.material = processing ? activeGlow : soft;
    stations[1].core.material = processing ? activeGlow : cyan;
    stations[0].core.scale.setScalar(0.72 + raw * 0.5);
    stations[2].core.scale.setScalar(0.72 + Math.max(buffer, core) * 0.5);
    stations[1].core.scale.setScalar(0.9 + Math.sin(elapsed * 4.2) * (processing ? 0.16 : 0.025));
    flow.visible = processing;
    flow.material = processing ? activeGlow : soft;
    flow.computeLineDistances?.();
    scan.position.y = -0.82 + ((elapsed * 0.82) % 1.64);
    emitter.rotation.z = elapsed * 0.6;
    projection.position.y = 1.55 + Math.sin(elapsed * 1.35) * 0.045;
    projection.scale.y = 1 + Math.sin(elapsed * 1.8) * 0.012;
    cyan.opacity = 0.68 + (Math.sin(elapsed * 2.6) + 1) * 0.13;
  }
  function dispose() {
    if (disposed) return false;
    disposed = true;
    parent.remove(root);
    root.traverse(object => object.geometry?.dispose?.());
    materials.forEach(material => material.dispose());
    return true;
  }
  return Object.freeze({ root, setVisible, update, dispose, getAnchor: () => root });
}

function ratio(value, capacity) {
  const amount = Math.max(0, Number(value) || 0);
  const limit = Math.max(0.000001, Number(capacity) || 1);
  return THREE.MathUtils.clamp(amount / limit, 0, 1);
}
