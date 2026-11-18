# Planetary science reference

This reference defines the scientific consistency criteria for Earth and future
real or fictional planets in Star Frontier. It is connected to the shared
planetary science baseline and exposed to Earth through
`EARTH_REFERENCE_SOURCES`.

## Purpose and limits

The goal is not only a convincing globe. Interior structure, gravity, geology,
atmosphere, climate, hydrology, and rendering scale must describe the same
planet. This document is a design and validation reference; it does not claim
that the current game already simulates geophysics, tectonics, weather, or
climate in real time.

## 1. Planetary parameters and interior

Record mass, mean radius, bulk density, rotation period, axial obliquity,
orbital parameters, stellar input, and surface gravity as a coherent parameter
set. Surface gravity must be derived from mass and radius, not selected
independently. Keep physical units in the simulation layer even when visual
distances are compressed.

Describe the interior as inner core, liquid outer core, mantle, and crust, with
composition and thermal state appropriate to the selected world. A metallic
core can inform the magnetic-field model, but a magnetic field must not be
assumed solely from appearance.

## 2. Geology and tectonic history

Terrain should have a geological cause. Mountain belts, ocean trenches,
subduction zones, mid-ocean ridges, rifts, volcanic provinces, and seismic
regions should be consistent with a plate-boundary model or an explicitly
documented alternative.

Soil and surface colors should reflect plausible materials, weathering,
oxidation, volcanism, sediment, and biological coverage. Mineral resources
should follow the same geological model rather than being scattered
independently for gameplay convenience.

## 3. Atmosphere and climate

Atmospheric composition, pressure, density, temperature, and radiative
properties must be treated together. Sky color should follow the star spectrum,
gas composition, aerosols, and light scattering; it is not a free color choice
if scientific consistency is required.

Climate inputs include stellar insolation, orbit, axial tilt, rotation,
atmospheric circulation, ocean circulation, and topography. Winds, rain
belts, rain shadows, deserts, forests, tundra, and polar ice should emerge
from or be authored consistently with these controls.

## 4. Hydrology and surface change

Precipitation and meltwater should feed connected drainage basins. Rivers
should follow terrain gradients toward lakes, inland sinks, or oceans.
Hydraulic and thermal erosion can modify terrain over geological timescales;
gameplay-time weather and erosion should be separate simulation rates.

## 5. Planet-scale rendering

The visual globe must remain spherical and geographically continuous from
orbit to atmosphere to surface. Use a clear coordinate strategy, floating
origin or equivalent origin shifting, suitable precision for large distances,
and level-of-detail transitions. Any logarithmic or compressed visual
atmosphere must retain physical altitude values in simulation data.

## 6. Toolchain references

| Tool | Intended research or production role |
| --- | --- |
| GPlates | Plate reconstruction and tectonic history |
| Houdini / World Creator | Procedural terrain, erosion, and terrain authoring |
| SpaceEngine / Celestia | Astronomical scale, orbital context, and lighting study |
| Unreal Engine 5 / Unity | Large-world rendering, precision, origin shifting, and LOD |

These tools are references in the pipeline, not mandatory runtime
dependencies. Their outputs must be reviewed for scientific plausibility,
technical compatibility, and licensing before entering the game.

## 7. Integration rules

- Shared physical principles belong to the planetary baseline.
- Earth-specific datasets and observations belong to `src/world/earth/references`.
- Earth renderers remain independent modules with explicit interfaces.
- Research material never overwrites the active visual baseline automatically.
- A proposed implementation must be reviewed, integrated as a separate change,
  and tested before any previous implementation is retired.
- Do not label procedural terrain, simulated weather, or approximate upper
  atmosphere as measured scientific data.

## Source and asset policy

Use NASA, NOAA, USGS, and other scientific institutions for measured data and
technical documentation. Google Earth is a geographic visual comparison
reference unless the specific intended use is permitted by its applicable
terms. Verify attribution and license conditions for every individual asset.
