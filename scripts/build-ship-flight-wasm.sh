#!/usr/bin/env bash
set -euo pipefail
mkdir -p public/ship
em++ src/ships/flight/shipFlightKernel.cpp \
  -O3 -std=c++17 -s WASM=1 -s MODULARIZE=1 -s EXPORT_ES6=1 \
  -s EXPORT_NAME=createShipFlightKernelModule -s ENVIRONMENT=web,worker \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s EXPORTED_FUNCTIONS='["_malloc","_free","_ship_gravity_acceleration_component","_ship_integrate_orbit_step"]' \
  -o public/ship/shipFlightKernel.js
