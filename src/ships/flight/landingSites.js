/**
 * Candidate coordinates only. The GPS reference anchors the region; the pad
 * remains unapproved until local high-resolution terrain and hazards are checked.
 */
export const EARTH_LANDING_SITES=Object.freeze([
 Object.freeze({
  id:'earth-salar-test-candidate',
  name:'Base Star Frontier — Salar de Uyuni (referência UY04)',
  body:'earth',
  latitudeDeg:-20.211888829,
  longitudeDeg:-67.422529683,
  coordinateReference:'WGS84',
  referencePointId:'UY04',
  referenceElevationMeters:3697.2995,
  status:'candidate',
  landingHeadingTrueDeg:0,
  approachHeadingTrueDeg:0,
  approachReference:'true-north',
  maximumSlopeDeg:5,
  requiresTerrainValidation:true,
  requiresPadPlacement:true,
  requiresApproachCorridorValidation:true,
  note:'Coordenada de ponto GPS publicado no Salar; referência geográfica, não autorização de pouso. Validar DEM local, água/salmoura sazonal, crosta, obstáculos e escala da nave.'
 })
]);
export function getLandingSite(id,sites=EARTH_LANDING_SITES){return sites.find(site=>site.id===id)??null;}
