/**
 * Owns the ship's current manual flight control loop.
 * The existing gameplay speed scale, world/local transforms and collision
 * responses are intentionally preserved; this module does not use SI units.
 */
export function createShipFlightController(dependencies = {}) {
  const {
    THREE,
    state,
    getShip,
    getShipYaw,
    getShipPitch,
    getShipVisual,
    getEngineFlames,
    getEngineLights,
    getEarthSystem,
    getLandingGearContactPoints = () => [],
    getLandingAutopilot,
    getFlightQuaternion,
    getForwardVector,
    advanceFlightDynamics,
    shipAudio,
    cancelLandingGuidance,
    getElement = () => null,
    toast = () => {}
  } = dependencies;

  const required = {
    THREE, state, getShip, getShipYaw, getShipPitch, getShipVisual,
    getFlightQuaternion, getForwardVector, advanceFlightDynamics, shipAudio
  };
  for (const [name, value] of Object.entries(required)) {
    if (!value) throw new TypeError('Dependência obrigatória do controle de voo ausente: ' + name);
  }

  let pitchAngle = 0;

  function update(deltaSeconds) {
    const ship = getShip();
    const shipYaw = getShipYaw();
    const shipPitch = getShipPitch();
    const shipVisual = getShipVisual();
    if (!ship || !shipYaw || !shipPitch || !shipVisual) return false;

    const safeDt = THREE.MathUtils.clamp(
      Number.isFinite(deltaSeconds) ? deltaSeconds : 0, 0, 0.04
    );
    const sensitivity = Number(state.settings.sensitivity) || 1;
    const hasPropulsion = state.fuel > 0 || state.refinedDilithium > 0;
    const moveX = hasPropulsion ? state.move.x : 0;
    const moveY = hasPropulsion ? state.move.y : 0;
    const manualOverride = Math.abs(moveX) > 0.015 ||
      Math.abs(moveY) > 0.015 ||
      state.throttle || state.braking || state.warpDriveButton;

    if (manualOverride && ship.userData.earthSurfaceAnchored) {
      ship.userData.earthSurfaceAnchored = false;
    }
    if (manualOverride && getLandingAutopilot()?.snapshot?.().active) {
      cancelLandingGuidance?.('manual-override');
      const status = getElement('landing-status');
      if (status) {
        status.textContent = 'Comando manual assumido. A orientação foi cancelada e o botão POUSAR foi restaurado.';
      }
      toast('Orientação automática cancelada: controle manual assumido.');
    }

    // Guinada no eixo vertical global; arfagem no eixo lateral local.
    // Y negativo sobe; Y positivo desce.
    shipYaw.rotation.y -= moveX * 1.25 * safeDt * sensitivity;

    const pitchInput = moveY * safeDt * sensitivity;
    const maxPitch = THREE.MathUtils.degToRad(65);
    pitchAngle = THREE.MathUtils.clamp(
      pitchAngle - pitchInput, -maxPitch, maxPitch
    );
    shipPitch.rotation.x = pitchAngle;

    // A inclinação visual não altera a orientação usada para navegar.
    const targetRoll = -moveX * 0.25;
    shipVisual.rotation.z = THREE.MathUtils.lerp(
      shipVisual.rotation.z, targetRoll, Math.min(1, safeDt * 3)
    );

    const warpDriveActive = advanceFlightDynamics(state, safeDt);

    shipAudio.updateFlight({
      throttle: Boolean(state.throttle && state.fuel > 0),
      warpDriveActive,
      braking: Boolean(state.braking),
      moveX,
      moveY,
      speed: state.speed,
      nacellesLit: (getEngineLights() || []).some(
        light => light.visible && light.intensity > 2
      ),
      dt: safeDt
    });

    // O nariz do casco está no eixo local -Z; a direção é calculada no mundo.
    const flightQuaternion = getFlightQuaternion();
    const forwardVector = getForwardVector();
    shipVisual.getWorldQuaternion(flightQuaternion);
    forwardVector.set(0, 0, -1).applyQuaternion(flightQuaternion).normalize();

    ship.parent?.updateWorldMatrix(true, false);
    const nextShipWorldPosition = ship.getWorldPosition(new THREE.Vector3())
      .addScaledVector(forwardVector, state.speed * safeDt * 0.45);
    if (ship.parent) {
      ship.position.copy(ship.parent.worldToLocal(nextShipWorldPosition));
    } else {
      ship.position.copy(nextShipWorldPosition);
    }

    // Plataforma e observatório permanecem sólidos para a nave.
    const stationCenter = new THREE.Vector3(24, 3, -65);
    const stationScale = 1.18;
    const dx = ship.position.x - stationCenter.x;
    const dz = ship.position.z - stationCenter.z;
    const horizontalDistance = Math.hypot(dx, dz);
    let relativeHeight = ship.position.y - stationCenter.y;

    const landingDeckTop = 2.13 * stationScale;
    const shipClearance = 1.2;
    const landingDeckRadius = 11.65 * stationScale - 0.4;
    if (
      horizontalDistance < landingDeckRadius &&
      relativeHeight >= landingDeckTop - shipClearance &&
      relativeHeight < landingDeckTop + shipClearance
    ) {
      ship.position.y = stationCenter.y + landingDeckTop + shipClearance;
      relativeHeight = ship.position.y - stationCenter.y;
      state.speed = Math.min(state.speed, 8);
    }

    const lowerDeckRadius = 8.65 * stationScale + 2.4;
    if (
      horizontalDistance < lowerDeckRadius &&
      relativeHeight > -4.2 &&
      relativeHeight < landingDeckTop - shipClearance
    ) {
      const safeDistance = Math.max(horizontalDistance, 0.001);
      const nx = horizontalDistance > 0.001 ? dx / safeDistance : 1;
      const nz = horizontalDistance > 0.001 ? dz / safeDistance : 0;
      ship.position.x = stationCenter.x + nx * lowerDeckRadius;
      ship.position.z = stationCenter.z + nz * lowerDeckRadius;
      state.speed = Math.min(state.speed, 8);
    }

    // O contato da nave é medido nas quatro sapatas do trem de pouso,
    // não na origem do casco. A origem fica no centro do modelo e usar uma
    // folga fixa nela mantém a nave artificialmente suspensa sobre o terreno.
    ship.userData.earthCollisionResolved = false;
    const earthCollisionSurface = getEarthSystem()?.getCollisionSurface?.();
    ship.updateWorldMatrix(true, false);
    shipVisual.updateWorldMatrix(true, true);
    const landingContacts = getLandingGearContactPoints?.() || [];
    let closestContact = null;

    for (const contactPoint of landingContacts) {
      if (!contactPoint?.point?.isVector3) continue;
      const pointWorld = shipVisual.localToWorld(contactPoint.point.clone());
      const terrain = earthCollisionSurface?.sampleWorldPosition?.(pointWorld);
      if (!terrain?.worldPosition || !terrain?.worldNormal) continue;
      const normal = terrain.worldNormal.clone().normalize();
      const clearance = pointWorld.clone().sub(terrain.worldPosition).dot(normal);
      if (!Number.isFinite(clearance)) continue;
      if (!closestContact || clearance < closestContact.clearance) {
        closestContact = { clearance, normal };
      }
    }

    // Fallback conservador para mundos/testes sem pontos de trem de pouso.
    if (!closestContact && !landingContacts.length) {
      const rootWorldPosition = ship.getWorldPosition(new THREE.Vector3());
      const terrain = earthCollisionSurface?.sampleWorldPosition?.(rootWorldPosition);
      if (terrain?.worldPosition && terrain?.worldNormal) {
        const normal = terrain.worldNormal.clone().normalize();
        closestContact = {
          clearance: rootWorldPosition.clone().sub(terrain.worldPosition).dot(normal),
          normal
        };
      }
    }

    // Os 0,35 são uma tolerância para reconhecer contato no trem, não
    // uma distância mínima imposta às rodas. O ponto amostrado já representa
    // a parte inferior do pneu; a correção só ocorre se ele penetrar no solo.
    const landingContactTolerance = 0.35;
    const landingContactTargetClearance = 0;
    if (closestContact && closestContact.clearance < landingContactTargetClearance) {
      const correction = landingContactTargetClearance - closestContact.clearance;
      const correctedWorldPosition = ship.getWorldPosition(new THREE.Vector3())
        .addScaledVector(closestContact.normal, correction);
      if (ship.parent) {
        ship.parent.updateWorldMatrix(true, false);
        ship.position.copy(ship.parent.worldToLocal(correctedWorldPosition));
      } else {
        ship.position.copy(correctedWorldPosition);
      }
      if (forwardVector.dot(closestContact.normal) < 0) state.speed = 0;
      ship.userData.earthCollisionResolved = true;
      ship.userData.earthCollisionClearanceUnits = landingContactTargetClearance;
      ship.userData.earthLandingContactToleranceUnits = landingContactTolerance;
      ship.userData.earthLandingContactPoint = closestContact.clearance;
    }

    // Efeitos das nacelles.
    const warpStage = Number(state.warpCurrentStage) || 0;
    const enginePower = warpDriveActive ? 1.25 + warpStage * 0.35 : (state.throttle ? 1.25 : 0.65);
    (getEngineFlames() || []).forEach(flame => {
      flame.scale.set(
        warpDriveActive ? 1 + warpStage * 0.09 : 1,
        warpDriveActive ? 1.5 + warpStage * 0.2 : enginePower,
        warpDriveActive ? 1 + warpStage * 0.09 : 1
      );
      flame.material.opacity = warpDriveActive ? 0.68 + warpStage * 0.055 : (state.throttle ? 0.7 : 0.3);
    });
    (getEngineLights() || []).forEach(light => {
      light.intensity = warpDriveActive ? 3.5 + warpStage * 1.15 : (state.throttle ? 4 : 1.5);
    });

    // HUD de dobra: cinco estágios selecionáveis e reserva em unidades de dilítio.
    const warpDriveLevel = getElement('warp-drive-level');
    if (warpDriveLevel) {
      warpDriveLevel.textContent = warpDriveActive
        ? 'DOBRA ' + warpStage
        : state.warpTransition === 'exiting' ? 'SAINDO DA DOBRA' : 'DESATIVADA';
    }
    const dilithiumReadout = getElement('warp-dilithium-readout');
    if (dilithiumReadout) dilithiumReadout.textContent = (Math.max(0, Number(state.refinedDilithium) || 0)).toFixed(2) + ' u';
    const warpSpeedReadout = getElement('warp-speed-readout');
    if (warpSpeedReadout) warpSpeedReadout.textContent = String(Math.round(state.speed));
    const stageControls = getElement('warp-stage-controls');
    if (stageControls) stageControls.hidden = !warpDriveActive;
    const stageButtons = getElement('warp-stage-controls')?.querySelectorAll('[data-warp-stage]') || [];
    stageButtons.forEach(button => {
      const selected = warpDriveActive && Number(button.dataset.warpStage) === warpStage;
      button.classList.toggle('active', selected);
      button.disabled = state.propulsionAuthority === 'engineering';
      button.setAttribute('aria-pressed', String(selected));
    });
    const warpButton = getElement('warp-drive-btn');
    if (warpButton) {
      warpButton.classList.toggle('active', warpDriveActive || Boolean(state.warpDriveButton));
      warpButton.textContent = warpDriveActive ? '⚡ DESATIVAR DOBRA' : state.warpTransition === 'exiting' ? 'SAINDO DA DOBRA' : '⚡ ATIVAR DOBRA';
      warpButton.setAttribute('aria-pressed', String(Boolean(state.warpDriveButton)));
    }
    return true;
  }

  return {
    update,
    resetPitch() { pitchAngle = 0; },
    get pitchAngle() { return pitchAngle; }
  };
}
