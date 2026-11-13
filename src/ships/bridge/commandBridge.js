import * as THREE from 'three';

// Integração entre personagem e nave. A posição é local ao modelo da nave.
export const PILOT_CONSOLE_LOCAL_POSITION = Object.freeze({
  x: 0,
  y: 8.93,
  z: -29.5
});

const DECK_EXIT_LOCAL_POSITION = Object.freeze({
  x: 0,
  y: 8.93,
  z: -25.5
});

const consoleWorldPosition = new THREE.Vector3();

export function isPilotConsoleInRange(characterWorldPosition, shipVisual, radius = 3.2) {
  if (!characterWorldPosition || !shipVisual) return false;

  consoleWorldPosition.set(
    PILOT_CONSOLE_LOCAL_POSITION.x,
    PILOT_CONSOLE_LOCAL_POSITION.y,
    PILOT_CONSOLE_LOCAL_POSITION.z
  );
  shipVisual.localToWorld(consoleWorldPosition);

  return characterWorldPosition.distanceToSquared(consoleWorldPosition) <= radius * radius;
}

export function attachCharacterToPilotConsole(characterModel, shipVisual) {
  if (!characterModel?.group || !shipVisual) return false;

  // Mantém a transformação mundial ao transferir o personagem para a nave.
  shipVisual.attach(characterModel.group);
  characterModel.group.position.set(
    PILOT_CONSOLE_LOCAL_POSITION.x,
    PILOT_CONSOLE_LOCAL_POSITION.y,
    PILOT_CONSOLE_LOCAL_POSITION.z
  );
  characterModel.group.rotation.set(0, 0, 0);
  characterModel.group.visible = false;
  return true;
}

export function returnCharacterToDeck(characterModel, shipVisual, scene) {
  if (!characterModel?.group || !shipVisual || !scene) return 0;

  characterModel.group.visible = true;
  characterModel.group.position.set(
    DECK_EXIT_LOCAL_POSITION.x,
    DECK_EXIT_LOCAL_POSITION.y,
    DECK_EXIT_LOCAL_POSITION.z
  );

  // Recoloca o personagem no mundo preservando a posição e orientação da nave.
  scene.attach(characterModel.group);
  const worldEuler = new THREE.Euler().setFromQuaternion(
    characterModel.group.quaternion,
    'YXZ'
  );
  return worldEuler.y;
}
