export const PILOT_HUD_PROFILES = Object.freeze([
  Object.freeze({ id: 'flight', label: 'Voo' }),
  Object.freeze({ id: 'navigation', label: 'Navegação' }),
  Object.freeze({ id: 'combat', label: 'Combate' }),
  Object.freeze({ id: 'warp', label: 'Dobra' })
]);

const PROFILE_IDS = new Set(PILOT_HUD_PROFILES.map(profile => profile.id));

function cloneLayout(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  // Layouts são objetos JSON simples; fallback para WebViews sem structuredClone.
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

export function createPilotHudProfileStore(settings = {}) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    throw new TypeError('As configurações dos perfis de HUD devem ser um objeto.');
  }

  const stored = settings.pilotHudProfiles && typeof settings.pilotHudProfiles === 'object'
    ? settings.pilotHudProfiles
    : {};
  const legacyFlightLayout = settings.pilotHudLayout;
  const layouts = Object.fromEntries(PILOT_HUD_PROFILES.map(({ id }) => [
    id,
    cloneLayout(stored[id] ?? (id === 'flight' ? legacyFlightLayout : null))
  ]));
  let activeProfile = PROFILE_IDS.has(settings.activePilotHudProfile)
    ? settings.activePilotHudProfile
    : 'flight';

  function assertProfile(profile) {
    if (!PROFILE_IDS.has(profile)) throw new RangeError('Perfil de HUD desconhecido: ' + profile);
  }

  function persistLayoutMap() {
    settings.pilotHudProfiles = Object.fromEntries(PILOT_HUD_PROFILES.map(({ id }) => [
      id,
      cloneLayout(layouts[id])
    ]));
    // O formato antigo permanece apenas como espelho do perfil Voo para saves legados.
    settings.pilotHudLayout = cloneLayout(layouts.flight);
  }

  return Object.freeze({
    get activeProfile() {
      return activeProfile;
    },
    select(profile) {
      assertProfile(profile);
      activeProfile = profile;
      return activeProfile;
    },
    getLayout(profile = activeProfile) {
      assertProfile(profile);
      return cloneLayout(layouts[profile]);
    },
    setLayout(profile, layout) {
      assertProfile(profile);
      layouts[profile] = cloneLayout(layout);
      persistLayoutMap();
      return cloneLayout(layouts[profile]);
    },
    resetLayout(profile) {
      assertProfile(profile);
      layouts[profile] = {};
      persistLayoutMap();
      return {};
    },
    snapshot() {
      return Object.freeze(Object.fromEntries(PILOT_HUD_PROFILES.map(({ id }) => [
        id,
        cloneLayout(layouts[id])
      ])));
    }
  });
}

export { PROFILE_IDS };
