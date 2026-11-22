import { MATTER_CATEGORIES as C } from '../../constants.js';

export const isotopesParticles = [
  { id: 'isotope.hydrogen-1', name: 'Hidrogênio-1 (prótio)', symbol: '¹H', category: C.ISOTOPE, elementId: 'element.hydrogen', massNumber: 1, stable: true, description: 'Isótopo mais abundante do hidrogênio; núcleo com um próton.', tags: ['estável'] },
  { id: 'isotope.hydrogen-2', name: 'Hidrogênio-2 (deutério)', symbol: '²H', category: C.ISOTOPE, elementId: 'element.hydrogen', massNumber: 2, stable: true, description: 'Isótopo estável do hidrogênio com um próton e um nêutron.', tags: ['estável', 'água pesada'] },
  { id: 'isotope.carbon-14', name: 'Carbono-14', symbol: '¹⁴C', category: C.ISOTOPE, elementId: 'element.carbon', massNumber: 14, stable: false, halfLifeYears: 5730, description: 'Radioisótopo de carbono usado em datação radiométrica.', tags: ['radioisótopo'] },
  { id: 'isotope.iron-56', name: 'Ferro-56', symbol: '⁵⁶Fe', category: C.ISOTOPE, elementId: 'element.iron', massNumber: 56, stable: true, description: 'Isótopo estável abundante do ferro.', tags: ['estável'] },
  { id: 'particle.proton', name: 'Próton', symbol: 'p+', category: C.PARTICLE, chargeElementary: 1, massMevC2: 938.272, description: 'Hádr on composto por quarks up e down; integra o núcleo atômico.', tags: ['bárion', 'núcleo atômico'] },
  { id: 'particle.neutron', name: 'Nêutron', symbol: 'n0', category: C.PARTICLE, chargeElementary: 0, massMevC2: 939.565, description: 'Hádr on eletricamente neutro que integra a maioria dos núcleos atômicos.', tags: ['bárion', 'núcleo atômico'] },
  { id: 'particle.electron', name: 'Elétron', symbol: 'e−', category: C.PARTICLE, chargeElementary: -1, massMevC2: 0.510999, description: 'Lépton elementar responsável por grande parte das propriedades elétricas e químicas dos átomos.', tags: ['lépton', 'carga elétrica'] },
];
