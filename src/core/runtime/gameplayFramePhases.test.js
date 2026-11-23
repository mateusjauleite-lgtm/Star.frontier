import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameplayFramePhases } from './gameplayFramePhases.js';

function fixture() {
  const calls = [];
  const elements = new Map(['speed', 'fuel', 'cargo', 'hull', 'shield', 'hud-credits', 'hud', 'flight-controls', 'navigation-coordinates', 'navigation-distance', 'navigation-bearing', 'navigation-full-coordinates', 'navigation-full-distance', 'navigation-full-bearing', 'combat-target-name', 'combat-hull', 'combat-shield', 'warp-core-consumption', 'warp-stability-readout']
    .map(id => {
      const element = { _textContent: '' };
      Object.defineProperty(element, 'textContent', {
        get() { return this._textContent; },
        set(value) { this._textContent = String(value); }
      });
      element.attributes = {};
      element.setAttribute = (name, value) => { element.attributes[name] = String(value); };
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
    updateRefineryConsoleInteraction: dt => calls.push(['refinery-console-interaction', dt]),
    updateExternalElevatorInteraction: () => calls.push(['external-elevator-interaction']),
    updateAlexiaInteraction: dt => calls.push(['alexia-interaction', dt]),
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
    state: { speed: 12, fuel: 80, cargo: 3, hull: 100, shield: 90, credits: 1250, coreDilithiumConsumedTotal: 4.5 },
    getActivePilotHudProfile: () => 'navigation',
    updateNavigationSensorMap: () => calls.push(['navigation-sensor-map']),
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
    'flight', 'character-camera', 'ship-management-interaction', 'refinery-console-interaction', 'alexia-interaction', 'landing-guidance', 'orbits', 'asteroids',
    'lighting', 'render', 'navigation-sensor-map'
  ]);
  assert.ok(f.calls.filter(call => call.length > 1 && typeof call[1] === 'number')
    .every(call => call[1] === 0.016));
  assert.equal(f.getLandingBase().id, 'landing-base');
  assert.equal(f.elements.get('speed').textContent, '12');
  assert.equal(f.elements.get('fuel').textContent, '80');
  assert.equal(f.elements.get('cargo').textContent, '3 / 100');
  assert.equal(f.elements.get('hud-credits').textContent, '1.250');
});

test('camera runtime updates after movement and before world rendering phases', () => {
  const f = fixture();
  f.dependencies.cameraRuntime = {
    updateActive: () => f.calls.push(['camera-runtime'])
  };
  f.dependencies.state.speed = 0;
  f.dependencies.state.warpDriveButton = true;

  f.phases.updateCharacterMode(0.02);

  const names = f.calls.map(([name]) => name);
  assert.ok(names.indexOf('flight') < names.indexOf('camera-runtime'));
  assert.ok(names.indexOf('camera-runtime') < names.indexOf('ship-management-interaction'));
  assert.equal(names.includes('character-camera'), false);
  assert.equal(names.includes('ship-camera'), false);
});

test('ship flight continues while the character is on foot if warp is active', () => {
  const f = fixture();
  f.dependencies.state.speed = 0;
  f.dependencies.state.warpDriveButton = true;
  f.phases.updateCharacterMode(0.02);
  assert.ok(f.calls.some(([name]) => name === 'flight'));
  assert.ok(f.calls.some(([name]) => name === 'character-camera'));
});

