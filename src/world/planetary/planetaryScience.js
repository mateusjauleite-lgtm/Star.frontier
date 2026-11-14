/**
 * Shared scientific design contract for real and fictional planetary bodies.
 * This is reference metadata, not a runtime geophysics or climate solver.
 */
export const PLANETARY_SCIENCE_BASELINE = Object.freeze({
  id: 'planetary-science-baseline',
  version: '1.0.0',
  mode: 'reference-and-validation',
  autoApply: false,
  runtimeSimulation: false,
  requireReviewBeforeImplementation: true,
  principles: Object.freeze([
    'planetary-mass-radius-density-gravity-consistency',
    'interior-composition-and-thermal-state',
    'lithosphere-plate-boundaries-and-tectonic-history',
    'topography-linked-to-geological-processes',
    'atmospheric-composition-pressure-and-radiative-balance',
    'axial-tilt-orbit-and-stellar-insolation',
    'atmospheric-and-oceanic-circulation',
    'hydrology-erosion-and-sediment-transport',
    'planet-scale-coordinate-and-rendering-precision'
  ]),
  systems: Object.freeze({
    interior: ['inner-core', 'outer-core', 'mantle', 'crust', 'magnetic-field'],
    geology: ['lithosphere', 'tectonic-plates', 'subduction', 'rifts', 'mid-ocean-ridges', 'volcanism', 'seismicity', 'mineral-composition'],
    atmosphere: ['composition', 'pressure', 'density', 'temperature', 'radiative-transfer', 'clouds', 'winds'],
    climate: ['stellar-insolation', 'axial-obliquity', 'seasons', 'atmospheric-circulation', 'ocean-currents', 'biomes'],
    hydrology: ['precipitation', 'watersheds', 'rivers', 'groundwater', 'glaciers', 'hydraulic-erosion', 'thermal-erosion'],
    rendering: ['spherical-world', 'floating-origin', 'double-precision-coordinates', 'level-of-detail', 'space-atmosphere-surface-continuity']
  }),
  consistencyRules: Object.freeze([
    'surface-gravity-must-follow-mass-and-radius',
    'mountain-belts-and-ocean-trenches-must-follow-a-plausible-tectonic-model',
    'biomes-must-follow-insolation-atmosphere-topography-and-water-availability',
    'rivers-must-flow-through-connected-drainage-basins-toward-sinks',
    'atmospheric-color-must-follow-composition-and-light-scattering',
    'visual-scale-compression-must-never-change-simulation-units'
  ]),
  toolchain: Object.freeze([
    { id: 'gplates', role: 'tectonic-plate-reconstruction', url: 'https://www.gplates.org/' },
    { id: 'houdini', role: 'procedural-terrain-and-erosion', url: 'https://www.sidefx.com/products/houdini/' },
    { id: 'world-creator', role: 'procedural-terrain-authoring', url: 'https://www.world-creator.com/' },
    { id: 'spaceengine', role: 'astronomical-scale-and-lighting-reference', url: 'https://spaceengine.org/' },
    { id: 'celestia', role: 'orbital-and-celestial-reference', url: 'https://celestiaproject.space/' },
    { id: 'unreal-engine', role: 'large-world-rendering-and-world-partition', url: 'https://www.unrealengine.com/' },
    { id: 'unity', role: 'planet-scale-rendering-and-origin-shifting', url: 'https://unity.com/' }
  ]),
  implementationPolicy: Object.freeze({
    referencesAreAdvisory: true,
    validateDataLicensePerAsset: true,
    separateScientificUnitsFromVisualScale: true,
    preserveExistingBaselineUntilReplacementPassesTests: true,
    implementAsIndependentModules: true
  })
});
