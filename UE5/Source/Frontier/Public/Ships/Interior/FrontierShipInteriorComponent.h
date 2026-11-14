#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "FrontierShipInteriorComponent.generated.h"

class AFrontierShipDeckModule;
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

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Ship|Interior")
    bool bBuildMissingDeckModulesOnBeginPlay = true;

    UFUNCTION(BlueprintCallable, Category="Ship|Interior")
    AFrontierShipDeckModule* FindDeck(FName DeckCode) const;

    UFUNCTION(BlueprintCallable, Category="Ship|Interior")
    int32 BuildMissingDeckModules();

protected:
    virtual void BeginPlay() override;
};
