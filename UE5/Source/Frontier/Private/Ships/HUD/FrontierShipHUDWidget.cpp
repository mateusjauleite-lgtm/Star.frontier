#include "Ships/HUD/FrontierShipHUDWidget.h"
#include "Ships/Interior/FrontierShipInteriorComponent.h"
#include "Ships/Interior/FrontierShipElevator.h"
#include "Ships/Controls/FrontierShipControlsComponent.h"
#include "Character/Core/FrontierCharacter.h"

void UFrontierShipHUDWidget::ObserveShip(AFrontierShip* Ship, AFrontierCharacter* Character)
{
    if (ObservedShip)
        ObservedShip->OnFlightStateChanged.RemoveDynamic(
            this, &UFrontierShipHUDWidget::HandleFlightStateChanged);

    ObservedShip = Ship;
    ObservedCharacter = Character;
    if (!ObservedShip)
    {
        RefreshShipHUD(FFrontierShipFlightState(), FText::GetEmpty(), false);
        return;
    }

    ObservedShip->OnFlightStateChanged.AddDynamic(
        this, &UFrontierShipHUDWidget::HandleFlightStateChanged);
    HandleFlightStateChanged(ObservedShip->FlightState);
}

void UFrontierShipHUDWidget::HandleFlightStateChanged(const FFrontierShipFlightState& State)
{
    const bool bPiloting = ObservedShip && ObservedShip->IsPiloted();
    RefreshShipHUD(State, bPiloting ? ObservedShip->Identity.DisplayName : FText::GetEmpty(), bPiloting);
}

void UFrontierShipHUDWidget::SetThrottleInput(float Value)
{
    if (ObservedShip && ObservedShip->Controls)
        ObservedShip->Controls->SetThrottle(Value);
}

void UFrontierShipHUDWidget::SetSteeringInput(float Yaw, float Pitch)
{
    if (!ObservedShip || !ObservedShip->Controls) return;
    ObservedShip->Controls->SetYaw(Yaw);
    ObservedShip->Controls->SetPitch(Pitch);
}

void UFrontierShipHUDWidget::SetBrake(bool bPressed)
{
    if (ObservedShip && ObservedShip->Controls)
        ObservedShip->Controls->SetBraking(bPressed);
}

void UFrontierShipHUDWidget::SetBoost(bool bPressed)
{
    if (ObservedShip && ObservedShip->Controls)
        ObservedShip->Controls->SetBoosting(bPressed);
}

void UFrontierShipHUDWidget::ClearFlightInput()
{
    if (ObservedShip && ObservedShip->Controls)
        ObservedShip->Controls->ClearControls();
}

void UFrontierShipHUDWidget::ExitPilotSeat()
{
    if (ObservedShip && ObservedCharacter)
        ObservedShip->RequestPilotExit(ObservedCharacter);
}

bool UFrontierShipHUDWidget::ElevatorUp()
{
    AFrontierShipElevator* Elevator = ObservedShip && ObservedShip->Interior
        ? ObservedShip->Interior->ElevatorActor.Get() : nullptr;
    return Elevator && Elevator->MoveUp(ObservedCharacter);
}

bool UFrontierShipHUDWidget::ElevatorDown()
{
    AFrontierShipElevator* Elevator = ObservedShip && ObservedShip->Interior
        ? ObservedShip->Interior->ElevatorActor.Get() : nullptr;
    return Elevator && Elevator->MoveDown(ObservedCharacter);
}
