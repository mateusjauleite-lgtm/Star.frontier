/**
 * Earth Time Core
 *
 * One simulation clock for Earth-facing systems. UTC is the canonical
 * reference; regional clocks are formatted views of the same instant.
 */
const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';

export function createEarthTimeCore({
  epochUnixMs = Date.now(),
  timeZone = DEFAULT_TIME_ZONE,
  simulationSeconds = 0
} = {}) {
  if (!Number.isFinite(epochUnixMs)) throw new TypeError('Earth time epoch must be a finite Unix timestamp.');
  if (typeof timeZone !== 'string' || !timeZone.trim()) throw new TypeError('A valid IANA time zone is required.');
  if (!Number.isFinite(simulationSeconds) || simulationSeconds < 0) {
    throw new RangeError('Simulation time must be zero or positive.');
  }

  let epoch = epochUnixMs;
  let elapsed = simulationSeconds;
  let paused = false;
  let rate = 1;

  const utcFormatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  });
  const localFormatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  });

  function getSnapshot() {
    const unixMs = epoch + elapsed * 1000;
    const instant = new Date(unixMs);
    return Object.freeze({
      unixMs,
      iso: instant.toISOString(),
      simulationSeconds: elapsed,
      timeScale: rate,
      paused,
      utc: utcFormatter.format(instant),
      local: localFormatter.format(instant),
      timeZone
    });
  }

  return Object.freeze({
    getSnapshot,
    advance(realDeltaSeconds) {
      if (!Number.isFinite(realDeltaSeconds) || realDeltaSeconds < 0) {
        throw new RangeError('Real frame delta must be zero or positive.');
      }
      if (!paused) elapsed += realDeltaSeconds * rate;
      return getSnapshot();
    },
    syncSimulationSeconds(value) {
      if (!Number.isFinite(value) || value < 0) {
        throw new RangeError('Simulation time must be zero or positive.');
      }
      elapsed = value;
      return getSnapshot();
    },
    setPaused(value) {
      paused = Boolean(value);
      return paused;
    },
    setTimeScale(value) {
      if (!Number.isFinite(value) || value < 0) {
        throw new RangeError('Time scale must be zero or positive.');
      }
      rate = value;
      return rate;
    }
  });
}