test('character phase switches to ship flight and camera outside on-foot mode', () => {
  const f = fixture();
  f.dependencies.characterCore.snapshot = () => ({ mode: 'ship-control' });
  f.phases.updateCharacterMode(0.02);
  assert.deepEqual(f.calls.map(([name]) => name), ['flight', 'ship-camera', 'ship-management-interaction', 'refinery-console-interaction', 'alexia-interaction']);
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


test('Runtime HUD phase routes profile state and available navigation/combat/warp telemetry', () => {
  const f = fixture();
  f.dependencies.ship = {
    position: { x: 12.5, y: -3, z: 40 },
    userData: {
      navigationTarget: { name: 'Waypoint A', distance: 125.4, bearing: 270 },
      combatTarget: { name: 'Hostile vessel' },
      warpStability: 0.92
    }
  };
  f.phases.updateHud();

  assert.equal(f.elements.get('hud').attributes['data-active-hud-profile'], 'navigation');
  assert.equal(f.elements.get('flight-controls').attributes['data-active-hud-profile'], 'navigation');
  assert.equal(f.elements.get('navigation-coordinates').textContent, '12.5 / -3.0 / 40.0');
  assert.equal(f.elements.get('navigation-distance').textContent, '125.4 u');
  assert.equal(f.elements.get('navigation-bearing').textContent, '270.0°');
  assert.equal(f.elements.get('navigation-full-coordinates').textContent, '12.5 / -3.0 / 40.0');
  assert.equal(f.elements.get('navigation-full-distance').textContent, '125.4 u');
  assert.equal(f.elements.get('navigation-full-bearing').textContent, '270.0°');
  assert.equal(f.elements.get('combat-target-name').textContent, 'Hostile vessel');
  assert.equal(f.elements.get('combat-hull').textContent, '100%');
  assert.equal(f.elements.get('combat-shield').textContent, '90%');
  assert.equal(f.elements.get('warp-core-consumption').textContent, '4.50 u');
  assert.equal(f.elements.get('warp-stability-readout').textContent, '92%');
});

test('combat target telemetry does not reuse a navigation waypoint', () => {
  const f = fixture();
  f.dependencies.ship = {
    position: { x: 0, y: 0, z: 0 },
    userData: { navigationTarget: { name: 'Waypoint A', distance: 10, bearing: 90 } }
  };
  f.phases.updateHud();
  assert.equal(f.elements.get('combat-target-name').textContent, 'SEM ALVO');
});


test('refinery console interaction is updated every gameplay frame with the real delta', () => {
  const f = fixture();
  f.phases.updateCharacterMode(0.032);
  assert.ok(f.calls.some(([name, dt]) => name === 'refinery-console-interaction' && dt === 0.032));
});

test('Alexia proximity interaction is updated once per gameplay frame with the real delta', () => {
  const f = fixture();
  f.phases.updateCharacterMode(0.032);
  assert.equal(f.calls.filter(([name]) => name === 'alexia-interaction').length, 1);
  assert.ok(f.calls.some(([name, dt]) => name === 'alexia-interaction' && dt === 0.032));
});

test('Alexia interaction availability is re-evaluated outside on-foot mode', () => {
  const f = fixture();
  f.dependencies.characterCore.snapshot = () => ({ mode: 'ship-control' });
  f.phases.updateCharacterMode(0.02);
  assert.equal(f.calls.filter(([name]) => name === 'alexia-interaction').length, 1);
  assert.ok(f.calls.some(([name, dt]) => name === 'alexia-interaction' && dt === 0.02));
});

test('manual flight HUD shows altitude, atmospheric layer, ozone band and vertical speed', () => {
  const f = fixture();
  f.dependencies.ship = { position: { x: 0, y: 0, z: 0 }, userData: {} };
  f.phases.updateHud();
  assert.equal(f.elements.get('altitude-msl').textContent, '12,40 km');
  assert.equal(f.elements.get('atmosphere-layer').textContent, 'ESTRATOSFERA');
  assert.equal(f.elements.get('ozone-status').textContent, 'FORA DA FAIXA');
  assert.equal(f.elements.get('vertical-speed').textContent, '120,0 m/s · DESCENDO ↓');
  assert.ok(Number.parseFloat(f.elements.get('altitude-marker').style.left) > 0);
  f.dependencies.state.altitudeMeters = 20000;
  f.phases.updateHud();
  assert.equal(f.elements.get('ozone-status').textContent, 'NA FAIXA DE OZÔNIO');
});

test('manual flight HUD reports terrain clearance only when collision telemetry exists', () => {
  const f = fixture();
  f.dependencies.ship = { position: { x: 0, y: 0, z: 0 }, userData: { earthLandingContacts: { minimumClearanceUnits: 42.5 } } };
  f.phases.updateHud();
  assert.equal(f.elements.get('terrain-clearance').textContent, '42,5 m');
});

test('manual flight HUD does not turn a null terrain sample into zero clearance', () => {
  const f = fixture();
  f.dependencies.ship = { position: { x: 0, y: 0, z: 0 }, userData: { earthLandingContacts: { minimumClearanceUnits: null } } };
  f.phases.updateHud();
  assert.equal(f.elements.get('terrain-clearance').textContent, '—');
});
