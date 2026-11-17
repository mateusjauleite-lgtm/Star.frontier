#include <cmath>
#include <cstddef>

#if defined(__EMSCRIPTEN__)
#include <emscripten/emscripten.h>
#define GRAVITY_EXPORT EMSCRIPTEN_KEEPALIVE
#else
#define GRAVITY_EXPORT
#endif

namespace {
bool finite3(const double* v) {
  return v && std::isfinite(v[0]) && std::isfinite(v[1]) && std::isfinite(v[2]);
}
}

extern "C" {

// All positions use the same coordinate unit; mu uses unit^3/s^2.
// Output is acceleration in coordinate-units/s^2.
GRAVITY_EXPORT int gravity_acceleration(
  const double* position,
  const double* uniform_acceleration,
  const double* body_positions,
  const double* gravitational_parameters,
  int body_count,
  double* output
) {
  if (!finite3(position) || !finite3(uniform_acceleration) || !output ||
      body_count < 0 || (body_count > 0 && (!body_positions || !gravitational_parameters))) return 0;

  double result[3] = {uniform_acceleration[0], uniform_acceleration[1], uniform_acceleration[2]};
  for (int body = 0; body < body_count; ++body) {
    const double mu = gravitational_parameters[body];
    const double* center = body_positions + body * 3;
    if (!finite3(center) || !std::isfinite(mu) || mu < 0.0) return 0;
    if (mu == 0.0) continue;

    const double dx = position[0] - center[0];
    const double dy = position[1] - center[1];
    const double dz = position[2] - center[2];
    const double r2 = dx*dx + dy*dy + dz*dz;
    if (!std::isfinite(r2) || r2 <= 1e-18) return 0;
    const double factor = -mu / (r2 * std::sqrt(r2));
    result[0] += factor * dx;
    result[1] += factor * dy;
    result[2] += factor * dz;
  }

  if (!finite3(result)) return 0;
  output[0] = result[0];
  output[1] = result[1];
  output[2] = result[2];
  return 1;
}

// Semi-implicit Euler step used by moving bodies/characters.
GRAVITY_EXPORT int gravity_integrate_velocity(
  const double* velocity,
  const double* acceleration,
  double delta_seconds,
  double maximum_speed,
  double* output
) {
  if (!finite3(velocity) || !finite3(acceleration) || !output ||
      !std::isfinite(delta_seconds) || delta_seconds < 0.0 ||
      !std::isfinite(maximum_speed) || maximum_speed < 0.0) return 0;

  double next[3] = {
    velocity[0] + acceleration[0] * delta_seconds,
    velocity[1] + acceleration[1] * delta_seconds,
    velocity[2] + acceleration[2] * delta_seconds
  };
  const double speed = std::sqrt(next[0]*next[0] + next[1]*next[1] + next[2]*next[2]);
  if (!std::isfinite(speed)) return 0;
  if (maximum_speed > 0.0 && speed > maximum_speed) {
    const double scale = maximum_speed / speed;
    next[0] *= scale; next[1] *= scale; next[2] *= scale;
  }
  output[0] = next[0]; output[1] = next[1]; output[2] = next[2];
  return 1;
}

}
