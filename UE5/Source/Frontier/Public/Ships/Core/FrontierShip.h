#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "FrontierShip.generated.h"

class USceneComponent;
class UBoxComponent;
class UFrontierShipControlsComponent;
class UFrontierShipEngineComponent;
class UFrontierShipEngineFXComponent;
class UFrontierShipInteriorComponent;
class UFrontierShipComputerComponent;
class UFrontierShipCameraBoom;
class UFrontierShipExplorationHullComponent;
class AFrontierCharacter;
class UFrontierShipHUDWidget;

USTRUCT(BlueprintType)
struct FRONTIER_API FFrontierShipIdentity
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FName ShipId = TEXT("aurora-7");

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FName CommanderId = NAME_None;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FText DisplayName = FText::FromString(TEXT("Nave de exploração"));
};

USTRUCT(BlueprintType)
struct FRONTIER_API FFrontierShipFlightState
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly)
    float Throttle = 0.0f;

    UPROPERTY(BlueprintReadOnly)
    float PitchInput = 0.0f;

    UPROPERTY(BlueprintReadOnly)
    float YawInput = 0.0f;

    UPROPERTY(BlueprintReadOnly)
    float SpeedCmPerSecond = 0.0f;

    UPROPERTY(BlueprintReadOnly)
    bool bBraking = false;

    UPROPERTY(BlueprintReadOnly)
    bool bBoosting = false;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FFrontierShipIdentityChanged, FName, ShipId, FName, CommanderId);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FFrontierShipFlightStateChanged, const FFrontierShipFlightState&, State);

UCLASS(Blueprintable)
class FRONTIER_API AFrontierShip : public AActor
{
    GENERATED_BODY()

public:
    AFrontierShip();

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Ship|Collision")
    TObjectPtr<UBoxComponent> CollisionRoot;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Ship|Collision")
    FVector CollisionHalfExtent = FVector(10000.0f, 3000.0f, 1600.0f);

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Ship|Core")
    TObjectPtr<USceneComponent> ShipRoot;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Ship|Identity")
    FFrontierShipIdentity Identity;

    UPROPERTY(BlueprintReadOnly, Category="Ship|Flight")
    FFrontierShipFlightState FlightState;

    UPROPERTY(BlueprintAssignable, Category="Ship|Identity")
    FFrontierShipIdentityChanged OnIdentityChanged;

    UPROPERTY(BlueprintAssignable, Category="Ship|Flight")
    FFrontierShipFlightStateChanged OnFlightStateChanged;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Ship|Controls")
    TObjectPtr<UFrontierShipControlsComponent> Controls;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Ship|Engines")
    TObjectPtr<UFrontierShipEngineComponent> Engines;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Ship|Engine FX")
    TObjectPtr<UFrontierShipEngineFXComponent> EnginesFX;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Ship|Interior")
    TObjectPtr<UFrontierShipInteriorComponent> Interior;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Ship|Exploration")
    TObjectPtr<UFrontierShipExplorationHullComponent> ExplorationHull;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Ship|Camera")
    TObjectPtr<UFrontierShipCameraBoom> ShipCamera;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Ship|Computer")
    TObjectPtr<UFrontierShipComputerComponent> Computer;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Ship|HUD")
    TSubclassOf<UFrontierShipHUDWidget> ShipHUDClass;

    UPROPERTY(Transient, BlueprintReadOnly, Category="Ship|HUD")
    TObjectPtr<UFrontierShipHUDWidget> ShipHUD;

    UFUNCTION(BlueprintPure, Category="Ship|Coordinates")
    static FVector ThreeToUnrealLocalPosition(const FVector& ThreePosition);

    UFUNCTION(BlueprintCallable, Category="Ship|Identity")
    void AssignCommander(FName NewCommanderId);

    UFUNCTION(BlueprintCallable, Category="Ship|Interior")
    bool PlaceCharacterOnDeck(AFrontierCharacter* Character, FName DeckCode);

    UFUNCTION(BlueprintCallable, Category="Ship|Bridge")
    void BeginPiloting(AFrontierCharacter* Character, FName NewCommanderId);

    UFUNCTION(BlueprintCallable, Category="Ship|Bridge")
    void EndPiloting();

    UFUNCTION(BlueprintCallable, Category="Ship|Bridge")
    bool RequestPilotExit(AActor* RequestingActor);

    UFUNCTION(BlueprintPure, Category="Ship|Bridge")
    bool IsPiloted() const { return ActivePilot.IsValid(); }

    UFUNCTION(BlueprintCallable, Category="Ship|Flight")
    void SetFlightInputs(float NewThrottle, float NewPitch, float NewYaw, bool bNewBraking, bool bNewBoosting);

    UFUNCTION(BlueprintCallable, Category="Ship|Flight")
    void ClearFlightInputs();

protected:
    virtual void OnConstruction(const FTransform& Transform) override;
    virtual void Tick(float DeltaSeconds) override;

private:
    TWeakObjectPtr<AFrontierCharacter> ActivePilot;
    float TravelDirectionSign = 1.0f;

    UPROPERTY(EditDefaultsOnly, Category="Ship|Flight")
    float YawRateDegrees = 32.0f;

    UPROPERTY(EditDefaultsOnly, Category="Ship|Flight")
    float PitchRateDegrees = 24.0f;
};
