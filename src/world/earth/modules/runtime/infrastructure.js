import * as THREE from 'three';
import { createLandingBase } from '../../../landingBase.js';
import { getLandingSite } from '../../../../ships/flight/landingSites.js';
import { geodeticToEarthLocalFrame } from '../../../../ships/flight/landingAutopilot.js';

const SITE_ID = 'earth-salar-test-candidate';

function alignToSurfaceSample(target, frame, sample, surface, offsetUnits) {
  const inverseSurfaceMatrix = surface.matrix.clone().invert();
  const position = sample.localPosition.clone().applyMatrix4(inverseSurfaceMatrix);
  const up = sample.terrainNormal.clone()
    .transformDirection(inverseSurfaceMatrix).normalize();
  const north = new THREE.Vector3(...frame.north);
  north.addScaledVector(up, -north.dot(up)).normalize();
  if (north.lengthSq() < 0.9 || up.lengthSq() < 0.9) return null;
  const east = new THREE.Vector3().crossVectors(north, up).normalize();
  if (east.lengthSq() < 0.9) return null;
  target.position.copy(position).addScaledVector(up, offsetUnits);
  target.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    east, up, north.clone().negate()
  ));
  return { position, up, north, east };
}

function createSiteMarker(frame, site, sample, surface) {
  const marker = new THREE.Group();
  marker.name = 'Earth-Uyuni-Persistent-Site-Marker';
  marker.userData.landingSite = {
    id: site.id, latitudeDeg: site.latitudeDeg, longitudeDeg: site.longitudeDeg,
    referencePointId: site.referencePointId, status: site.status
  };
  if (!alignToSurfaceSample(marker, frame, sample, surface, 2)) return null;
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
  surface.add(marker);
  return marker;
}

export function createEarthInfrastructureRuntime({ options, layers }) {
  let marker = null;
  let base = null;
  let disposed = false;
  const site = getLandingSite(SITE_ID);
  const surface = layers.surface;
  const collisionSurface = layers.terrain?.collisionSurface;

  const sampleSite = () => {
    if (!surface || !collisionSurface?.sample) return null;
    surface.updateMatrix();
    return collisionSurface.sample(site.longitudeDeg, site.latitudeDeg);
  };

  return {
    initialize() {
      if (!site || !surface || !collisionSurface) return;
      // O marcador nasce com o sampler provisório e permanece preso à malha,
      // mesmo antes do ETOPO e durante a rotação/inclinação axial da Earth.
      const frame = geodeticToEarthLocalFrame({
        longitudeDeg: site.longitudeDeg, latitudeDeg: site.latitudeDeg,
        radiusUnits: options.radius
      });
      const sample = sampleSite();
      if (!frame || !sample) return;
      marker = createSiteMarker(frame, site, sample, surface);
    },
    update() {
      if (disposed || base || !site || !layers.terrain?.sourceGridReady) return;
      const frame = geodeticToEarthLocalFrame({
        longitudeDeg: site.longitudeDeg, latitudeDeg: site.latitudeDeg,
        radiusUnits: options.radius
      });
      const sample = sampleSite();
      if (!frame || !sample) return;

      // sample() devolve a posição e a normal já transformadas pela matriz
      // atual da malha; invertemos essa matriz para anexar a base à própria
      // malha, que carrega sua inclinação axial e rotação diária.
      // Atualiza o marcador do relevo provisório para a altitude ETOPO real.
      if (marker) alignToSurfaceSample(marker, frame, sample, surface, 2);

      base = createLandingBase();
      if (!alignToSurfaceSample(base.group, frame, sample, surface, 0.24)) {
        base.dispose();
        base = null;
        return;
      }
      // A geometria da base usa metros. Convertemos somente suas dimensões
      // locais para a escala visual planetária; a posição geodésica permanece
      // no referencial Earth-local, sem escalar a translação do grupo.
      const metersToEarthUnits = options.radius / 6371008.8;
      base.group.scale.setScalar(metersToEarthUnits);
      base.group.userData.metricScale = {
        sourceUnit: 'meter',
        earthUnitsPerMeter: metersToEarthUnits,
        metersPerEarthUnit: 1 / metersToEarthUnits
      };
      surface.add(base.group);
      console.info('[Earth] Base UY04 posicionada com geometria métrica local.');
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
