#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "FrontierShipDeckModule.generated.h"

class UFrontierShipDeckDefinition;
class USceneComponent;
class UStaticMeshComponent;

UCLASS(Blueprintable)
class FRONTIER_API AFrontierShipDeckModule : public AActor
{
    GENERATED_BODY()

public:
    AFrontierShipDeckModule();

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Ship|Deck")
    TObjectPtr<USceneComponent> DeckRoot;

    UPROPERTY(EditInstanceOnly, BlueprintReadOnly, Category="Ship|Deck")
    TObjectPtr<UFrontierShipDeckDefinition> Definition;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Ship|Deck")
    TArray<TObjectPtr<UStaticMeshComponent>> WallComponents;

    UFUNCTION(BlueprintCallable, Category="Ship|Deck")
    void RebuildFromDefinition();
};
