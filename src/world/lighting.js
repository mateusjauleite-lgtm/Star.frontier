import * as THREE from 'three';

// Referencial espacial fixo do sistema.
// Terra e estação mantêm suas coordenadas; o Sol foi reposicionado uma única vez.
const SUN_POSITION = new THREE.Vector3(-1760, 922, -2526);
const SUN_RADIUS = 1200;
const STAR_FIELD_RADIUS = 6500;
const STAR_FIELD_COUNT = 8800;

// Iluminação espacial, estrela central e campo de estrelas.
export function createSpaceLighting(scene, options = {}) {
  const ambientLight = new THREE.HemisphereLight(0x9acfff, 0x111827, 0.75);
  scene.add(ambientLight);

  const sunPosition = SUN_POSITION.clone();
  const sunLight = new THREE.PointLight(0xffd6a0, 260, 18000, 1.15);
  sunLight.position.copy(sunPosition);
  scene.add(sunLight);

  const sunlight = new THREE.DirectionalLight(0xffe0b5, 2.0);
  sunlight.position.copy(sunPosition);
  scene.add(sunlight);

  const fillLight = new THREE.DirectionalLight(0x5caaff, 0.35);
  fillLight.position.set(100, 20, 80);
  scene.add(fillLight);

  const sun = new THREE.Group();
  sun.position.copy(sunPosition);
  scene.add(sun);

  const sunCore = new THREE.Mesh(
    new THREE.SphereGeometry(SUN_RADIUS, 64, 48),
    new THREE.MeshBasicMaterial({ color: 0xffc45c })
  );
  sun.add(sunCore);

  const sunGlow = new THREE.Mesh(
    new THREE.SphereGeometry(SUN_RADIUS * 1.10, 48, 32),
    new THREE.MeshBasicMaterial({
      color: 0xff9e35,
      transparent: true,
      opacity: 0.20,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false
    })
  );
  sun.add(sunGlow);

  const sunHalo = new THREE.Mesh(
    new THREE.SphereGeometry(SUN_RADIUS * 1.25, 48, 32),
    new THREE.MeshBasicMaterial({
      color: 0xff6b28,
      transparent: true,
      opacity: 0.07,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false
    })
  );
  sun.add(sunHalo);

  const positions = [];
  const colors = [];
  const starCount = options.starCount ?? STAR_FIELD_COUNT;
  const starRadius = options.starRadius ?? STAR_FIELD_RADIUS;

  // Gerador determinístico: distribuição irregular sem padrão em espiral ou grade.
  let seed = (options.starSeed ?? 20261117) >>> 0;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let i = 0; i < starCount; i++) {
    // Direção aleatória uniforme na esfera e profundidade em camadas suaves.
    const y = random() * 2 - 1;
    const angle = random() * Math.PI * 2;
    const ringRadius = Math.sqrt(Math.max(0, 1 - y * y));
    const depth = starRadius * (0.72 + random() * 0.28);

    positions.push(
      Math.cos(angle) * ringRadius * depth,
      y * depth,
      Math.sin(angle) * ringRadius * depth
    );

    // Pequenas diferenças de brilho e temperatura, sem transformar o céu em ruído colorido.
    const brightness = 0.62 + random() * 0.38;
    const tint = random();
    colors.push(
      brightness,
      brightness * (0.94 + tint * 0.06),
      brightness * (0.88 + tint * 0.12)
    );
  }

  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3)
  );
  starGeometry.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(colors, 3)
  );

  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({
      color: 0xffffff,
      vertexColors: true,
      size: 1.5,
      fog: false,
      sizeAttenuation: false
    })
  );
  stars.frustumCulled = false;
  scene.add(stars);

  // Um subconjunto leve de estrelas ganha rastros alinhados à câmera durante a dobra.
  const streakCount = Math.min(starCount, 1800);
  const streakPositions = new Float32Array(streakCount * 6);
  const streakGeometry = new THREE.BufferGeometry();
  streakGeometry.setAttribute('position', new THREE.BufferAttribute(streakPositions, 3));
  const streakMaterial = new THREE.LineBasicMaterial({
    color: 0xb7efff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const streaks = new THREE.LineSegments(streakGeometry, streakMaterial);
  streaks.frustumCulled = false;
  streaks.visible = false;
  scene.add(streaks);
  const cameraBackward = new THREE.Vector3(0, 0, 1);

  return {
    stars,
    sun,
    update(_dt, observerPosition, warp = {}) {
      if (observerPosition) {
        stars.position.copy(observerPosition);
        streaks.position.copy(observerPosition);
      }
      const stage = Math.max(0, Math.min(5, Number(warp.warpStage) || 0));
      const active = Boolean(warp.warpActive);
      const exiting = warp.warpTransition === 'exiting';
      const intensity = active ? stage / 5 : exiting ? 0.18 : 0;
      stars.material.size = 1.5 + intensity * 2.2;
      streaks.visible = intensity > 0;
      streakMaterial.opacity = intensity * 0.78;
      if (intensity > 0) {
        if (warp.cameraQuaternion?.isQuaternion) {
          cameraBackward.set(0, 0, 1).applyQuaternion(warp.cameraQuaternion).normalize();
        } else {
          cameraBackward.set(0, 0, 1);
        }
        const length = 8 + intensity * 92;
        const attribute = streakGeometry.getAttribute('position');
        for (let i = 0; i < streakCount; i += 1) {
          const source = i * 3;
          const target = i * 6;
          const x = positions[source];
          const y = positions[source + 1];
          const z = positions[source + 2];
          streakPositions[target] = x;
          streakPositions[target + 1] = y;
          streakPositions[target + 2] = z;
          streakPositions[target + 3] = x + cameraBackward.x * length;
          streakPositions[target + 4] = y + cameraBackward.y * length;
          streakPositions[target + 5] = z + cameraBackward.z * length;
        }
        attribute.needsUpdate = true;
        streakGeometry.computeBoundingSphere();
      }
    },
    dispose() {
      scene.remove(ambientLight, sunLight, sunlight, fillLight, sun, stars, streaks);
      starGeometry.dispose();
      stars.material.dispose();
      streakGeometry.dispose();
      streakMaterial.dispose();
      sun.traverse(object => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) object.material.dispose();
      });
    }
  };
}
