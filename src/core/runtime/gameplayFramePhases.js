/**
 * Owns the frame-level gameplay phases and resolves live dependencies per frame.
 * Domain behavior is preserved; this module relocates orchestration out of main.js.
 */
import { EARTH_ATMOSPHERE_LAYERS, sampleEarthAtmosphere } from '../../world/earth/modules/runtime/atmosphereModel.js';

export function createGameplayFramePhases(getDependencies) {
  if (typeof getDependencies !== 'function') {
    throw new TypeError('As dependências das fases de gameplay precisam ser fornecidas por uma função.');
  }

  return {
    updateEnvironment(dt) {
      const { earthSystem, camera, applyEarthSurfaceRotation, solarSystemDynamics, solarSystemPresentation, scene, ship, updatePhaserWeapon } = getDependencies();
      // Avança o relógio astronômico uma única vez e aplica o ângulo absoluto
      // antes de atualizar atores ancorados à superfície terrestre.
      const solarSnapshot = solarSystemDynamics?.advance(dt) ?? null;
      const solarFrame = solarSnapshot
        ? solarSystemPresentation?.getFrame(solarSnapshot) ?? null
        : null;
      if (scene && solarSnapshot) {
        scene.userData.solarSystemSnapshot = solarSnapshot;
        scene.userData.solarSystemPresentationFrame = solarFrame;
      }
      if (Number.isFinite(solarFrame?.earthRotationAngleRad)) {
        earthSystem?.setSurfaceRotationAngle?.(solarFrame.earthRotationAngleRad);
      }
      earthSystem?.update(dt, camera);
      applyEarthSurfaceRotation();
  if (ship) ship.userData.earthCollisionResolved = false;

  updatePhaserWeapon(dt);
    },

    updateCharacterMode(dt) {
      const { characterCore, syncCharacterDeckFrame, updateCharacterMovement, updateCharacterWeapon, updateExternalElevatorAnimation, updateElevatorInteraction, updateAlexiaInteraction, updatePilotInteraction, updateShipManagementInteraction, updateEngineeringConsoleInteraction, updateRefineryConsoleInteraction, updateDeflectorConsoleInteraction, updateExternalElevatorInteraction, updateCharacterCamera, updateFlight, updateCamera, cameraRuntime, state } = getDependencies();
  syncCharacterDeckFrame?.();
  if (characterCore.snapshot().mode === 'on-foot') {
    updateCharacterMovement(dt);
    updateCharacterWeapon(dt);
    updateExternalElevatorAnimation(dt);
    updateElevatorInteraction();
    updatePilotInteraction();
    updateExternalElevatorInteraction();
    // A nave continua em movimento enquanto a tripulação está a pé,
    // inclusive durante a dobra iniciada ou monitorada pelo console de Engenharia.
    if (state && (Number(state.speed) > 0.01 || state.warpDriveActive || state.warpDriveButton || state.warpTransition === 'exiting' || Object.values(state.maneuver || {}).some(Boolean) || (state.maneuveringAssist !== false && Number(state.altitudeMeters) <= 25000))) {
      updateFlight(dt);
    }
  } else {
    updateFlight(dt);
  }
  // Reaplica o referencial após qualquer deslocamento da nave neste mesmo frame.
  syncCharacterDeckFrame?.();
  // O controlador ativo atualiza a câmera depois do movimento e antes da renderização.
  if (cameraRuntime?.updateActive) cameraRuntime.updateActive();
  else if (characterCore.snapshot().mode === 'on-foot') updateCharacterCamera();
  else updateCamera();
  updateShipManagementInteraction(dt);
  updateEngineeringConsoleInteraction?.(dt);
  // Mantém presença, holograma e ação da Refinaria sincronizados com a posição do personagem.
  updateRefineryConsoleInteraction?.(dt);
  updateDeflectorConsoleInteraction?.(dt);
  updateAlexiaInteraction?.(dt);
    },

    updateLanding(dt) {
      const { earthSystem, setLandingBaseSystem, updateShipLandingGuidance, ship, THREE, shipVisual, shipEarthContactPoints, shipLandingGearContactPoints, forwardVector, state } = getDependencies();
  // A Earth é proprietária da infraestrutura; a gameplay consulta a base
  // criada pelo módulo para contatos e estado de pouso.
  const landingBaseSystem = earthSystem?.getLandingBase?.() ?? null;
      setLandingBaseSystem(landingBaseSystem);
  updateShipLandingGuidance(dt);

  // Mantém uma região local de maior densidade geométrica sob a nave
  // durante a aproximação. A consulta usa o mesmo sampler do relevo global.
  if (ship) {
    const collisionSurface = earthSystem?.getCollisionSurface?.();
    const landingPatch = collisionSurface?.updateHighResolutionPatch?.(ship.position);
    if (landingPatch) {
      // Record the center sample and probe five lower-hull points after
      // updateFlight has applied any required terrain-clearance correction.
      ship.userData.earthSurfaceSample =
        collisionSurface.sampleWorldPosition?.(ship.position) ?? null;

      const sampleShipContacts = () => {
        shipVisual.updateWorldMatrix(true, true);
        const pad = landingBaseSystem?.group;
        if (pad) pad.updateWorldMatrix(true, false);
        const probePoints = [...shipEarthContactPoints, ...shipLandingGearContactPoints];
        return probePoints.map(({ id, point }) => {
          const worldPoint = shipVisual.localToWorld(point.clone());
          const terrain = collisionSurface.sampleWorldPosition?.(worldPoint);
          let chosen = terrain?.worldPosition && terrain?.worldNormal
            ? { worldPosition: terrain.worldPosition, worldNormal: terrain.worldNormal, surface: 'etopo' }
            : null;

          // A face superior da plataforma entra na mesma consulta de contato do ETOPO.
          // Não há um segundo motor físico: escolhemos a superfície mais alta sob a sonda.
          if (pad) {
            const padLocal = pad.worldToLocal(worldPoint.clone());
            const insidePad = padLocal.x * padLocal.x + padLocal.z * padLocal.z <= 146 * 146;
            if (insidePad) {
              const padTop = pad.localToWorld(new THREE.Vector3(padLocal.x, 0.76, padLocal.z));
              const padUp = new THREE.Vector3(0, 1, 0).transformDirection(pad.matrixWorld).normalize();
              const padClearance = worldPoint.clone().sub(padTop).dot(padUp);
              const terrainClearance = chosen
                ? worldPoint.clone().sub(chosen.worldPosition).dot(chosen.worldNormal)
                : Infinity;
              if (padClearance < terrainClearance) {
                chosen = { worldPosition: padTop, worldNormal: padUp, surface: 'landing-pad' };
              }
            }
          }

          if (!chosen) return { id, valid: false };
          const clearanceUnits = worldPoint.clone()
            .sub(chosen.worldPosition)
            .dot(chosen.worldNormal);
          return {
            id,
            valid: Number.isFinite(clearanceUnits),
            clearanceUnits,
            worldNormal: chosen.worldNormal,
            surface: chosen.surface,
            penetrating: clearanceUnits < -0.05
          };
        });
      };

      let contacts = sampleShipContacts();
      const worstPenetration = contacts
        .filter(contact => contact.valid && contact.clearanceUnits < -0.05)
        .sort((a, b) => a.clearanceUnits - b.clearanceUnits)[0];
      if (worstPenetration) {
        // Resolve the deepest hull contact, not just the ship's center point.
        const correctedWorldPosition = ship.getWorldPosition(new THREE.Vector3())
          .addScaledVector(worstPenetration.worldNormal, -worstPenetration.clearanceUnits + 0.05);
        if (ship.parent) {
          ship.parent.updateWorldMatrix(true, false);
          ship.position.copy(ship.parent.worldToLocal(correctedWorldPosition));
        } else {
          ship.position.copy(correctedWorldPosition);
        }
        if (forwardVector.dot(worstPenetration.worldNormal) < 0) state.speed = 0;
        ship.userData.earthCollisionResolved = true;
        contacts = sampleShipContacts();
      }

      const validContacts = contacts.filter(contact =>
        contact.valid && Number.isFinite(contact.clearanceUnits)
      );
      const minimumClearance = validContacts.length
        ? Math.min(...validContacts.map(contact => contact.clearanceUnits))
        : null;
      const padUp = landingBaseSystem
        ? new THREE.Vector3(0, 1, 0).transformDirection(landingBaseSystem.group.matrixWorld).normalize()
        : ship.userData.earthSurfaceSample?.worldNormal?.clone?.().normalize() ?? null;
      const shipUp = shipVisual.localToWorld(new THREE.Vector3(0, 1, 0))
        .sub(shipVisual.getWorldPosition(new THREE.Vector3())).normalize();
      const upAlignment = padUp ? THREE.MathUtils.clamp(shipUp.dot(padUp), -1, 1) : null;
      const attitude = upAlignment === null ? 'unavailable'
        : upAlignment >= Math.cos(THREE.MathUtils.degToRad(12)) ? 'upright'
        : upAlignment <= -Math.cos(THREE.MathUtils.degToRad(12)) ? 'inverted'
        : Math.abs(upAlignment) <= Math.sin(THREE.MathUtils.degToRad(12)) ? 'sideways'
        : 'tilted';
      const gearContacts = contacts.filter(contact =>
        contact.id.startsWith('gear-') && contact.valid && contact.clearanceUnits <= 0.35
      );
      if (shipLandingGearContactPoints.length > 0 &&
          gearContacts.length === shipLandingGearContactPoints.length &&
          attitude === 'upright' && minimumClearance !== null &&
          minimumClearance <= 0.35 && Math.abs(state.speed) <= 1.5) {
        ship.userData.earthSurfaceAnchored = true;
      }
      ship.userData.earthLandingContacts = {
        status: validContacts.length !== contacts.length
          ? 'partial'
          : minimumClearance <= 0.35 ? 'contact' : 'clear',
        contacts,
        minimumClearanceUnits: minimumClearance,
        physicsApplied: Boolean(ship.userData.earthCollisionResolved),
        landingGear: {
          total: shipLandingGearContactPoints.length,
          touching: gearContacts.length,
          allTouching: gearContacts.length === shipLandingGearContactPoints.length
        },
        attitude,
        landingComplete: false
      };
    } else {
      delete ship.userData.earthSurfaceSample;
      delete ship.userData.earthLandingContacts;
    }
  }
    },

    updateWorld(dt) {
      const { orbitSystem, solarSystemDynamics, solarSystemPresentation, asteroidSystem, lightingSystem, camera, shipVisual, THREE, scene, state, updateShipSystems } = getDependencies();
      updateShipSystems?.(dt);
      // Reutiliza o snapshot publicado na fase de ambiente; não avança o relógio duas vezes.
      const solarSnapshot = scene?.userData?.solarSystemSnapshot ?? null;
      const solarFrame = scene?.userData?.solarSystemPresentationFrame ?? null;
      orbitSystem?.update(dt);
      asteroidSystem?.update(dt);
      const shipQuaternion = shipVisual?.getWorldQuaternion && THREE?.Quaternion
        ? shipVisual.getWorldQuaternion(new THREE.Quaternion())
        : camera?.quaternion;
      lightingSystem?.update(dt, camera?.position, {
        shipQuaternion,
        warpActive: Boolean(state?.warpDriveActive),
        speed: Number(state?.speed) || 0,
        warpTargetSpeed: Number(state?.warpTargetSpeed) || 0,
        warpStage: state?.warpCurrentStage || 0,
        warpTransition: state?.warpTransition || 'idle',
        cameraQuaternion: camera?.quaternion,
        solarDirection: solarFrame?.sunDirection
      });
    },

    render() {
      const { renderer, scene, camera } = getDependencies();
  renderer.render(scene, camera);
    },

    updateHud() {
      const { $, state, ship, getActivePilotHudProfile, updateNavigationSensorMap } = getDependencies();
      const activeProfile = getActivePilotHudProfile?.();
      if (activeProfile) {
        $('hud')?.setAttribute('data-active-hud-profile', activeProfile);
        $('flight-controls')?.setAttribute('data-active-hud-profile', activeProfile);
      }
      const altitudeMeters = Number(state.altitudeMeters);
      const altitudeReadout = $('altitude-msl');
      const layerReadout = $('atmosphere-layer');
      const marker = $('altitude-marker');
      const ozoneStatus = $('ozone-status');
      if (Number.isFinite(altitudeMeters)) {
        const altitudeKm = Math.max(0, altitudeMeters / 1000);
        const atmosphere = sampleEarthAtmosphere(altitudeKm);
        const layer = EARTH_ATMOSPHERE_LAYERS.find(item => item.id === atmosphere.layer);
        if (altitudeReadout) altitudeReadout.textContent = altitudeMeters < 1000
          ? Math.round(altitudeMeters).toLocaleString('pt-BR') + ' m'
          : altitudeKm.toFixed(2).replace('.', ',') + ' km';
        if (layerReadout) layerReadout.textContent = layer?.label?.toUpperCase() || 'ATMOSFERA';
        if (marker) {
          const position = Math.log1p(Math.min(10000, altitudeKm) / 12) / Math.log1p(10000 / 12) * 100;
          marker.style.left = Math.max(0, Math.min(100, position)) + '%';
        }
        if (ozoneStatus) ozoneStatus.textContent = altitudeKm >= 15 && altitudeKm <= 35
          ? 'NA FAIXA DE OZÔNIO' : 'FORA DA FAIXA';
      } else {
        if (altitudeReadout) altitudeReadout.textContent = 'SEM REFERÊNCIA';
        if (layerReadout) layerReadout.textContent = 'SEM REFERÊNCIA';
        if (marker) marker.style.left = '0%';
        if (ozoneStatus) ozoneStatus.textContent = 'SEM DADOS';
      }
      const verticalSpeed = Number(state.verticalSpeedMps);
      const verticalReadout = $('vertical-speed');
      if (verticalReadout) verticalReadout.textContent = !Number.isFinite(verticalSpeed)
        ? '—'
        : Math.abs(verticalSpeed) < 0.5 ? '0,0 m/s · NIVELADO'
        : Math.abs(verticalSpeed).toFixed(1).replace('.', ',') + ' m/s · ' +
          (verticalSpeed > 0 ? 'SUBINDO ↑' : 'DESCENDO ↓');
      const terrainReadout = $('terrain-clearance');
      const terrainClearance = ship?.userData?.earthLandingContacts?.minimumClearanceUnits;
      if (terrainReadout) terrainReadout.textContent = Number.isFinite(terrainClearance)
        ? (terrainClearance < 1000
          ? Math.max(0, terrainClearance).toFixed(1).replace('.', ',') + ' m'
          : (terrainClearance / 1000).toFixed(2).replace('.', ',') + ' km')
        : '—';
      if ($('speed')) $('speed').textContent = Math.round(state.speed);
      if ($('fuel')) $('fuel').textContent = Math.round(state.fuel);
      if ($('cargo')) $('cargo').textContent = state.cargo + ' / 100';
      if ($('hull')) $('hull').textContent = state.hull;
      if ($('shield')) $('shield').textContent = state.shield;
      if ($('hud-credits')) $('hud-credits').textContent = state.credits.toLocaleString('pt-BR');

      const position = ship?.position;
      const coordinates = $('navigation-coordinates');
      if (coordinates && position && [position.x, position.y, position.z].every(Number.isFinite)) {
        coordinates.textContent = [position.x, position.y, position.z]
          .map(value => value.toFixed(1)).join(' / ');
        const fullCoordinates = $('navigation-full-coordinates');
        if (fullCoordinates) fullCoordinates.textContent = coordinates.textContent;
      }
      updateNavigationSensorMap?.();
      const target = ship?.userData?.navigationTarget;
      const distance = Number.isFinite(target?.distance) ? target.distance.toFixed(1) + ' u' : 'SEM ALVO';
      const bearing = Number.isFinite(target?.bearing) ? target.bearing.toFixed(1) + '°' : '—';
      if ($('navigation-distance')) $('navigation-distance').textContent = distance;
      if ($('navigation-full-distance')) $('navigation-full-distance').textContent = distance;
      if ($('navigation-bearing')) $('navigation-bearing').textContent = bearing;
      if ($('navigation-full-bearing')) $('navigation-full-bearing').textContent = bearing;
      const combatTarget = ship?.userData?.combatTarget;
      if ($('combat-target-name')) {
        $('combat-target-name').textContent = String(combatTarget?.name || 'SEM ALVO');
      }
      if ($('combat-hull')) $('combat-hull').textContent = Math.round(state.hull) + '%';
      if ($('combat-shield')) $('combat-shield').textContent = Math.round(state.shield) + '%';
      if ($('warp-core-consumption')) {
        $('warp-core-consumption').textContent =
          (Math.max(0, Number(state.coreDilithiumConsumedTotal) || 0)).toFixed(2) + ' u';
      }
      if ($('warp-stability-readout')) {
        const stability = ship?.userData?.warpStability;
        $('warp-stability-readout').textContent = Number.isFinite(stability)
          ? Math.round(Math.max(0, Math.min(1, stability)) * 100) + '%'
          : '—';
      }
    }
  };
}
