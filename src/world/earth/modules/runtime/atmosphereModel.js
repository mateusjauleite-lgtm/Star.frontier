// Physical altitude data and gameplay sampling for Earth's atmosphere.
// Altitudes are real kilometres; visual compression is handled separately.
export const EARTH_ATMOSPHERE_LAYERS = Object.freeze([
  { id: 'troposphere', label: 'Troposfera', lowerKm: 0, upperKm: 12, color: 0x58b9f4 },
  { id: 'stratosphere', label: 'Estratosfera', lowerKm: 12, upperKm: 50, color: 0x4b8fe8 },
  { id: 'mesosphere', label: 'Mesosfera', lowerKm: 50, upperKm: 85, color: 0x7568c9 },
  { id: 'thermosphere', label: 'Termosfera', lowerKm: 85, upperKm: 600, color: 0xc16bd7 },
  { id: 'exosphere', label: 'Exosfera', lowerKm: 600, upperKm: 10000, color: 0x9b9de8 }
]);

export const EARTH_ATMOSPHERE_TOP_KM = 10000;

// Logarithmic display mapping keeps the 300-unit Earth playable while
// preserving exact physical altitude in the simulation data.
export function atmosphereAltitudeToVisualKm(altitudeKm) {
  const altitude = Math.max(0, Math.min(EARTH_ATMOSPHERE_TOP_KM, altitudeKm));
  const visualExtent = 160;
  return visualExtent * Math.log1p(altitude / 12) /
    Math.log1p(EARTH_ATMOSPHERE_TOP_KM / 12);
}

const GAS_CONSTANT_AIR = 287.05287;
const GRAVITY = 9.80665;
const BASES = [0, 11000, 20000, 32000, 47000, 51000, 71000, 84852];
const LAPSE = [-0.0065, 0, 0.001, 0.0028, 0, -0.0028, -0.002];

function buildStandardLayers() {
  const layers = [];
  let temperature = 288.15;
  let pressure = 101325;
  for (let i = 0; i < LAPSE.length; i++) {
    const base = BASES[i];
    const top = BASES[i + 1];
    const lapse = LAPSE[i];
    layers.push({ base, top, temperature, pressure, lapse });
    const delta = top - base;
    if (lapse === 0) {
      pressure *= Math.exp(-GRAVITY * delta / (GAS_CONSTANT_AIR * temperature));
    } else {
      const nextTemperature = temperature + lapse * delta;
      pressure *= Math.pow(nextTemperature / temperature,
        -GRAVITY / (lapse * GAS_CONSTANT_AIR));
      temperature = nextTemperature;
    }
    if (lapse === 0) temperature = layers[i].temperature;
  }
  return layers;
}

const STANDARD_LAYERS = buildStandardLayers();

export function sampleEarthAtmosphere(altitudeKm) {
  const hKm = Math.max(0, Math.min(EARTH_ATMOSPHERE_TOP_KM, Number(altitudeKm) || 0));
  const h = hKm * 1000;
  let temperatureK;
  let pressurePa;

  if (h <= 84852) {
    const layer = STANDARD_LAYERS.find(item => h >= item.base && h <= item.top) ||
      STANDARD_LAYERS[STANDARD_LAYERS.length - 1];
    const delta = h - layer.base;
    temperatureK = layer.temperature + layer.lapse * delta;
    pressurePa = layer.lapse === 0
      ? layer.pressure * Math.exp(-GRAVITY * delta / (GAS_CONSTANT_AIR * layer.temperature))
      : layer.pressure * Math.pow(temperatureK / layer.temperature,
        -GRAVITY / (layer.lapse * GAS_CONSTANT_AIR));
  } else {
    // Upper-atmosphere gameplay approximation, continuously anchored at 84.852 km.
    const anchor = sampleEarthAtmosphere(84.852);
    const deltaKm = hKm - 84.852;
    const scaleHeightKm = hKm <= 600 ? 55 : 500;
    const exponent = hKm <= 600
      ? deltaKm / scaleHeightKm
      : (600 - 84.852) / 55 + (hKm - 600) / 500;
    temperatureK = hKm <= 600
      ? 190 + (1000 - 190) * (deltaKm / (600 - 84.852))
      : 1000;
    pressurePa = anchor.pressurePa * Math.exp(-exponent);
  }

  const densityKgM3 = pressurePa / (GAS_CONSTANT_AIR * temperatureK);
  const layer = EARTH_ATMOSPHERE_LAYERS.find(item =>
    hKm >= item.lowerKm && hKm < item.upperKm) || EARTH_ATMOSPHERE_LAYERS[4];

  return {
    altitudeKm: hKm,
    layer: layer.id,
    temperatureK,
    pressurePa,
    densityKgM3,
    gravityFactor: Math.pow(6371 / (6371 + hKm), 2)
  };
}
