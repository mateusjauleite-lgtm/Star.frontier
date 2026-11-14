import * as THREE from 'three';
import {
  EARTH_ATMOSPHERE_LAYERS,
  atmosphereAltitudeToVisualKm
} from './atmosphereModel.js';

export function createAtmosphereRuntime({ group, options, layers }) {
  const atmosphereGroup = new THREE.Group();
  atmosphereGroup.name = 'Earth-Atmosphere-Layers';
  const layerMeshes = [];

  return {
    initialize() {
      const radius = options.radius;
      for (const layer of EARTH_ATMOSPHERE_LAYERS) {
        const innerOffset = atmosphereAltitudeToVisualKm(layer.lowerKm);
        const outerOffset = atmosphereAltitudeToVisualKm(layer.upperKm);
        const geometry = new THREE.SphereGeometry(radius + outerOffset, 96, 64);
        const material = new THREE.ShaderMaterial({
          uniforms: {
            layerColor: { value: new THREE.Color(layer.color) },
            layerOpacity: { value: layer.id === 'troposphere' ? 0.075 : 0.035 },
            viewPower: { value: layer.id === 'exosphere' ? 2.1 : 2.8 }
          },
          vertexShader: `
            varying vec3 vNormal;
            varying vec3 vView;
            void main() {
              vec4 mv = modelViewMatrix * vec4(position, 1.0);
              vNormal = normalize(normalMatrix * normal);
              vView = -mv.xyz;
              gl_Position = projectionMatrix * mv;
            }
          `,
          fragmentShader: `
            uniform vec3 layerColor;
            uniform float layerOpacity;
            uniform float viewPower;
            varying vec3 vNormal;
            varying vec3 vView;
            void main() {
              float rim = pow(1.0 - max(dot(normalize(vNormal), normalize(vView)), 0.0), viewPower);
              gl_FragColor = vec4(layerColor, rim * layerOpacity);
            }
          `,
          side: THREE.BackSide,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = 'Earth-Atmosphere-' + layer.id;
        mesh.userData.atmosphereLayer = {
          id: layer.id,
          lowerAltitudeKm: layer.lowerKm,
          upperAltitudeKm: layer.upperKm,
          visualInnerOffset: innerOffset,
          visualOuterOffset: outerOffset
        };
        atmosphereGroup.add(mesh);
        layerMeshes.push({ mesh, geometry, material });
        layers[layer.id] = mesh;
      }

      group.add(atmosphereGroup);
      layers.atmosphere = atmosphereGroup;
      layers.atmosphereBands = layerMeshes.map(item => item.mesh);
    },
    update() {},
    dispose() {
      group.remove(atmosphereGroup);
      for (const item of layerMeshes) {
        item.geometry.dispose();
        item.material.dispose();
      }
      layerMeshes.length = 0;
    }
  };
}
