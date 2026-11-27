import test from 'node:test';
import assert from 'node:assert/strict';
import { createEarthTimeCore } from './earthTimeCore.js';

test('Earth time starts from a single UTC epoch and formats Jaú local time', () => {
  const clock = createEarthTimeCore({ epochUnixMs: Date.UTC(2026, 0, 1, 12), timeZone: 'America/Sao_Paulo' });
  const snapshot = clock.getSnapshot();
  assert.equal(snapshot.iso, '2026-01-01T12:00:00.000Z');
  assert.match(snapshot.local, /09:00:00/);
  assert.match(snapshot.utc, /12:00:00/);
});

test('simulation time advances from the same epoch and respects pause and rate', () => {
  const clock = createEarthTimeCore({ epochUnixMs: 1_000_000 });
  clock.advance(2);
  assert.equal(clock.getSnapshot().unixMs, 1_002_000);
  clock.setTimeScale(10);
  clock.advance(3);
  assert.equal(clock.getSnapshot().unixMs, 1_032_000);
  clock.setPaused(true);
  clock.advance(5);
  assert.equal(clock.getSnapshot().unixMs, 1_032_000);
});

test('simulation snapshot can synchronize to the astronomical runtime', () => {
  const clock = createEarthTimeCore({ epochUnixMs: 5_000_000 });
  clock.syncSimulationSeconds(42.5);
  assert.equal(clock.getSnapshot().simulationSeconds, 42.5);
  assert.equal(clock.getSnapshot().unixMs, 5_042_500);
});

test('rejects invalid time inputs', () => {
  assert.throws(() => createEarthTimeCore({ epochUnixMs: NaN }), TypeError);
  const clock = createEarthTimeCore({ epochUnixMs: 0 });
  assert.throws(() => clock.setTimeScale(-1), RangeError);
  assert.throws(() => clock.advance(-1), RangeError);
});
