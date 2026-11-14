#include "Ships/Core/FrontierShip.h"
#include "Ships/Controls/FrontierShipControlsComponent.h"
#include "Ships/Engines/FrontierShipEngineComponent.h"
#include "Ships/Interior/FrontierShipInteriorComponent.h"
#include "Ships/Computer/FrontierShipComputerComponent.h"
#include "Components/SceneComponent.h"

AFrontierShip::AFrontierShip()
{
    PrimaryActorTick.bCanEverTick = true;
    ShipRoot = CreateDefaultSubobject<USceneComponent>(TEXT("ShipRoot"));
    SetRootComponent(ShipRoot);

    Controls = CreateDefaultSubobject<UFrontierShipControlsComponent>(TEXT("ShipControls"));
    Engines = CreateDefaultSubobject<UFrontierShipEngineComponent>(TEXT("ShipEngines"));
    Interior = CreateDefaultSubobject<UFrontierShipInteriorComponent>(TEXT("ShipInterior"));
    Computer = CreateDefaultSubobject<UFrontierShipComputerComponent>(TEXT("ShipComputer"));
}

void AFrontierShip::AssignCommander(FName NewCommanderId)
{
    Identity.CommanderId = NewCommanderId;
    OnIdentityChanged.Broadcast(Identity.ShipId, Identity.CommanderId);
}

void AFrontierShip::SetFlightInputs(
    float NewThrottle, float NewPitch, float NewYaw, bool bNewBraking, bool bNewBoosting)
{
    FlightState.Throttle = FMath::Clamp(NewThrottle, -1.0f, 1.0f);
    FlightState.PitchInput = FMath::Clamp(NewPitch, -1.0f, 1.0f);
    FlightState.YawInput = FMath::Clamp(NewYaw, -1.0f, 1.0f);
    FlightState.bBraking = bNewBraking;
    FlightState.bBoosting = bNewBoosting;
    OnFlightStateChanged.Broadcast(FlightState);
}

void AFrontierShip::ClearFlightInputs()
{
    SetFlightInputs(0.0f, 0.0f, 0.0f, false, false);
}

void AFrontierShip::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    if (Engines)
    {
        FlightState.SpeedCmPerSecond = Engines->GetCurrentSpeedCmPerSecond();
        OnFlightStateChanged.Broadcast(FlightState);
    }
}
