/**
 * Owns the frame-level gameplay phases and resolves live dependencies per frame.
 * Domain behavior is preserved; this module relocates orchestration out of main.js.
 */
export function createGameplayFramePhases(getDependencies) {
  if (typeof getDependencies !== 'function') {
    throw new TypeError('As dependências das fases de gameplay precisam ser fornecidas por uma função.');
  }

  return {
    updateEnvironment(dt) {
      const { earthSystem, camera, applyEarthSurfaceRotation, ship, updatePhaserWeapon } = getDependencies();
  earthSystem?.update(dt, camera);
  applyEarthSurfaceRotation(dt);
  if (ship) ship.userData.earthCollisionResolved = false;

  updatePhaserWeapon(dt);
    },

    updateCharacterMode(dt) {
      const { characterCore, updateCharacterMovement, updateCharacterWeapon, updateExternalElevatorAnimation, updateElevatorInteraction, updatePilotInteraction, updateShipManagementInteraction, updateEngineeringConsoleInteraction, updateExternalElevatorInteraction, updateCharacterCamera, updateFlight, updateCamera } = getDependencies();
  if (characterCore.snapshot().mode === 'on-foot') {
    updateCharacterMovement(dt);
    updateCharacterWeapon(dt);
    updateExternalElevatorAnimation(dt);
    updateElevatorInteraction();
    updatePilotInteraction();
    updateExternalElevatorInteraction();
    updateCharacterCamera();
  } else {
    updateFlight(dt);
    updateCamera();
  }
  updateShipManagementInteraction(dt);
  updateEngineeringConsoleInteraction?.(dt);
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
      const { orbitSystem, asteroidSystem, lightingSystem, camera, state } = getDependencies();
      orbitSystem?.update(dt);
      asteroidSystem?.update(dt);
      lightingSystem?.update(dt, camera?.position, {
        warpActive: Boolean(state?.warpDriveActive),
        speed: Number(state?.speed) || 0,
        warpTargetSpeed: Number(state?.warpTargetSpeed) || 0,
        warpStage: state?.warpCurrentStage || 0,
        warpTransition: state?.warpTransition || 'idle',
        cameraQuaternion: camera?.quaternion
      });
    },

    render() {
      const { renderer, scene, camera } = getDependencies();
  renderer.render(scene, camera);
    },

    updateHud() {
      const { $, state } = getDependencies();
  if ($('speed')) $('speed').textContent = Math.round(state.speed);
  if ($('fuel')) $('fuel').textContent = Math.round(state.fuel);
  if ($('cargo')) $('cargo').textContent = state.cargo + ' / 100';
  if ($('hull')) $('hull').textContent = state.hull;
  if ($('shield')) $('shield').textContent = state.shield;

  if ($('hud-credits')) {
    $('hud-credits').textContent = state.credits.toLocaleString('pt-BR');
  }
}
  };
}
