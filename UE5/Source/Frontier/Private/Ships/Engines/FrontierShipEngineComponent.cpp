#include "Ships/Engines/FrontierShipEngineComponent.h"
#include "Ships/Core/FrontierShip.h"

UFrontierShipEngineComponent::UFrontierShipEngineComponent()
{
    PrimaryComponentTick.bCanEverTick = true;
}

void UFrontierShipEngineComponent::BeginPlay()
{
    Super::BeginPlay();
}

void UFrontierShipEngineComponent::TickComponent(
    float DeltaSeconds, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaSeconds, TickType, ThisTickFunction);

    const AFrontierShip* Ship = Cast<AFrontierShip>(GetOwner());
    if (!Ship) return;

    const FFrontierShipFlightState& Flight = Ship->FlightState;
    if (Flight.bBraking)
    {
        CurrentSpeedCmPerSecond = FMath::Max(0.0f, CurrentSpeedCmPerSecond - BrakeDeceleration * DeltaSeconds);
        return;
    }

    const float Boost = Flight.bBoosting ? FMath::Max(1.0f, BoostMultiplier) : 1.0f;
    const float TargetSpeed = MaximumSpeedCmPerSecond * Boost * FMath::Abs(Flight.Throttle);
    const float AccelerationRate = AccelerationCmPerSecondSquared * Boost;
    CurrentSpeedCmPerSecond = FMath::FInterpConstantTo(
        CurrentSpeedCmPerSecond, TargetSpeed, DeltaSeconds, AccelerationRate);
}
