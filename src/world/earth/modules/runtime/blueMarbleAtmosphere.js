import * as THREE from 'three';

/**
 * Thin blue atmospheric limb for the visual Earth.
 * Physical atmospheric sampling remains in atmosphereModel.js.
 */
export function createBlueMarbleAtmosphereRuntime({
  surfaceFrame,
  options,
  layers
}) {
  let mesh = null;
  let geometry = null;
  let material = null;
  let disposed = false;

  return {
    initialize() {
      const radius = options.radius;
      geometry = new THREE.SphereGeometry(radius * 1.018, 96, 64);
      material = new THREE.ShaderMaterial({
        uniforms: {
          atmosphereColor: { value: new THREE.Color(0x3d9cff) },
          atmosphereOpacity: { value: 0.48 },
          atmospherePower: { value: 2.35 }
        },
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vView;
          void main() {
            vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
            vNormal = normalize(normalMatrix * normal);
            vView = -viewPosition.xyz;
            gl_Position = projectionMatrix * viewPosition;
          }
        `,
        fragmentShader: `
          uniform vec3 atmosphereColor;
          uniform float atmosphereOpacity;
          uniform float atmospherePower;
          varying vec3 vNormal;
          varying vec3 vView;
          void main() {
            float facing = max(dot(normalize(vNormal), normalize(vView)), 0.0);
            float rim = pow(1.0 - facing, atmospherePower);
            gl_FragColor = vec4(atmosphereColor, rim * atmosphereOpacity);
          }
        `,
        side: THREE.BackSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      });
      mesh = new THREE.Mesh(geometry, material);
      mesh.name = 'Earth-Blue-Atmosphere';
      mesh.renderOrder = 3;
      surfaceFrame.add(mesh);
      layers.atmosphere = mesh;
      layers.atmosphereVisual = {
        source: 'blue-fresnel-atmosphere',
        physicalModel: './atmosphereModel.js'
      };
    },
    update() {},
    dispose() {
      if (disposed) return;
      disposed = true;
      if (mesh) surfaceFrame.remove(mesh);
      geometry?.dispose();
      material?.dispose();
      if (layers.atmosphere === mesh) layers.atmosphere = null;
    }
  };
}
