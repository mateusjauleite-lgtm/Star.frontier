import * as THREE from 'three';

export function createAtmosphereRuntime({ group, options, layers }) {
  let mesh, geometry, material;
  return {
    initialize() {
      geometry = new THREE.SphereGeometry(options.radius * 1.075, 128, 96);
      material = new THREE.ShaderMaterial({
        uniforms: { glowColor: { value: new THREE.Color(0x398fe8) }, intensity: { value: .72 } },
        vertexShader: `varying vec3 vNormal; varying vec3 vView; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vNormal=normalize(normalMatrix*normal); vView=-mv.xyz; gl_Position=projectionMatrix*mv; }`,
        fragmentShader: `uniform vec3 glowColor; uniform float intensity; varying vec3 vNormal; varying vec3 vView; void main(){ float rim=pow(1.0-max(dot(normalize(vNormal),normalize(vView)),0.0),2.35); gl_FragColor=vec4(glowColor,rim*intensity); }`,
        side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false
      });
      mesh = new THREE.Mesh(geometry, material);
      mesh.name = 'Earth-New-Atmosphere';
      group.add(mesh); layers.atmosphere = mesh;
    },
    update() {},
    dispose() { if (mesh) group.remove(mesh); geometry?.dispose(); material?.dispose(); }
  };
}
