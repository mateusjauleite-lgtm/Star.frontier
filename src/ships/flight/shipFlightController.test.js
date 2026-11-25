import test from 'node:test';
import assert from 'node:assert/strict';
import { createShipFlightController } from './shipFlightController.js';

function vector(x = 0, y = 0, z = 0) {
  return {
    x, y, z,
    toArray() { return [this.x, this.y, this.z]; },
    set(nx, ny, nz) { this.x = nx; this.y = ny; this.z = nz; return this; },
    copy(other) { this.x = other.x; this.y = other.y; this.z = other.z; return this; },
    addScaledVector(other, scale) { this.x += other.x * scale; this.y += other.y * scale; this.z += other.z * scale; return this; },
    applyQuaternion() { return this; },
    normalize() { return this; },
    dot() { return 0; }
  };
}

function fixture(overrides = {}) {
  const calls = [];
  const ship = {
    userData: {},
    position: vector(),
    getWorldPosition: () => vector(),
    updateWorldMatrix() {},
    parent: null
  };
  const yaw = { rotation: { y: 0 } };
  const pitch = { rotation: { x: 0 } };
  const visual = {
    rotation: { z: 0 },
    updateWorldMatrix() {},
    getWorldQuaternion() {}
  };
  const state = {
    settings: { sensitivity: 1 },
    move: { x: 0.5, y: -0.5 },
    throttle: false, braking: false, nitroButton: false,
    fuel: 10, speed: 0, nitro: 100, maneuveringAssist: true
  };
  const controller = createShipFlightController({
    THREE: {
      MathUtils: {
        clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
        degToRad: degrees => degrees * Math.PI / 180,
        lerp: (a, b, t) => a + (b - a) * t
      },
      Vector3: function(x = 0, y = 0, z = 0) {
        return Object.assign(vector(x, y, z), {
          addScaledVector() { return this; }
        });
      }
    },
    state,
    getShip: () => ship,
    getShipYaw: () => yaw,
    getShipPitch: () => pitch,
    getShipVisual: () => visual,
    getEngineFlames: () => [],
    getEngineLights: () => [],
    getEarthSystem: () => null,
    getLandingGearContactPoints: () => [],
    getLandingAutopilot: () => null,
    getFlightQuaternion: () => ({}),
    getForwardVector: () => vector(),
    advanceFlightDynamics: (currentState, dt) => {
      calls.push(['dynamics', dt]);
      currentState.speed += dt * 10;
      return false;
    },
    shipAudio: { updateFlight: data => calls.push(['audio', data]) },
    cancelLandingGuidance() {},
    getElement: () => null,
    toast() {},
    ...overrides
  });
  return { controller, calls, ship, yaw, pitch, visual, state };
}

test('flight controller preserves clamped frame time and updates manual steering', () => {
  const f = fixture();
  assert.equal(f.controller.update(0.2), true);
  assert.ok(Math.abs(f.yaw.rotation.y - (-0.5 * 1.25 * 0.04)) < 1e-12);
  assert.ok(Math.abs(f.pitch.rotation.x - (0.5 * 0.04)) < 1e-12);
  assert.ok(f.calls.some(([name, dt]) => name === 'dynamics' && dt === 0.04));
  assert.ok(f.calls.some(([name]) => name === 'audio'));
});

test('flight controller does nothing until ship control transforms exist', () => {
  const f = fixture({ getShip: () => null });
  assert.equal(f.controller.update(0.016), false);
  assert.equal(f.calls.length, 0);
});

test('manual input releases Earth surface anchoring', () => {
  const f = fixture();
  f.ship.userData.earthSurfaceAnchored = true;
  f.controller.update(0.016);
  assert.equal(f.ship.userData.earthSurfaceAnchored, false);
});

test('flight controller exposes a resettable pitch state', () => {
  const f = fixture();
  f.controller.update(0.016);
  assert.notEqual(f.controller.pitchAngle, 0);
  f.controller.resetPitch();
  assert.equal(f.controller.pitchAngle, 0);
});

test('flight controller resolves terrain contact from landing gear pads instead of ship origin', () => {
  const f = fixture({
    getLandingGearContactPoints: () => [{
      id: 'gear-test',
      point: {
        isVector3: true,
        x: 0, y: -23.18, z: 0,
        clone() {
          return {
            x: this.x, y: this.y, z: this.z,
            clone: this.clone,
            sub(other) { this.x -= other.x; this.y -= other.y; this.z -= other.z; return this; },
            dot(other) { return this.x * other.x + this.y * other.y + this.z * other.z; }
          };
        }
      }
    }],
    getEarthSystem: () => ({
      getCollisionSurface: () => ({
        sampleWorldPosition: () => ({
          worldPosition: { x: 0, y: -22, z: 0 },
          worldNormal: { x: 0, y: 1, z: 0, clone() { return { ...this, normalize() { return this; } }; } }
        })
      })
    })
  });
  f.visual.updateWorldMatrix = () => {};
  f.visual.localToWorld = point => point;
  f.ship.getWorldPosition = () => vector(0, 0, 0);
  f.controller.update(0.016);
  assert.equal(f.ship.userData.earthCollisionResolved, true);
  assert.equal(f.ship.userData.earthCollisionClearanceUnits, 0);
  assert.equal(f.ship.userData.earthLandingContactToleranceUnits, 0.35);
  assert.ok(Math.abs(f.ship.position.y - 1.18) < 1e-9);
});


test('flight steering is gated when fuel and nitro are both unavailable', () => {
  const f = fixture();
  f.state.fuel = 0;
  f.state.nitro = 0;
  f.state.move = { x: 1, y: -1 };
  f.controller.update(0.04);
  assert.equal(f.yaw.rotation.y, 0);
  assert.equal(f.pitch.rotation.x, 0);
});
