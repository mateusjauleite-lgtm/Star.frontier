import * as THREE from 'three';
import { createLandingBase } from '../../../landingBase.js';
import { getLandingSite } from '../../../../ships/flight/landingSites.js';
import { geodeticToEarthLocalFrame } from '../../../../ships/flight/landingAutopilot.js';

const SITE_ID = 'earth-salar-test-candidate';

function createSiteMarker(frame, site) {
  const marker = new THREE.Group();
  marker.name = 'Earth-Uyuni-Persistent-Site-Marker';
  marker.userData.landingSite = {
    id: site.id, latitudeDeg: site.latitudeDeg, longitudeDeg: site.longitudeDeg,
    referencePointId: site.referencePointId, status: site.status
  };
  marker.position.set(...frame.position);
  marker.position.add(new THREE.Vector3(...frame.up).multiplyScalar(2));
  const basis = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(...frame.east), new THREE.Vector3(...frame.up),
    new THREE.Vector3(...frame.north).negate()
  );
  marker.quaternion.setFromRotationMatrix(basis);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0x36caff, transparent: true, opacity: 0.95,
    side: THREE.DoubleSide, depthWrite: false
  });
  const beaconMaterial = new THREE.MeshBasicMaterial({
    color: 0x8beaff, transparent: true, opacity: 0.9
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(9, 0.75, 8, 48), ringMaterial);
  ring.name = 'Uyuni-Site-Reference-Ring';
  ring.rotation.x = Math.PI / 2;
  marker.add(ring);
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 13, 10), beaconMaterial);
  beacon.name = 'Uyuni-Site-Reference-Beacon';
  beacon.position.y = 7;
  marker.add(beacon);
  return marker;
}

export function createEarthInfrastructureRuntime({ group, options, layers }) {
  let marker = null;
  let base = null;
  let disposed = false;
  const site = getLandingSite(SITE_ID);

  return {
    initialize() {
      if (!site) return;
      // O marcador usa a coordenada geodésica e o raio nominal: não depende do ETOPO.
      const frame = geodeticToEarthLocalFrame({
        longitudeDeg: site.longitudeDeg, latitudeDeg: site.latitudeDeg,
        radiusUnits: options.radius
      });
      if (!frame) return;
      marker = createSiteMarker(frame, site);
      group.add(marker);
    },
    update() {
      if (disposed || base || !site || !layers.terrain?.sourceGridReady) return;
      const frame = geodeticToEarthLocalFrame({
        longitudeDeg: site.longitudeDeg, latitudeDeg: site.latitudeDeg,
        radiusUnits: options.radius
      });
      if (!frame) return;
      group.updateWorldMatrix(true, false);
      const candidateWorld = group.localToWorld(new THREE.Vector3(...frame.position));
      const sampled = layers.terrain.collisionSurface?.sampleWorldPosition?.(candidateWorld);
      if (!sampled?.worldPosition || !sampled?.worldNormal) return;
      const inverseEarthMatrix = group.matrixWorld.clone().invert();
      const localPosition = sampled.worldPosition.clone().applyMatrix4(inverseEarthMatrix);
      const up = sampled.worldNormal.clone().transformDirection(inverseEarthMatrix).normalize();
      const north = new THREE.Vector3(...frame.north)
        .transformDirection(group.matrixWorld).transformDirection(inverseEarthMatrix);
      north.addScaledVector(up, -north.dot(up)).normalize();
      if (north.lengthSq() < 0.9 || up.lengthSq() < 0.9) return;
      const east = new THREE.Vector3().crossVectors(north, up).normalize();
      const basis = new THREE.Matrix4().makeBasis(east, up, north.clone().negate());
      base = createLandingBase();
      base.group.position.copy(localPosition).addScaledVector(up, 0.24);
      base.group.quaternion.setFromRotationMatrix(basis);
      group.add(base.group);
      console.info('[Earth] Base de superfície posicionada no ponto UY04 do Salar de Uyuni.');
    },
    getBase() { return base; },
    getMarker() { return marker; },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (base) {
        base.group.parent?.remove(base.group);
        base.dispose();
        base = null;
      }
      if (marker) {
        marker.parent?.remove(marker);
        marker.traverse(object => {
          if (!object.isMesh) return;
          object.geometry?.dispose();
          object.material?.dispose();
        });
        marker = null;
      }
    }
  };
}
