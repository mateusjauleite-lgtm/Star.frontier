#pragma once

#include <cstdint>

enum class RuntimeStatus : std::uint32_t {
  Created = 0,
  Ready = 1,
  Running = 2,
  Paused = 3,
  Stopped = 4
};

class Runtime {
public:
  explicit Runtime(double maximumDeltaSeconds = 0.04);

  bool initialize();
  bool start();
  bool pause();
  bool resume();
  bool stop();

  double tick(double deltaSeconds);

  RuntimeStatus status() const;
  double frameCount() const;
  double elapsedSeconds() const;
  double deltaSeconds() const;

private:
  RuntimeStatus status_;
  double maximumDeltaSeconds_;
  double frameCount_;
  double elapsedSeconds_;
  double deltaSeconds_;
};
