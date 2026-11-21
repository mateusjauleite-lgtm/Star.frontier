import * as THREE from 'three';

const HOLOGRAM_COLOR = 0x67e8ff;

/**
 * Emissor holográfico físico, ancorado ao referencial local da nave.
 * A interface interativa permanece em um HUD HTML independente.
 */
export function createShipManagementHologram({
  parent,
  position,
  scale = 1
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
  projection.position.set(0, 1.72, 0);
  root.add(projection);

  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(2.55, 2.75),
    panelMaterial
  );
  panel.name = 'ManagementHologramField';
  projection.add(panel);

  const framePlaneGeometry = new THREE.PlaneGeometry(2.65, 2.85);
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
    rings[0].rotation.z = elapsed * 0.34;
    rings[1].rotation.z = -elapsed * 0.22;
    projection.position.y = 1.72 + Math.sin(elapsed * 1.35) * 0.035;
    emitterGlow.opacity = 0.62 + (Math.sin(elapsed * 2.4) + 1) * 0.12;
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
