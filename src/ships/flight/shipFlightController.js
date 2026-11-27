/**
 * Owns manual flight, SI propulsion, response to the Earth-owned gravity field and collisions.
 */
import { STATION_WORLD_POSITION } from '../../world/earth/worldScale.js';
import { EARTH_GRAVITATIONAL_PARAMETER_M3_S2 } from '../../physics/planetaryGravitySystem.js';
import { calculateManeuveringAcceleration, getConventionalFlightSpeedLimit, integrateWorldVelocity, projectRadialVelocity, SPEED_OF_LIGHT_MPS } from '../systems/maneuveringThrusterSystem.js';
import { calculateAuxiliaryStabilizationAcceleration } from '../systems/auxiliaryThrusterSystem.js';

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
    getManeuveringFlames = () => [],
    getManeuveringLights = () => [],
    getEarthSystem,
    getGravityKernel = () => null,
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
    const earthSystem = getEarthSystem?.();

    const safeDt = THREE.MathUtils.clamp(
      Number.isFinite(deltaSeconds) ? deltaSeconds : 0, 0, 0.04
    );
    const sensitivity = Number(state.settings.sensitivity) || 1;
    const hasPropulsion = Number(state.fuel) > 0 || Number(state.nitro) > 0;
    const moveX = hasPropulsion ? state.move.x : 0;
    const moveY = hasPropulsion ? state.move.y : 0;
    const manualOverride = Math.abs(moveX) > 0.015 ||
      Math.abs(moveY) > 0.015 ||
      state.throttle || state.braking || state.warpDriveButton ||
      Object.values(state.maneuver || {}).some(Boolean);

    if (manualOverride && ship.userData.earthSurfaceAnchored) {
      const launchPosition = ship.getWorldPosition(new THREE.Vector3()).toArray();
      const inheritedRotationVelocity = earthSystem?.getPlanetaryGravitySystem?.()
        ?.surfaceVelocityAt?.(launchPosition);
      if (inheritedRotationVelocity) state.gravityVelocity = inheritedRotationVelocity;
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

    // Referencial SI: o mundo usa 1 unidade visual por metro.
    ship.parent?.updateWorldMatrix(true, false);
    const currentWorldPosition = ship.getWorldPosition(new THREE.Vector3());
    const earthCenter = earthSystem?.group?.getWorldPosition(new THREE.Vector3());
    const planetaryProfile = earthSystem?.getPlanetaryProfile?.();
    const earthRadius = Number(planetaryProfile?.render?.visualRadiusUnits) || 6371008.8;
    let altitudeMeters = Infinity;
    let gravityAcceleration = [0, 0, 0];
    let radialUp = new THREE.Vector3(0, 1, 0);
    if (earthCenter) {
      const radial = currentWorldPosition.clone().sub(earthCenter);
      const distance = radial.length();
      altitudeMeters = Math.max(0, distance - earthRadius);
      if (distance > 1) radialUp.copy(radial).normalize();
      state.altitudeMeters = altitudeMeters;
      // Telemetria de distância em coordenadas WORLD: permite distinguir
      // velocidade de avanço de aproximação radial real ao planeta.
      state.distanceToEarthCenterMeters = distance;
      state.distanceToEarthSurfaceMeters = altitudeMeters;
      // A dobra não exige escapar da esfera de influência da Terra.
      // Gravidade, telemetria orbital e colisão continuam ativos durante o trânsito.
      state.warpSafetyLock = false;
      if (distance > 1) {
        const worldPosition = currentWorldPosition.toArray();
        const acceleration = earthSystem?.getPlanetaryGravitySystem?.()
          ?.accelerationAt?.(worldPosition) ?? getGravityKernel?.()?.acceleration?.({
            position: worldPosition,
            bodies: [{
              position: earthCenter.toArray(),
              mu: EARTH_GRAVITATIONAL_PARAMETER_M3_S2
            }]
          });
        if (acceleration) gravityAcceleration = acceleration;
        else {
          const factor = -EARTH_GRAVITATIONAL_PARAMETER_M3_S2 / Math.pow(distance, 3);
          gravityAcceleration = radial.toArray().map(value => value * factor);
        }
      }
    } else {
      state.altitudeMeters = Infinity;
      state.distanceToEarthCenterMeters = Infinity;
      state.distanceToEarthSurfaceMeters = Infinity;
      state.conventionalSpeedLimit = getConventionalFlightSpeedLimit(Infinity);
      state.warpSafetyLock = false;
    }

    const flightQuaternion = getFlightQuaternion();
    const forwardVector = getForwardVector();
    shipVisual.getWorldQuaternion(flightQuaternion);
    forwardVector.set(0, 0, -1).applyQuaternion(flightQuaternion).normalize();
    const shipRight = new THREE.Vector3(1, 0, 0).applyQuaternion(flightQuaternion).normalize();
    const maneuver = state.maneuver || {};
    const lateralInput = (maneuver.right ? 1 : 0) - (maneuver.left ? 1 : 0);
    const verticalInput = (maneuver.up ? 1 : 0) - (maneuver.down ? 1 : 0);
    if (state.landingAutopilotActive && !state.landingAutopilotVelocityInitialized) {
      const inheritedVelocity = Array.isArray(state.gravityVelocity) && state.gravityVelocity.length === 3
        ? state.gravityVelocity : [0, 0, 0];
      state.gravityVelocity = inheritedVelocity.map((value, axis) =>
        value + forwardVector.getComponent(axis) * (Number(state.speed) || 0)
      );
      state.speed = 0;
      state.landingAutopilotVelocityInitialized = true;
    }
    const currentGravityVelocity = Array.isArray(state.gravityVelocity) && state.gravityVelocity.length === 3
      ? state.gravityVelocity : [0, 0, 0];
    const radialVelocity = projectRadialVelocity(currentGravityVelocity, [radialUp.x, radialUp.y, radialUp.z]);
    // Velocidade vertical radial: gravidade mais a projeção do avanço da nave.
    state.verticalSpeedMps = radialVelocity + (Number(state.speed) || 0) * forwardVector.dot(radialUp);
    state.conventionalSpeedLimit = getConventionalFlightSpeedLimit(altitudeMeters, {
      throttle: Boolean(state.throttle),
      climbAlignment: forwardVector.dot(radialUp),
      verticalSpeed: state.verticalSpeedMps
    });
    const maneuverAcceleration = calculateManeuveringAcceleration({
      gravityAcceleration,
      radialUp: [radialUp.x, radialUp.y, radialUp.z],
      shipRight: [shipRight.x, shipRight.y, shipRight.z],
      lateralInput,
      verticalInput,
      altitudeMeters,
      assistEnabled: state.maneuveringAssist !== false && !state.landingAutopilotActive,
      radialVelocity
    });
    const auxiliaryAcceleration = calculateAuxiliaryStabilizationAcceleration({
      velocity: currentGravityVelocity,
      radialUp: [radialUp.x, radialUp.y, radialUp.z],
      altitudeMeters,
      enabled: true
    });
    state.auxiliaryThrustersActive = Math.hypot(...auxiliaryAcceleration) > 0.1;
    if (earthCenter) {
      const warpTransit = Boolean(state.warpDriveActive || state.warpDriveButton ||
        (state.warpTransition === 'exiting' && Number(state.warpSpeedC) > 0));
      const landingControl = !warpTransit && state.landingAutopilotActive &&
        Array.isArray(state.landingAutopilotControlAccelerationWorld) &&
        state.landingAutopilotControlAccelerationWorld.length === 3 &&
        state.landingAutopilotControlAccelerationWorld.every(Number.isFinite)
        ? state.landingAutopilotControlAccelerationWorld
        : null;
      const totalAcceleration = gravityAcceleration.map((value, axis) => {
        // Durante a dobra, só a gravidade planetária continua atuando;
        // manobras e assistência ficam suspensas até a nave sair do campo.
        if (warpTransit) return value;
        const uncontrolled = value + maneuverAcceleration[axis] + auxiliaryAcceleration[axis];
        return landingControl
          ? uncontrolled + landingControl[axis] - value - auxiliaryAcceleration[axis]
          : uncontrolled;
      });
      state.gravityVelocity = integrateWorldVelocity(
        currentGravityVelocity,
        totalAcceleration,
        safeDt,
        0
      ) || currentGravityVelocity;
    }
    const warpDriveActive = advanceFlightDynamics(state, safeDt);
    const throttleButton = getElement('throttle-btn');
    if (throttleButton) {
      throttleButton.classList.toggle('active', Boolean(state.throttle));
      throttleButton.setAttribute('aria-pressed', String(Boolean(state.throttle)));
    }
    const warpTravelActive = warpDriveActive || (state.warpTransition === 'exiting' && Number(state.warpSpeedC) > 0);

    shipAudio.updateFlight({
      throttle: Boolean(state.throttle && state.fuel > 0),
      warpDriveActive: warpTravelActive,
      braking: Boolean(state.braking),
      moveX,
      moveY,
      speed: state.speed,
      nacellesLit: (getEngineLights() || []).some(
        light => light.visible && light.intensity > 2
      ),
      dt: safeDt
    });

    // O nariz do casco está no eixo local -Z. Velocidade convencional em m/s;
    // dobra usa c e só pode atuar fora do envelope planetário.
    const nextShipWorldPosition = new THREE.Vector3(currentWorldPosition.x, currentWorldPosition.y, currentWorldPosition.z);
    if (warpTravelActive) {
      const warpMetersPerSecond = SPEED_OF_LIGHT_MPS * Math.max(0, Number(state.warpSpeedC) || 0);
      nextShipWorldPosition.addScaledVector(forwardVector, warpMetersPerSecond * safeDt);
      // Não zerar a velocidade gravitacional: a gravidade terrestre permanece
      // integrada e compõe o deslocamento mesmo durante o trânsito de dobra.
      if (Array.isArray(state.gravityVelocity) && state.gravityVelocity.length === 3) {
        nextShipWorldPosition.addScaledVector(new THREE.Vector3(...state.gravityVelocity), safeDt);
      }
    } else {
      nextShipWorldPosition.addScaledVector(forwardVector, state.speed * safeDt);
      if (Array.isArray(state.gravityVelocity)) {
        nextShipWorldPosition.addScaledVector(
          new THREE.Vector3(...state.gravityVelocity), safeDt
        );
      }
    }
    if (ship.parent) {
      ship.position.copy(ship.parent.worldToLocal(nextShipWorldPosition));
    } else {
      ship.position.copy(nextShipWorldPosition);
    }

    // Plataforma e observatório permanecem sólidos para a nave.
    const stationCenter = new THREE.Vector3(...STATION_WORLD_POSITION);
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

    // O trem de pouso não representa toda a extensão do casco. Ao aproximar
    // a nave inclinada, a popa ou a proa pode atravessar o relevo mesmo com as
    // sapatas ainda acima dele. Estes pontos acompanham a parte inferior real
    // do casco e impedem que a superfície o oculte parcialmente.
    const hullClearanceSamples = typeof shipVisual.localToWorld === 'function' &&
      typeof new THREE.Vector3().clone === 'function' ? [
      new THREE.Vector3(0, -15.2, 0),
      new THREE.Vector3(0, -3.0, -48),
      new THREE.Vector3(0, -10.85, 35),
      new THREE.Vector3(0, -12.7, 39),
      new THREE.Vector3(-18, -11.4, 0),
      new THREE.Vector3(18, -11.4, 0)
    ] : [];
    for (const localPoint of hullClearanceSamples) {
      const pointWorld = shipVisual.localToWorld(localPoint.clone());
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
      state.gravityVelocity = [0, 0, 0];
      ship.userData.earthCollisionResolved = true;
      ship.userData.earthCollisionClearanceUnits = landingContactTargetClearance;
      ship.userData.earthLandingContactToleranceUnits = landingContactTolerance;
      ship.userData.earthLandingContactPoint = closestContact.clearance;
    }

    // Plumas inferiores respondem aos manobradores e ao assistente de descida.
    const maneuveringActive = Boolean(lateralInput || verticalInput || state.auxiliaryThrustersActive ||
      (earthCenter && altitudeMeters <= 25000 && state.maneuveringAssist !== false));
    (getManeuveringFlames() || []).forEach(flame => {
      flame.visible = maneuveringActive;
      if (flame.material) flame.material.opacity = maneuveringActive ? (verticalInput < 0 ? 0.72 : 0.42) : 0;
      const pulse = 0.85 + Math.min(1, Math.abs(lateralInput) + Math.abs(verticalInput)) * 0.5;
      flame.scale.set(pulse, pulse, pulse);
    });
    (getManeuveringLights() || []).forEach(light => {
      light.intensity = maneuveringActive ? 1.5 + Math.abs(lateralInput) + Math.abs(verticalInput) : 0;
    });

    const maneuveringStatus = getElement('maneuvering-status');
    if (maneuveringStatus) {
      maneuveringStatus.textContent = earthCenter && altitudeMeters <= 25000 && state.maneuveringAssist !== false
        ? 'ESTABILIZANDO'
        : state.auxiliaryThrustersActive ? 'AUX. PRECISÃO' : (lateralInput || verticalInput) ? 'MANUAL' : 'STANDBY';
    }

    // Efeitos das nacelles.
    const warpStage = Number(state.warpCurrentStage) || 0;
    const enginePower = warpTravelActive ? 1.25 + warpStage * 0.35 : (state.throttle ? 1.25 : 0.65);
    (getEngineFlames() || []).forEach(flame => {
      flame.scale.set(
        warpTravelActive ? 1 + warpStage * 0.09 : 1,
        warpTravelActive ? 1.5 + warpStage * 0.2 : enginePower,
        warpTravelActive ? 1 + warpStage * 0.09 : 1
      );
      flame.material.opacity = warpTravelActive ? 0.68 + warpStage * 0.055 : (state.throttle ? 0.7 : 0.3);
    });
    (getEngineLights() || []).forEach(light => {
      light.intensity = warpTravelActive ? 3.5 + warpStage * 1.15 : (state.throttle ? 4 : 1.5);
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
    if (warpSpeedReadout) warpSpeedReadout.textContent = (Math.max(0, Number(state.warpSpeedC) || 0)).toFixed(1) + ' c';
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
      warpButton.disabled = Boolean(state.warpSafetyLock && !warpDriveActive);
      warpButton.title = state.warpSafetyLock ? 'Dobra bloqueada no envelope planetário' : 'Ativar propulsão de dobra';
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
