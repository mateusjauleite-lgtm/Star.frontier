import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeck2TransporterInstallation, DECK_2_TRANSPORTER_LAYOUT } from './transportInstallation.js';

test('Deck 2 contains exactly one transporter platform and one control console', () => {
  const installation = createDeck2TransporterInstallation();
  const { group, platform, console: controlConsole, collisionBoxes } = installation;
  assert.equal(group.name, 'Deck2-Transporter-Installation');
  assert.equal(group.userData.deckId, 'D2');
  assert.equal(group.userData.transporterCount, 1);
  assert.equal(group.userData.consoleCount, 1);
  assert.equal(platform.name, 'Deck2-Transporter-Platform');
  assert.equal(controlConsole.name, 'Deck2-Transporter-Control-Console');
  assert.equal(platform.getObjectByName('Transporter-Platform-Center-Emitter').isMesh, true);
  assert.equal(platform.getObjectByName('Transporter-Emitter-Array').children.filter(child =>
    child.name.startsWith('Transporter-Emitter-Column-')
  ).length, 6);
  assert.equal(collisionBoxes.length, 2);
  assert.equal(group.userData.interaction.terminalId, 'planetary-transport-console');
  assert.deepEqual(platform.position.toArray(), [
    DECK_2_TRANSPORTER_LAYOUT.platform.x,
    DECK_2_TRANSPORTER_LAYOUT.platform.y,
    DECK_2_TRANSPORTER_LAYOUT.platform.z
  ]);
  installation.dispose();
});

test('destination console and transporter platform have independent action ranges', () => {
  const separation = Math.hypot(
    DECK_2_TRANSPORTER_LAYOUT.console.x - DECK_2_TRANSPORTER_LAYOUT.platform.x,
    DECK_2_TRANSPORTER_LAYOUT.console.z - DECK_2_TRANSPORTER_LAYOUT.platform.z
  );
  assert.ok(separation > 3.6 + 2.9, 'console and platform action ranges must not overlap');
  assert.ok(separation > 8, 'the destination console must be physically separated from the platform');
});
