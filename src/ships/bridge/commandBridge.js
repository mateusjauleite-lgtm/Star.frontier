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

export function isPilotConsoleInRange(characterWorldPosition, shipVisual, radius = 5.0) {
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
  characterModel.group.visible = false;
  return true;
}

export function returnCharacterToDeck(characterModel, shipVisual) {
  if (!characterModel?.group || !shipVisual) return 0;

  // O personagem continua no referencial da nave após deixar o comando.
  // Assim o convés não se desloca para longe dele quando a nave manobra.
  characterModel.group.position.set(
    DECK_EXIT_LOCAL_POSITION.x,
    DECK_EXIT_LOCAL_POSITION.y,
    DECK_EXIT_LOCAL_POSITION.z
  );
  characterModel.group.visible = true;
  return characterModel.group.rotation.y;
}
