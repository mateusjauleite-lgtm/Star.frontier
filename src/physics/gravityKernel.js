const finite3 = value => value && value.length === 3 && Array.from(value).every(Number.isFinite);
const asVector = value => [Number(value[0]), Number(value[1]), Number(value[2])];

function fallbackAcceleration({ position, uniformAcceleration = [0, 0, 0], bodies = [] } = {}) {
  if (!finite3(position) || !finite3(uniformAcceleration) || !Array.isArray(bodies)) return null;
  const result = asVector(uniformAcceleration);
  for (const body of bodies) {
    if (!finite3(body?.position) || !Number.isFinite(body.mu) || body.mu < 0) return null;
    if (body.mu === 0) continue;
    const delta = position.map((value, axis) => value - body.position[axis]);
    const radiusSquared = delta.reduce((sum, value) => sum + value * value, 0);
    if (!Number.isFinite(radiusSquared) || radiusSquared <= 1e-18) return null;
    const factor = -body.mu / (radiusSquared * Math.sqrt(radiusSquared));
    for (let axis = 0; axis < 3; axis++) result[axis] += factor * delta[axis];
  }
  return result.every(Number.isFinite) ? result : null;
}

function fallbackIntegrateVelocity(velocity, acceleration, deltaSeconds, maximumSpeed = 0) {
  if (!finite3(velocity) || !finite3(acceleration) ||
      !Number.isFinite(deltaSeconds) || deltaSeconds < 0 ||
      !Number.isFinite(maximumSpeed) || maximumSpeed < 0) return null;
  const next = velocity.map((value, axis) => value + acceleration[axis] * deltaSeconds);
  const speed = Math.hypot(...next);
  if (!Number.isFinite(speed)) return null;
  if (maximumSpeed > 0 && speed > maximumSpeed) {
    const scale = maximumSpeed / speed;
    return next.map(value => value * scale);
  }
  return next;
}

export function createGravityKernel(module = null) {
  let disposed = false;
  return {
    backend: module ? 'wasm-c++' : 'javascript-fallback',
    acceleration(input = {}) {
      if (disposed) return null;
      if (!module) return fallbackAcceleration(input);
      const { position, uniformAcceleration = [0, 0, 0], bodies = [] } = input;
      if (!finite3(position) || !finite3(uniformAcceleration) || !Array.isArray(bodies)) return null;
      const bodyPositions = [];
      const mus = [];
      for (const body of bodies) {
        if (!finite3(body?.position) || !Number.isFinite(body.mu) || body.mu < 0) return null;
        bodyPositions.push(...body.position);
        mus.push(body.mu);
      }
      const ptrs = [module._malloc(24), module._malloc(24), module._malloc(Math.max(1, bodyPositions.length) * 8),
        module._malloc(Math.max(1, mus.length) * 8), module._malloc(24)];
      if (ptrs.some(pointer => !pointer)) {
        ptrs.forEach(pointer => { if (pointer) module._free(pointer); });
        return null;
      }
      const [positionPtr, uniformPtr, bodiesPtr, musPtr, outputPtr] = ptrs;
      try {
        module.HEAPF64.set(position, positionPtr / 8);
        module.HEAPF64.set(uniformAcceleration, uniformPtr / 8);
        if (bodyPositions.length) module.HEAPF64.set(bodyPositions, bodiesPtr / 8);
        if (mus.length) module.HEAPF64.set(mus, musPtr / 8);
        const ok = module._gravity_acceleration(positionPtr, uniformPtr, bodiesPtr, musPtr, bodies.length, outputPtr);
        return ok ? Array.from(module.HEAPF64.subarray(outputPtr / 8, outputPtr / 8 + 3)) : null;
      } finally {
        ptrs.forEach(pointer => module._free(pointer));
      }
    },
    integrateVelocity(velocity, acceleration, deltaSeconds, maximumSpeed = 0) {
      if (disposed) return null;
      if (!module) return fallbackIntegrateVelocity(velocity, acceleration, deltaSeconds, maximumSpeed);
      if (!finite3(velocity) || !finite3(acceleration) ||
          !Number.isFinite(deltaSeconds) || deltaSeconds < 0 ||
          !Number.isFinite(maximumSpeed) || maximumSpeed < 0) return null;
      const velocityPtr = module._malloc(24), accelerationPtr = module._malloc(24), outputPtr = module._malloc(24);
      if (!velocityPtr || !accelerationPtr || !outputPtr) {
        [velocityPtr, accelerationPtr, outputPtr].forEach(pointer => { if (pointer) module._free(pointer); });
        return null;
      }
      try {
        module.HEAPF64.set(velocity, velocityPtr / 8);
        module.HEAPF64.set(acceleration, accelerationPtr / 8);
        const ok = module._gravity_integrate_velocity(velocityPtr, accelerationPtr, deltaSeconds, maximumSpeed, outputPtr);
        return ok ? Array.from(module.HEAPF64.subarray(outputPtr / 8, outputPtr / 8 + 3)) : null;
      } finally {
        [velocityPtr, accelerationPtr, outputPtr].forEach(pointer => module._free(pointer));
      }
    },
    dispose() { disposed = true; }
  };
}

export async function loadGravityKernel() {
  const base = import.meta.env?.BASE_URL ?? './';
  const moduleUrl = new URL(`${base}physics/gravityKernel.js`, globalThis.location?.href ?? 'http://localhost/');
  try {
    const imported = await import(/* @vite-ignore */ moduleUrl.href);
    if (typeof imported.default !== 'function') throw new Error('Gravity WASM factory is missing');
    const wasm = await imported.default({ locateFile: file => new URL(file, moduleUrl).href });
    return createGravityKernel(wasm);
  } catch {
    return createGravityKernel();
  }
}
