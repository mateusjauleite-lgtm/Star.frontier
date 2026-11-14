#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "FrontierShipInteriorComponent.generated.h"

class AFrontierShipDeckModule;
class AFrontierShipElevator;
class AFrontierPilotStation;
class UFrontierShipDeckDefinition;

UCLASS(ClassGroup=(Frontier), BlueprintType, Blueprintable, meta=(BlueprintSpawnableComponent))
class FRONTIER_API UFrontierShipInteriorComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Ship|Interior")
    TArray<TObjectPtr<UFrontierShipDeckDefinition>> DeckDefinitions;

    UPROPERTY(EditInstanceOnly, BlueprintReadOnly, Category="Ship|Interior")
    TArray<TObjectPtr<AFrontierShipDeckModule>> DeckModules;

    UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category="Ship|Interior")
    TObjectPtr<AFrontierShipElevator> ElevatorActor;

    UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category="Ship|Bridge")
    TObjectPtr<AFrontierPilotStation> PilotStationActor;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Ship|Interior")
    bool bBuildMissingDeckModulesOnBeginPlay = true;

    UFUNCTION(BlueprintCallable, Category="Ship|Interior")
    AFrontierShipDeckModule* FindDeck(FName DeckCode) const;

    UFUNCTION(BlueprintCallable, Category="Ship|Interior")
    int32 BuildMissingDeckModules();

    UFUNCTION(BlueprintCallable, Category="Ship|Interior")
    AFrontierShipElevator* EnsureElevator();

    UFUNCTION(BlueprintCallable, Category="Ship|Bridge")
    AFrontierPilotStation* EnsurePilotStation();

protected:
    virtual void BeginPlay() override;
};
