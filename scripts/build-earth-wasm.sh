#!/usr/bin/env bash
set -euo pipefail

mkdir -p public/earth
em++ src/world/earth/wasm/earthKernel.cpp \
  -O3 -std=c++17 \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s EXPORT_ES6=1 \
  -s EXPORT_NAME=createEarthKernelModule \
  -s ENVIRONMENT=web,worker \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s EXPORTED_FUNCTIONS='["_malloc","_free","_earth_sample_bilinear","_earth_sample_bilinear_batch","_earth_elevation_meters_to_units","_earth_procedural_detail_meters"]' \
  -o public/earth/earthKernel.js
