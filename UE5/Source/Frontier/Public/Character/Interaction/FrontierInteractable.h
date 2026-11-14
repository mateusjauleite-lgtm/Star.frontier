#pragma once

#include "CoreMinimal.h"
#include "UObject/Interface.h"
#include "FrontierInteractable.generated.h"

UINTERFACE(BlueprintType)
class FRONTIER_API UFrontierInteractable : public UInterface
{
    GENERATED_BODY()
};

class FRONTIER_API IFrontierInteractable
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category="Character|Interaction")
    FText GetInteractionLabel() const;

    UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category="Character|Interaction")
    bool CanBeInteractedWith(AActor* InteractingActor) const;

    UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category="Character|Interaction")
    void Interact(AActor* InteractingActor);
};
