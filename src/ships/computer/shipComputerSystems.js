// Adaptadores entre o computador central e os sistemas reais da nave.
// Este módulo consulta os sistemas existentes; não duplica física ou estado.

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

  const readNavigation = () => {
    const ship = getShip();
    if (!ship) return { available: false };
    const position = ship.position;
    return {
      available: true,
      position: { x: position.x, y: position.y, z: position.z },
      heading: getShipYaw(),
      pitch: getPitchAngle(),
      speed: state.speed,
      cameraMode: state.camera
    };
  };

  computer.registerSystem('navigation', {
    name: 'Navegação',
    commands: {
      telemetry: () => readNavigation()
    },
    getStatus: () => getShip() ? 'online' : 'standby'
  });

  computer.registerSystem('sensors', {
    name: 'Sensores',
    commands: {
      scan: () => {
        const ship = getShip();
        if (!ship) return { available: false, contacts: [] };
        const contacts = getAsteroids()
          .filter(asteroid => asteroid && asteroid.position)
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
    getStatus: () => getShip() ? 'online' : 'standby'
  });

  computer.registerSystem('power', {
    name: 'Energia e recursos',
    commands: {
      status: () => ({
        fuel: state.fuel,
        nitro: state.nitro,
        shields: state.shield,
        hull: state.hull,
        propulsion: state.nitroButton && state.nitro > 0
          ? 'boost'
          : state.throttle ? 'thrust' : 'idle'
      })
    },
    getStatus: () => 'monitoring'
  });

  return true;
}
