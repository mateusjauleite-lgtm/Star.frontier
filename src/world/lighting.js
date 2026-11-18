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
  const starCount = options.starCount ?? STAR_FIELD_COUNT;
  const starRadius = options.starRadius ?? STAR_FIELD_RADIUS;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < starCount; i++) {
    const t = starCount <= 1 ? 0.5 : i / (starCount - 1);
    const y = 1 - 2 * t;
    const ringRadius = Math.sqrt(Math.max(0, 1 - y * y));
    const angle = goldenAngle * i;
    positions.push(
      Math.cos(angle) * ringRadius * starRadius,
      y * starRadius,
      Math.sin(angle) * ringRadius * starRadius
    );
  }

  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3)
  );

  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.5,
      fog: false,
      sizeAttenuation: false
    })
  );
  stars.frustumCulled = false;
  scene.add(stars);

  return {
    stars,
    sun,
    update(_dt, observerPosition) {
      if (observerPosition) stars.position.copy(observerPosition);
    },
    dispose() {
      scene.remove(ambientLight, sunLight, sunlight, fillLight, sun, stars);
      starGeometry.dispose();
      stars.material.dispose();
      sun.traverse(object => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) object.material.dispose();
      });
    }
  };
}
