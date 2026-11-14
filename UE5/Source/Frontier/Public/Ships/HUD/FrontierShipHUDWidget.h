#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "Ships/Core/FrontierShip.h"
#include "FrontierShipHUDWidget.generated.h"

class AFrontierCharacter;

UCLASS(Abstract, Blueprintable)
class FRONTIER_API UFrontierShipHUDWidget : public UUserWidget
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category="Ship|HUD")
    void ObserveShip(AFrontierShip* Ship, AFrontierCharacter* Character);

    UFUNCTION(BlueprintCallable, Category="Ship|HUD|Controls")
    void SetThrottleInput(float Value);

    UFUNCTION(BlueprintCallable, Category="Ship|HUD|Controls")
    void SetSteeringInput(float Yaw, float Pitch);

    UFUNCTION(BlueprintCallable, Category="Ship|HUD|Controls")
    void SetBrake(bool bPressed);

    UFUNCTION(BlueprintCallable, Category="Ship|HUD|Controls")
    void SetBoost(bool bPressed);

    UFUNCTION(BlueprintCallable, Category="Ship|HUD|Controls")
    void ClearFlightInput();

    UFUNCTION(BlueprintCallable, Category="Ship|HUD|Controls")
    void ExitPilotSeat();

    UFUNCTION(BlueprintCallable, Category="Ship|HUD|Elevator")
    bool ElevatorUp();

    UFUNCTION(BlueprintCallable, Category="Ship|HUD|Elevator")
    bool ElevatorDown();

    UFUNCTION(BlueprintImplementableEvent, Category="Ship|HUD")
    void RefreshShipHUD(const FFrontierShipFlightState& FlightState, FText ShipName, bool bVisible);

protected:
    UPROPERTY(BlueprintReadOnly, Category="Ship|HUD")
    TObjectPtr<AFrontierShip> ObservedShip;

    UPROPERTY(BlueprintReadOnly, Category="Ship|HUD")
    TObjectPtr<AFrontierCharacter> ObservedCharacter;

    UFUNCTION()
    void HandleFlightStateChanged(const FFrontierShipFlightState& State);
};
