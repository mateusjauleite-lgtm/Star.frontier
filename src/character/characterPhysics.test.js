import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterPhysics } from './characterPhysics.js';

test('character uses the shared gravity kernel after leaving the floor', () => {
  const calls = [];
  const kernel = {
    acceleration(input) {
      calls.push(input);
      return input.uniformAcceleration;
    },
    integrateVelocity(velocity, acceleration, dt, maximumSpeed) {
      const y = Math.max(-maximumSpeed, velocity[1] + acceleration[1] * dt);
      return [0, y, 0];
    }
  };
  const physics = createCharacterPhysics({ gravityKernel: kernel, gravity: 18 });
  const position = { y: 1 };
  assert.equal(physics.leaveGround(), true);
  const state = physics.update(0.05, { position, floorY: -100 });
  assert.equal(state.grounded, false);
  assert.ok(state.velocityY < 0);
  assert.ok(position.y < 1);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].uniformAcceleration, [0, -18, 0]);
});

test('character forwards an environment gravity field to the shared kernel', () => {
  let received = null;
  const kernel = {
    acceleration(input) { received = input; return input.uniformAcceleration; },
    integrateVelocity(velocity, acceleration) { return [0, velocity[1] + acceleration[1] * 0.05, 0]; }
  };
  const physics = createCharacterPhysics({ gravityKernel: kernel });
  physics.leaveGround();
  physics.update(0.05, {
    position: { y: 10 },
    floorY: -100,
    gravityField: {
      position: [100, 20, 0],
      uniformAcceleration: [0, -9.8, 0],
      bodies: [{ position: [0, 0, 0], mu: 398600 }]
    }
  });
  assert.deepEqual(received.position, [100, 20, 0]);
  assert.equal(received.bodies.length, 1);
});


test('personagem recebe compensação longitudinal no eixo local da nave enquanto está no ar', () => {
  const physics = createCharacterPhysics({ gravity: 18 });
  const position = { x: 0, y: 10, z: 0 };
  physics.leaveGround();
  physics.update(0.05, {
    position,
    floorY: -100,
    gravityField: { position: [0, 10, 0], uniformAcceleration: [0, -18, 8], bodies: [] }
  });
  assert.ok(position.z > 0);
  assert.ok(physics.velocity[2] > 0);
});

test('personagem apoiado no convés não deriva com a compensação de dobra', () => {
  const physics = createCharacterPhysics();
  const position = { x: 2, y: 0.21, z: -3 };
  const result = physics.update(0.05, {
    position,
    floorY: 0.21,
    gravityField: { uniformAcceleration: [0, -18, 12] }
  });
  assert.equal(result.grounded, true);
  assert.deepEqual(position, { x: 2, y: 0.21, z: -3 });
});
