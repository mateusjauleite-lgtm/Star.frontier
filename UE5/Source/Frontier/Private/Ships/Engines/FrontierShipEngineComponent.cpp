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

    const float Boost = Flight.bBoosting ? BoostMultiplier : 1.0f;
    const float TargetSpeed = MaximumSpeedCmPerSecond * FMath::Abs(Flight.Throttle);
    const float Rate = AccelerationCmPerSecondSquared * Boost * DeltaSeconds;
    CurrentSpeedCmPerSecond = FMath::FInterpConstantTo(CurrentSpeedCmPerSecond, TargetSpeed, DeltaSeconds, Rate / FMath::Max(DeltaSeconds, KINDA_SMALL_NUMBER));
}
