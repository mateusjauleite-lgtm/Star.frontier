// Adaptadores entre o computador central e os sistemas reais da nave.
// Consultam o estado e os objetos já usados pelo jogo; não duplicam física nem recursos.

export function registerShipComputerSystems(computer, {
  state,
  getShip,
  getShipYaw,
  getPitchAngle,
  getAsteroids
}) {
  if (!computer || !state || typeof getShip !== 'function' ||
      typeof getShipYaw !== 'function' || typeof getPitchAngle !== 'function' ||
      typeof getAsteroids !== 'function') {
    throw new TypeError('Dependências dos sistemas do computador incompletas.');
  }

  const readShip = () => {
    const ship = getShip();
    return ship?.position ? ship : null;
  };

  const readNavigation = () => {
    const ship = readShip();
    if (!ship) return { available: false };

    const { x, y, z } = ship.position;
    return {
      available: true,
      position: { x, y, z },
      heading: getShipYaw(),
      pitch: getPitchAngle(),
      speed: state.speed,
      cameraMode: state.camera
    };
  };

  computer.registerSystem('navigation', {
    name: 'Navegação',
    commands: {
      telemetry: readNavigation
    },
    getStatus: () => readShip() ? 'online' : 'standby'
  });

  computer.registerSystem('sensors', {
    name: 'Sensores',
    commands: {
      scan: () => {
        const ship = readShip();
        if (!ship || typeof ship.position.distanceTo !== 'function') {
          return { available: false, totalContacts: 0, nearestContact: null, contacts: [] };
        }

        const asteroids = getAsteroids();
        const contacts = (Array.isArray(asteroids) ? asteroids : [])
          .filter(asteroid => asteroid?.position)
          .map((asteroid, index) => ({
            id: asteroid.name || `asteroid-${index + 1}`,
            distance: ship.position.distanceTo(asteroid.position),
            ore: asteroid.userData?.ore ?? null
          }))
          .sort((a, b) => a.distance - b.distance);

        return {
          available: true,
          totalContacts: contacts.length,
          nearestContact: contacts[0] || null,
          contacts
        };
      }
    },
    getStatus: () => readShip() ? 'online' : 'standby'
  });

  computer.registerSystem('power', {
    name: 'Energia e recursos',
    commands: {
      status: () => {
        if (!readShip()) return { available: false };

        const fuelAvailable = state.fuel > 0;
        const boosting = state.nitroButton && state.nitro > 0 && fuelAvailable;
        const thrusting = state.throttle && fuelAvailable;

        return {
          available: true,
          fuel: state.fuel,
          nitro: state.nitro,
          shields: state.shield,
          hull: state.hull,
          braking: Boolean(state.braking),
          propulsion: boosting ? 'boost' : thrusting ? 'thrust' : 'idle'
        };
      }
    },
    getStatus: () => readShip() ? 'monitoring' : 'standby'
  });

  return true;
}
