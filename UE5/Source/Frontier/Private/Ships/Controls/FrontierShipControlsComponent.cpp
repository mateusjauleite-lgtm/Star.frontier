#include "Ships/Controls/FrontierShipControlsComponent.h"
#include "Ships/Core/FrontierShip.h"

bool UFrontierShipControlsComponent::CanAcceptInput() const
{
    const AFrontierShip* Ship = Cast<AFrontierShip>(GetOwner());
    return Ship && Ship->IsPiloted();
}

void UFrontierShipControlsComponent::Publish()
{
    if (AFrontierShip* Ship = Cast<AFrontierShip>(GetOwner()))
        if (Ship->IsPiloted())
            Ship->SetFlightInputs(Throttle, Pitch, Yaw, bBraking, bBoosting);
}

void UFrontierShipControlsComponent::SetThrottle(float Value)
{
    if (!CanAcceptInput()) return;
    Throttle = FMath::Clamp(Value, -1.0f, 1.0f);
    Publish();
}
void UFrontierShipControlsComponent::SetPitch(float Value)
{
    if (!CanAcceptInput()) return;
    Pitch = FMath::Clamp(Value, -1.0f, 1.0f);
    Publish();
}
void UFrontierShipControlsComponent::SetYaw(float Value)
{
    if (!CanAcceptInput()) return;
    Yaw = FMath::Clamp(Value, -1.0f, 1.0f);
    Publish();
}
void UFrontierShipControlsComponent::SetBraking(bool bEnabled)
{
    if (!CanAcceptInput()) return;
    bBraking = bEnabled;
    Publish();
}
void UFrontierShipControlsComponent::SetBoosting(bool bEnabled)
{
    if (!CanAcceptInput()) return;
    bBoosting = bEnabled;
    Publish();
}

void UFrontierShipControlsComponent::ClearControls()
{
    Throttle = Pitch = Yaw = 0.0f;
    bBraking = bBoosting = false;
    Publish();
}

bool UFrontierShipControlsComponent::RequestPilotExit(AActor* RequestingActor)
{
    if (AFrontierShip* Ship = Cast<AFrontierShip>(GetOwner()))
        return Ship->RequestPilotExit(RequestingActor);
    return false;
}
