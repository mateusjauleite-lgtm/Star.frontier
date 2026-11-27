import * as THREE from 'three';

export const EXTERNAL_ELEVATOR_CONFIG = Object.freeze({
  x: 8.5,
  z: 25,
  interactionRadius: 1.9,
  travelDistance: 6.4,
  travelSeconds: 4.0,
  platformHalfSize: 1.9
});

export function createExternalElevator({ deckY = -8.7 } = {}) {
  const group = new THREE.Group();
  group.name = 'Deck4-External-Elevator';
  group.position.set(EXTERNAL_ELEVATOR_CONFIG.x, deckY + 0.01, EXTERNAL_ELEVATOR_CONFIG.z);

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: 0x71899b, metalness: 0.86, roughness: 0.3
  });
  const darkMaterial = new THREE.MeshStandardMaterial({
    color: 0x172737, metalness: 0.78, roughness: 0.38
  });
  const deckMaterial = new THREE.MeshStandardMaterial({
    color: 0x8fa4b5, metalness: 0.76, roughness: 0.34
  });
  const lightMaterial = new THREE.MeshBasicMaterial({ color: 0x39c9f2 });

  const hatch = new THREE.Mesh(
    new THREE.TorusGeometry(2.55, 0.12, 10, 40),
    lightMaterial
  );
  hatch.name = 'External-Elevator-Hatch-Rim';
  hatch.rotation.x = Math.PI / 2;
  hatch.position.y = 0.17;
  group.add(hatch);

  // Guias verticais fixas; a plataforma corre entre elas sem atravessar o casco.
  for (const x of [-1.82, 1.82]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, EXTERNAL_ELEVATOR_CONFIG.travelDistance + 0.55, 0.18),
      frameMaterial
    );
    rail.name = 'External-Elevator-Guide-Rail';
    rail.position.set(x, -EXTERNAL_ELEVATOR_CONFIG.travelDistance / 2, 0);
    group.add(rail);

    for (const y of [-0.28, -EXTERNAL_ELEVATOR_CONFIG.travelDistance + 0.25]) {
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.34), darkMaterial);
      bracket.position.set(x, y, 0);
      group.add(bracket);
    }
  }

  const platform = new THREE.Group();
  platform.name = 'External-Elevator-Platform';
  group.add(platform);

  const platformDeck = new THREE.Mesh(
    new THREE.BoxGeometry(3.55, 0.38, 3.55),
    deckMaterial
  );
  platformDeck.name = 'External-Elevator-Platform-Deck';
  platformDeck.position.y = -0.02;
  platform.add(platformDeck);

  const underside = new THREE.Mesh(
    new THREE.BoxGeometry(3.1, 0.22, 3.1),
    darkMaterial
  );
  underside.position.y = -0.29;
  platform.add(underside);

  // Guarda-corpo traseiro fechado; a frente (+Z) fica com uma abertura
  // central ampla para o personagem desembarcar sem atravessar a estrutura.
  const rearRail = new THREE.Mesh(
    new THREE.BoxGeometry(3.45, 0.72, 0.09),
    frameMaterial
  );
  rearRail.position.set(0, 0.42, -1.72);
  platform.add(rearRail);

  // Na frente, dois trechos laterais preservam proteção sem bloquear a saída.
  for (const x of [-1.28, 1.28]) {
    const frontSegment = new THREE.Mesh(
      new THREE.BoxGeometry(0.89, 0.72, 0.09),
      frameMaterial
    );
    frontSegment.position.set(x, 0.42, 1.72);
    platform.add(frontSegment);
  }

  for (const x of [-1.65, 1.65]) {
    for (const z of [-1.72, 1.72]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.72, 0.09), frameMaterial);
      post.position.set(x, 0.42, z);
      platform.add(post);
    }
  }

  for (const x of [-1.45, 1.45]) {
    const status = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.16), lightMaterial);
    status.position.set(x, 0.205, -1.42);
    platform.add(status);
  }

  let phase = 'top';
  let elapsed = 0;
  let startY = 0;
  let targetY = 0;

  function begin(direction) {
    if (phase === 'moving' || (direction === 'down' && phase !== 'top') ||
        (direction === 'up' && phase !== 'bottom')) return false;
    phase = 'moving';
    elapsed = 0;
    startY = platform.position.y;
    targetY = direction === 'down' ? -EXTERNAL_ELEVATOR_CONFIG.travelDistance : 0;
    return true;
  }

  function update(dt) {
    if (phase !== 'moving') return null;
    elapsed = Math.min(EXTERNAL_ELEVATOR_CONFIG.travelSeconds, elapsed + Math.max(0, dt));
    const t = THREE.MathUtils.clamp(elapsed / EXTERNAL_ELEVATOR_CONFIG.travelSeconds, 0, 1);
    const eased = t * t * (3 - 2 * t);
    platform.position.y = THREE.MathUtils.lerp(startY, targetY, eased);
    if (t < 1) return null;
    platform.position.y = targetY;
    phase = targetY < 0 ? 'bottom' : 'top';
    return phase;
  }

  function getPlatformSurfaceWorld() {
    group.updateWorldMatrix(true, true);
    platform.updateWorldMatrix(true, false);
    const topCenter = platform.localToWorld(new THREE.Vector3(0, 0.17, 0));
    const quaternion = platform.getWorldQuaternion(new THREE.Quaternion());
    const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion).normalize();
    return {
      center: topCenter,
      normal,
      quaternion,
      halfSize: EXTERNAL_ELEVATOR_CONFIG.platformHalfSize
    };
  }

  // Contato invisível limitado à face superior do piso da plataforma.
  // Não cria paredes laterais nem interfere nas colisões do casco.
  function getPlatformContact(worldPosition) {
    if (!worldPosition?.isVector3) return null;
    group.updateWorldMatrix(true, true);
    platform.updateWorldMatrix(true, false);
    const localPosition = platform.worldToLocal(worldPosition.clone());
    const halfX = 1.775;
    const halfZ = 1.775;
    const topY = 0.17;
    const inside = Math.abs(localPosition.x) <= halfX &&
      Math.abs(localPosition.z) <= halfZ;
    if (!inside) return { inside: false, localPosition };

    const surfacePoint = platform.localToWorld(
      new THREE.Vector3(localPosition.x, topY, localPosition.z)
    );
    const normal = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(platform.getWorldQuaternion(new THREE.Quaternion()))
      .normalize();
    return {
      inside: true,
      surfacePoint,
      normal,
      clearance: worldPosition.clone().sub(surfacePoint).dot(normal)
    };
  }

  return {
    group,
    platform,
    begin,
    update,
    get phase() { return phase; },
    get moving() { return phase === 'moving'; },
    getPlatformSurfaceWorld,
    getPlatformContact,
    dispose() {
      group.traverse(object => {
        if (!object.isMesh) return;
        object.geometry?.dispose();
        if (Array.isArray(object.material)) object.material.forEach(material => material.dispose());
        else object.material?.dispose();
      });
      [frameMaterial, darkMaterial, deckMaterial, lightMaterial].forEach(material => material.dispose());
    }
  };
}
