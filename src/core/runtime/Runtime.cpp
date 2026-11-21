#include "Runtime.h"

#include <algorithm>
#include <cmath>
#include <new>

#if defined(__EMSCRIPTEN__)
#include <emscripten/emscripten.h>
#define RUNTIME_EXPORT EMSCRIPTEN_KEEPALIVE
#else
#define RUNTIME_EXPORT
#endif

Runtime::Runtime(double maximumDeltaSeconds)
  : status_(RuntimeStatus::Created),
    maximumDeltaSeconds_(std::isfinite(maximumDeltaSeconds) && maximumDeltaSeconds > 0.0
      ? maximumDeltaSeconds
      : 0.04),
    frameCount_(0.0),
    elapsedSeconds_(0.0),
    deltaSeconds_(0.0) {}

bool Runtime::initialize() {
  if (status_ != RuntimeStatus::Created && status_ != RuntimeStatus::Stopped) return false;
  frameCount_ = 0.0;
  elapsedSeconds_ = 0.0;
  deltaSeconds_ = 0.0;
  status_ = RuntimeStatus::Ready;
  return true;
}

bool Runtime::start() {
  if (status_ != RuntimeStatus::Ready) return false;
  status_ = RuntimeStatus::Running;
  return true;
}

bool Runtime::pause() {
  if (status_ != RuntimeStatus::Running) return false;
  status_ = RuntimeStatus::Paused;
  deltaSeconds_ = 0.0;
  return true;
}

bool Runtime::resume() {
  if (status_ != RuntimeStatus::Paused) return false;
  status_ = RuntimeStatus::Running;
  return true;
}

bool Runtime::stop() {
  if (status_ == RuntimeStatus::Stopped) return true;
  status_ = RuntimeStatus::Stopped;
  deltaSeconds_ = 0.0;
  return true;
}

double Runtime::tick(double deltaSeconds) {
  if (status_ != RuntimeStatus::Running ||
      !std::isfinite(deltaSeconds) || deltaSeconds < 0.0) {
    deltaSeconds_ = 0.0;
    return 0.0;
  }

  deltaSeconds_ = std::min(deltaSeconds, maximumDeltaSeconds_);
  elapsedSeconds_ += deltaSeconds_;
  frameCount_ += 1.0;
  return deltaSeconds_;
}

RuntimeStatus Runtime::status() const { return status_; }
double Runtime::frameCount() const { return frameCount_; }
double Runtime::elapsedSeconds() const { return elapsedSeconds_; }
double Runtime::deltaSeconds() const { return deltaSeconds_; }

extern "C" {

RUNTIME_EXPORT Runtime* runtime_create(double maximumDeltaSeconds) {
  return new (std::nothrow) Runtime(maximumDeltaSeconds);
}

RUNTIME_EXPORT void runtime_destroy(Runtime* runtime) {
  delete runtime;
}

RUNTIME_EXPORT int runtime_initialize(Runtime* runtime) {
  return runtime && runtime->initialize() ? 1 : 0;
}

RUNTIME_EXPORT int runtime_start(Runtime* runtime) {
  return runtime && runtime->start() ? 1 : 0;
}

RUNTIME_EXPORT int runtime_pause(Runtime* runtime) {
  return runtime && runtime->pause() ? 1 : 0;
}

RUNTIME_EXPORT int runtime_resume(Runtime* runtime) {
  return runtime && runtime->resume() ? 1 : 0;
}

RUNTIME_EXPORT int runtime_stop(Runtime* runtime) {
  return runtime && runtime->stop() ? 1 : 0;
}

RUNTIME_EXPORT double runtime_tick(Runtime* runtime, double deltaSeconds) {
  return runtime ? runtime->tick(deltaSeconds) : 0.0;
}

RUNTIME_EXPORT std::uint32_t runtime_get_status(const Runtime* runtime) {
  return runtime ? static_cast<std::uint32_t>(runtime->status()) :
    static_cast<std::uint32_t>(RuntimeStatus::Stopped);
}

RUNTIME_EXPORT double runtime_get_frame_count(const Runtime* runtime) {
  return runtime ? runtime->frameCount() : 0.0;
}

RUNTIME_EXPORT double runtime_get_elapsed_seconds(const Runtime* runtime) {
  return runtime ? runtime->elapsedSeconds() : 0.0;
}

RUNTIME_EXPORT double runtime_get_delta_seconds(const Runtime* runtime) {
  return runtime ? runtime->deltaSeconds() : 0.0;
}

}
