import * as THREE from 'three';

// Referencial espacial fixo do sistema. O Sol fica dez vezes mais distante
// sem alterar a direção da luz em relação à Terra.
export const SUN_DISTANCE_SCALE = 12;
const SUN_POSITION_BASE = new THREE.Vector3(-1760, 922, -2526).multiplyScalar(SUN_DISTANCE_SCALE);
const SUN_RADIUS = 1800;
const STAR_FIELD_RADIUS = 6500;
const STAR_FIELD_COUNT = 8800;

// Iluminação espacial, estrela central e campo de estrelas.
export function createSpaceLighting(scene, options = {}) {
  const worldScaleFactor = Number.isFinite(options.worldScaleFactor) && options.worldScaleFactor > 0
    ? options.worldScaleFactor
    : 1;
  const sunPosition = SUN_POSITION_BASE.clone().multiplyScalar(worldScaleFactor);
  const sunRadius = SUN_RADIUS * worldScaleFactor;
  const ambientLight = new THREE.HemisphereLight(0x9acfff, 0x111827, 0.22);
  scene.add(ambientLight);

  const sunlight = new THREE.DirectionalLight(0xffe0b5, 2.0);
  sunlight.position.copy(sunPosition);
  scene.add(sunlight);

  const fillLight = new THREE.DirectionalLight(0x5caaff, 0.12);
  fillLight.position.set(100 * worldScaleFactor, 20 * worldScaleFactor, 80 * worldScaleFactor);
  scene.add(fillLight);

  const sun = new THREE.Group();
  sun.position.copy(sunPosition);
  scene.add(sun);

  const sunCore = new THREE.Mesh(
    new THREE.SphereGeometry(sunRadius, 64, 48),
    new THREE.MeshBasicMaterial({ color: 0xffc45c, fog: false })
  );
  sun.add(sunCore);

  const sunGlow = new THREE.Mesh(
    new THREE.SphereGeometry(sunRadius * 1.10, 48, 32),
    new THREE.MeshBasicMaterial({
      color: 0xff9e35,
      fog: false,
      transparent: true,
      opacity: 0.20,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false
    })
  );
  sun.add(sunGlow);

  const sunHalo = new THREE.Mesh(
    new THREE.SphereGeometry(sunRadius * 1.25, 48, 32),
    new THREE.MeshBasicMaterial({
      color: 0xff6b28,
      fog: false,
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
  const starRadius = (options.starRadius ?? STAR_FIELD_RADIUS) * worldScaleFactor;

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
  const starPositionAttribute = starGeometry.getAttribute('position');
  const starPositionArray = starPositionAttribute.array;

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
  const solarObserver = new THREE.Vector3();
  const solarDirection = new THREE.Vector3();
  const sunRenderDistance = sunPosition.length();

  const cameraBackward = new THREE.Vector3(0, 0, 1);
  const shipBackward = new THREE.Vector3(0, 0, 1);

  return {
    stars,
    sun,
    update(deltaSeconds, observerPosition, warp = {}) {
      const dt = Math.max(0, Number(deltaSeconds) || 0);
      if (observerPosition) {
        stars.position.copy(observerPosition);
        streaks.position.copy(observerPosition);
      }
      // O Sol visual acompanha a direção calculada pela simulação astronômica.
      // A distância é apenas de apresentação; a física mantém metros SI.
      if (warp.solarDirection?.isVector3 && warp.solarDirection.lengthSq() > 1e-12) {
        solarDirection.copy(warp.solarDirection).normalize();
        solarObserver.copy(observerPosition || new THREE.Vector3());
        const visualSunPosition = solarObserver.clone()
          .addScaledVector(solarDirection, sunRenderDistance);
        sun.position.copy(visualSunPosition);
        sunlight.position.copy(visualSunPosition);
        sunlight.target.position.copy(solarObserver);
        sunlight.target.updateMatrixWorld();
      }
      const active = Boolean(warp.warpActive);
      const exiting = warp.warpTransition === 'exiting';
      const speed = Math.max(0, Number(warp.speed) || 0);
      if (warp.cameraQuaternion?.isQuaternion) {
        cameraBackward.set(0, 0, 1).applyQuaternion(warp.cameraQuaternion).normalize();
      } else {
        cameraBackward.set(0, 0, 1);
      }
      if (warp.shipQuaternion?.isQuaternion) {
        shipBackward.set(0, 0, 1).applyQuaternion(warp.shipQuaternion).normalize();
      } else {
        shipBackward.copy(cameraBackward);
      }
      // O campo estelar desloca-se em sentido oposto ao avanço da nave.
      // As estrelas que cruzam o limite são reposicionadas no lado oposto do volume.
      if (speed > 0.01 && dt > 0) {
        const travel = speed * dt * 0.12;
        for (let i = 0; i < starCount; i += 1) {
          const offset = i * 3;
          let x = starPositionArray[offset] + shipBackward.x * travel;
          let y = starPositionArray[offset + 1] + shipBackward.y * travel;
          let z = starPositionArray[offset + 2] + shipBackward.z * travel;
          const projection = x * shipBackward.x + y * shipBackward.y + z * shipBackward.z;
          if (projection > starRadius) {
            x -= shipBackward.x * starRadius * 2;
            y -= shipBackward.y * starRadius * 2;
            z -= shipBackward.z * starRadius * 2;
          } else if (projection < -starRadius) {
            x += shipBackward.x * starRadius * 2;
            y += shipBackward.y * starRadius * 2;
            z += shipBackward.z * starRadius * 2;
          }
          starPositionArray[offset] = x;
          starPositionArray[offset + 1] = y;
          starPositionArray[offset + 2] = z;
        }
        starPositionAttribute.needsUpdate = true;
      }
      const speedIntensity = Math.max(0, Math.min(1, (speed - 75) / (350 - 75)));
      const exitProgress = speedIntensity;
      const intensity = active ? speedIntensity : exiting ? exitProgress * 0.78 : 0;
      stars.material.size = 1.5 + intensity * 2.2;
      streaks.visible = intensity > 0;
      streakMaterial.opacity = intensity * 0.78;
      if (intensity > 0) {
        const length = (8 + intensity * 92) * worldScaleFactor;
        const attribute = streakGeometry.getAttribute('position');
        for (let i = 0; i < streakCount; i += 1) {
          const source = i * 3;
          const target = i * 6;
          const x = starPositionArray[source];
          const y = starPositionArray[source + 1];
          const z = starPositionArray[source + 2];
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
      scene.remove(ambientLight, sunlight, fillLight, sun, stars, streaks);
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
