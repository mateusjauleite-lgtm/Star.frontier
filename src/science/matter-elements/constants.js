export const MATTER_CATEGORIES = Object.freeze({
  ELEMENT: 'chemical-element',
  MINERAL: 'mineral-crystal',
  ALLOY: 'metal-alloy',
  COMPOUND: 'gas-compound',
  ISOTOPE: 'isotope',
  PARTICLE: 'subatomic-particle',
});

export const MATTER_STATES = Object.freeze([
  'solid', 'liquid', 'gas', 'plasma', 'unknown',
]);

export const MATTER_CATEGORY_LABELS = Object.freeze({
  [MATTER_CATEGORIES.ELEMENT]: 'Elementos químicos',
  [MATTER_CATEGORIES.MINERAL]: 'Minerais e cristais',
  [MATTER_CATEGORIES.ALLOY]: 'Metais e ligas',
  [MATTER_CATEGORIES.COMPOUND]: 'Gases e compostos',
  [MATTER_CATEGORIES.ISOTOPE]: 'Isótopos',
  [MATTER_CATEGORIES.PARTICLE]: 'Partículas subatômicas',
});
