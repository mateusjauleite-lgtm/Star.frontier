#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "FrontierShipInteriorComponent.generated.h"

class AFrontierShipDeckModule;

UCLASS(ClassGroup=(Frontier), BlueprintType, Blueprintable, meta=(BlueprintSpawnableComponent))
class FRONTIER_API UFrontierShipInteriorComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UPROPERTY(EditInstanceOnly, BlueprintReadOnly, Category="Ship|Interior")
    TArray<TObjectPtr<AFrontierShipDeckModule>> DeckModules;

    UFUNCTION(BlueprintCallable, Category="Ship|Interior")
    AFrontierShipDeckModule* FindDeck(FName DeckCode) const;
};
