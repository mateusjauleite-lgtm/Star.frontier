#include "Ships/Controls/FrontierShipControlsComponent.h"
#include "Ships/Core/FrontierShip.h"

void UFrontierShipControlsComponent::Publish()
{
    if (AFrontierShip* Ship = Cast<AFrontierShip>(GetOwner()))
        Ship->SetFlightInputs(Throttle, Pitch, Yaw, bBraking, bBoosting);
}

void UFrontierShipControlsComponent::SetThrottle(float Value) { Throttle = FMath::Clamp(Value, -1.0f, 1.0f); Publish(); }
void UFrontierShipControlsComponent::SetPitch(float Value) { Pitch = FMath::Clamp(Value, -1.0f, 1.0f); Publish(); }
void UFrontierShipControlsComponent::SetYaw(float Value) { Yaw = FMath::Clamp(Value, -1.0f, 1.0f); Publish(); }
void UFrontierShipControlsComponent::SetBraking(bool bEnabled) { bBraking = bEnabled; Publish(); }
void UFrontierShipControlsComponent::SetBoosting(bool bEnabled) { bBoosting = bEnabled; Publish(); }

void UFrontierShipControlsComponent::ClearControls()
{
    Throttle = Pitch = Yaw = 0.0f;
    bBraking = bBoosting = false;
    Publish();
}
