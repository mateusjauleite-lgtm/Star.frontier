import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameplayFramePhases } from './gameplayFramePhases.js';

function fixture() {
  const calls = [];
  const elements = new Map(['speed', 'fuel', 'cargo', 'hull', 'shield', 'hud-credits']
    .map(id => {
      const element = { _textContent: '' };
      Object.defineProperty(element, 'textContent', {
        get() { return this._textContent; },
        set(value) { this._textContent = String(value); }
      });
      return [id, element];
    }));
  let landingBase = null;
  const dependencies = {
    earthSystem: {
      update: dt => calls.push(['earth', dt]),
      getLandingBase: () => ({ id: 'landing-base' })
    },
    camera: { position: {} },
    applyEarthSurfaceRotation: dt => calls.push(['earth-rotation', dt]),
    ship: null,
    updatePhaserWeapon: dt => calls.push(['phaser', dt]),
    characterCore: { snapshot: () => ({ mode: 'on-foot' }) },
    updateCharacterMovement: dt => calls.push(['character-movement', dt]),
    updateCharacterWeapon: dt => calls.push(['character-weapon', dt]),
    updateExternalElevatorAnimation: dt => calls.push(['elevator-animation', dt]),
    updateElevatorInteraction: () => calls.push(['elevator-interaction']),
    updatePilotInteraction: () => calls.push(['pilot-interaction']),
    updateShipManagementInteraction: dt => calls.push(['ship-management-interaction', dt]),
    updateExternalElevatorInteraction: () => calls.push(['external-elevator-interaction']),
    updateCharacterCamera: () => calls.push(['character-camera']),
    updateFlight: dt => calls.push(['flight', dt]),
    updateCamera: () => calls.push(['ship-camera']),
    setLandingBaseSystem: value => { landingBase = value; },
    updateShipLandingGuidance: dt => calls.push(['landing-guidance', dt]),
    THREE: {},
    shipVisual: null,
    shipEarthContactPoints: [],
    shipLandingGearContactPoints: [],
    forwardVector: {},
    state: { speed: 12, fuel: 80, cargo: 3, hull: 100, shield: 90, credits: 1250 },
    orbitSystem: { update: dt => calls.push(['orbits', dt]) },
    asteroidSystem: { update: dt => calls.push(['asteroids', dt]) },
    lightingSystem: { update: (dt, position) => calls.push(['lighting', dt, position]) },
    renderer: { render: (scene, camera) => calls.push(['render', scene, camera]) },
    scene: { id: 'scene' },
    $: id => elements.get(id) || null
  };
  const phases = createGameplayFramePhases(() => dependencies);
  return { phases, calls, elements, dependencies, getLandingBase: () => landingBase };
}

test('extracted gameplay phases preserve the existing frame order and delta time', () => {
  const f = fixture();
  assert.equal(f.phases.updateEnvironment(0.016), undefined);
  f.phases.updateCharacterMode(0.016);
  f.phases.updateLanding(0.016);
  f.phases.updateWorld(0.016);
  f.phases.render();
  f.phases.updateHud();

  assert.deepEqual(f.calls.map(([name]) => name), [
    'earth', 'earth-rotation', 'phaser',
    'character-movement', 'character-weapon', 'elevator-animation',
    'elevator-interaction', 'pilot-interaction', 'external-elevator-interaction',
    'character-camera', 'ship-management-interaction', 'landing-guidance', 'orbits', 'asteroids',
    'lighting', 'render'
  ]);
  assert.ok(f.calls.filter(call => call.length > 1 && typeof call[1] === 'number')
    .every(call => call[1] === 0.016));
  assert.equal(f.getLandingBase().id, 'landing-base');
  assert.equal(f.elements.get('speed').textContent, '12');
  assert.equal(f.elements.get('fuel').textContent, '80');
  assert.equal(f.elements.get('cargo').textContent, '3 / 100');
  assert.equal(f.elements.get('hud-credits').textContent, '1.250');
});

test('character phase switches to ship flight and camera outside on-foot mode', () => {
  const f = fixture();
  f.dependencies.characterCore.snapshot = () => ({ mode: 'ship-control' });
  f.phases.updateCharacterMode(0.02);
  assert.deepEqual(f.calls.map(([name]) => name), ['flight', 'ship-camera', 'ship-management-interaction']);
});

test('phase factory rejects a missing dependency getter', () => {
  assert.throws(() => createGameplayFramePhases(), /função/);
});

test('phase callbacks resolve current dependencies on every phase invocation', () => {
  const f = fixture();
  let reads = 0;
  const phases = createGameplayFramePhases(() => {
    reads++;
    return f.dependencies;
  });
  phases.updateEnvironment(0.01);
  phases.updateCharacterMode(0.01);
  phases.updateLanding(0.01);
  phases.updateWorld(0.01);
  phases.render();
  phases.updateHud();
  assert.equal(reads, 6);
});
