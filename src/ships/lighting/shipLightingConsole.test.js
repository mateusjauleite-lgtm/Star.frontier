import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SHIP_LIGHTING_CONSOLE_LOCAL_POSITION,
  SHIP_LIGHTING_CONSOLE_INTERACTION_RADIUS,
  isShipLightingConsoleInRange
} from './shipLightingConsole.js';

test('lighting console is available inside its Deck 1 interaction radius', () => {
  assert.equal(isShipLightingConsoleInRange(SHIP_LIGHTING_CONSOLE_LOCAL_POSITION, 0), true);
  assert.equal(isShipLightingConsoleInRange({
    ...SHIP_LIGHTING_CONSOLE_LOCAL_POSITION,
    x: SHIP_LIGHTING_CONSOLE_LOCAL_POSITION.x - SHIP_LIGHTING_CONSOLE_INTERACTION_RADIUS
  }, 0), true);
});

test('lighting console is unavailable outside the radius or on another deck', () => {
  assert.equal(isShipLightingConsoleInRange({
    ...SHIP_LIGHTING_CONSOLE_LOCAL_POSITION,
    x: SHIP_LIGHTING_CONSOLE_LOCAL_POSITION.x - SHIP_LIGHTING_CONSOLE_INTERACTION_RADIUS - 0.01
  }, 0), false);
  assert.equal(isShipLightingConsoleInRange(SHIP_LIGHTING_CONSOLE_LOCAL_POSITION, 1), false);
});

test('lighting console requires an on-foot character inside the ship', () => {
  assert.equal(isShipLightingConsoleInRange(SHIP_LIGHTING_CONSOLE_LOCAL_POSITION, 0, 'ship-control'), false);
  assert.equal(isShipLightingConsoleInRange(SHIP_LIGHTING_CONSOLE_LOCAL_POSITION, 0, 'on-foot', true), false);
});

test('lighting console rejects invalid positions and radii', () => {
  assert.equal(isShipLightingConsoleInRange(null, 0), false);
  assert.equal(isShipLightingConsoleInRange({ x: NaN, y: 0, z: 0 }, 0), false);
  assert.equal(isShipLightingConsoleInRange(SHIP_LIGHTING_CONSOLE_LOCAL_POSITION, 0, 'on-foot', false, -1), false);
});
