#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "Input/Reply.h"
#include "Ships/Core/FrontierShip.h"
#include "FrontierShipHUDWidget.generated.h"

class AFrontierCharacter;
class UCanvasPanel;

UCLASS(Blueprintable)
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

    UFUNCTION(BlueprintImplementableEvent, Category="Ship|HUD")
    void RefreshShipHUD(const FFrontierShipFlightState& FlightState, FText ShipName, bool bVisible);

protected:
    virtual void NativeConstruct() override;
    virtual FReply NativeOnTouchStarted(const FGeometry& Geometry, const FPointerEvent& Event) override;
    virtual FReply NativeOnTouchMoved(const FGeometry& Geometry, const FPointerEvent& Event) override;
    virtual FReply NativeOnTouchEnded(const FGeometry& Geometry, const FPointerEvent& Event) override;

    UPROPERTY(BlueprintReadOnly, Category="Ship|HUD")
    TObjectPtr<AFrontierShip> ObservedShip;
    UPROPERTY(BlueprintReadOnly, Category="Ship|HUD")
    TObjectPtr<AFrontierCharacter> ObservedCharacter;

    UFUNCTION()
    void HandleFlightStateChanged(const FFrontierShipFlightState& State);
    UFUNCTION()
    void OnBoostPressed();
    UFUNCTION()
    void OnBoostReleased();
    UFUNCTION()
    void OnBrakePressed();
    UFUNCTION()
    void OnBrakeReleased();
    UFUNCTION()
    void OnExitPressed();

private:
    void BuildNativeLayout();
    TMap<int32, FVector2D> TouchOrigins;
    TSet<int32> ThrottlePointers;
    TSet<int32> SteeringPointers;
};
