# Atmosphere & Climate Core (UE 5.8)

## Purpose

Provide a reusable, data-driven atmospheric baseline for planetary bodies. The core is independent from rendering: it does not create materials, clouds, fog, weather particles, or post-process effects.

## Dependency direction

- Atmosphere & Climate Core references Planetary Core through `UPlanetaryProfileDataAsset`.
- Planetary Core does not depend on Atmosphere & Climate Core.
- Earth Core and future planetary renderers may consume atmospheric samples without owning the physical model.

## Branches

- **Atmospheric composition**: gas identifiers, volume fractions, and molar masses.
- **Atmospheric layers**: altitude intervals, reference pressure/temperature, lapse rate, and pressure scale height.
- **Climate baseline**: mean surface temperature, relative humidity, wind speed, and precipitation.
- **Runtime subsystem**: active profile selection and altitude sampling.

## Units

- Altitude and scale height: kilometres.
- Pressure: pascals.
- Temperature: kelvin.
- Density: kilograms per cubic metre.
- Wind speed: metres per second.
- Precipitation: millimetres per day.
- Gas molar mass: kilograms per mole.

## Current sampling model

Pressure uses a layer-local exponential scale-height approximation. Temperature uses a layer-local linear lapse-rate approximation. Density is estimated with the ideal gas law using the composition-weighted molar mass.

This is intentionally a deterministic baseline. It is not a numerical weather prediction model and does not yet model humidity-dependent density, winds, circulation, clouds, radiation transfer, or seasonal variation.

## Validation

A profile requires a valid Planetary Core asset, a gas composition summing to 1.0 (within 0.01), at least one valid layer, and a valid climate baseline. Altitude samples outside configured layer ranges return false.

## Next integration steps

1. Create an Earth atmosphere Data Asset from the NASA/reference profile values after source review.
2. Add profile loading to the world/planet initialization flow.
3. Build a separate UE5 atmosphere rendering adapter (SkyAtmosphere, fog, cloud materials, and lighting).
4. Add automated tests for composition validation, layer selection, pressure, temperature, and density.
5. Compile and validate in an actual UE 5.8 Editor/Build Tool environment.
