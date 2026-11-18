#!/usr/bin/env bash
set -euo pipefail
mkdir -p public/physics
em++ src/physics/gravityKernel.cpp \
  -O3 -std=c++17 -s WASM=1 -s MODULARIZE=1 -s EXPORT_ES6=1 \
  -s EXPORT_NAME=createGravityKernelModule -s ENVIRONMENT=web,worker \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s EXPORTED_FUNCTIONS='["_malloc","_free","_gravity_acceleration","_gravity_integrate_velocity"]' \
  -o public/physics/gravityKernel.js
