import * as THREE from 'three';

// Iluminação espacial, estrela central e campo de estrelas.
export function createSpaceLighting(scene, options = {}) {
  const ambientLight = new THREE.HemisphereLight(0x9acfff, 0x111827, 0.75);
  scene.add(ambientLight);

  const sunPosition = new THREE.Vector3(-120, 65, -220);
  const sunLight = new THREE.PointLight(0xffd6a0, 260, 1800, 1.15);
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
    new THREE.SphereGeometry(22, 48, 32),
    new THREE.MeshBasicMaterial({ color: 0xffc45c })
  );
  sun.add(sunCore);

  const sunGlow = new THREE.Mesh(
    new THREE.SphereGeometry(29, 40, 28),
    new THREE.MeshBasicMaterial({
      color: 0xff9e35,
      transparent: true,
      opacity: 0.20,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  sun.add(sunGlow);

  const sunHalo = new THREE.Mesh(
    new THREE.SphereGeometry(37, 40, 28),
    new THREE.MeshBasicMaterial({
      color: 0xff6b28,
      transparent: true,
      opacity: 0.07,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  sun.add(sunHalo);

  const positions = [];
  const starCount = options.starCount ?? 2200;
  for (let i = 0; i < starCount; i++) {
    positions.push(
      (Math.random() - 0.5) * 1200,
      (Math.random() - 0.5) * 800,
      (Math.random() - 0.5) * 1200
    );
  }

  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3)
  );

  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({ color: 0xffffff, size: 1.5 })
  );
  scene.add(stars);

  return {
    stars,
    update() {
      stars.rotation.y += 0.00012;
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
