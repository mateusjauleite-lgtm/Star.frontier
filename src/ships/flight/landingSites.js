/**
 * Candidate coordinates only. No site is approved until terrain elevation,
 * neighboring slopes, roughness, hazards and approach corridor are validated.
 */
export const EARTH_LANDING_SITES=Object.freeze([
 Object.freeze({
  id:'earth-salar-test-candidate',
  name:'Candidato Salar de Uyuni',
  body:'earth',
  latitudeDeg:-20.2,
  longitudeDeg:-67.5,
  status:'candidate',
  maximumSlopeDeg:5,
  requiresTerrainValidation:true,
  requiresPadPlacement:true,
  note:'Região candidata; ainda não validada pela malha ETOPO.'
 })
]);
export function getLandingSite(id,sites=EARTH_LANDING_SITES){return sites.find(site=>site.id===id)??null;}
