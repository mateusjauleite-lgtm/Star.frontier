#!/usr/bin/env bash
set -euo pipefail

mkdir -p public/core
em++ src/core/runtime/Runtime.cpp \
  -O3 -std=c++17 \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s EXPORT_ES6=1 \
  -s EXPORT_NAME=createRuntimeModule \
  -s ENVIRONMENT=web,worker \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s EXPORTED_FUNCTIONS='["_runtime_create","_runtime_destroy","_runtime_initialize","_runtime_start","_runtime_pause","_runtime_resume","_runtime_stop","_runtime_tick","_runtime_get_status","_runtime_get_frame_count","_runtime_get_elapsed_seconds","_runtime_get_delta_seconds"]' \
  -o public/core/runtime.js
