// Estado compartilhado do Star Frontier.
// Os módulos importam esta mesma referência para manter os dados sincronizados.

export const state = {
  user: '',
  email: '',
  country: 'Brasil',
  credits: 1000,
  ore: 0,
  fuel: 100,
  cargo: 0,
  hull: 100,
  shield: 100,
  speed: 0,
  ship: 'Nave exploradora',
  character: 'Explorador',
  camera: 2,
  throttle: false,
  braking: false,
  nitroButton: false,
  nitro: 100,
  move: { x: 0, y: 0 },
  view: { x: 0, y: 0 },
  miningDrill: 'Broca básica',
  settings: {
    quality: 'Média',
    music: 40,
    effects: 70,
    sensitivity: 1
  }
};

// Controles momentâneos não devem continuar ativos após carregar um jogo.
export function resetTransientState() {
  state.move = { x: 0, y: 0 };
  state.view = { x: 0, y: 0 };
  state.throttle = false;
  state.braking = false;
  state.nitroButton = false;
}
