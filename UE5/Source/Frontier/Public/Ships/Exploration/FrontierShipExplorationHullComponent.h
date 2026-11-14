#pragma once

#include "CoreMinimal.h"
#include "Components/SceneComponent.h"
#include "FrontierShipExplorationHullComponent.generated.h"

class UFrontierShipExplorationProfile;
class UStaticMeshComponent;

UCLASS(ClassGroup=(Frontier), BlueprintType, Blueprintable, meta=(BlueprintSpawnableComponent))
class FRONTIER_API UFrontierShipExplorationHullComponent : public USceneComponent
{
    GENERATED_BODY()

public:
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Ship|Exploration")
    TObjectPtr<UFrontierShipExplorationProfile> Profile;

    UFUNCTION(BlueprintCallable, Category="Ship|Exploration")
    void RebuildHull();

protected:
    virtual void OnRegister() override;

private:
    UPROPERTY(Transient)
    TArray<TObjectPtr<UStaticMeshComponent>> GeneratedParts;

    void ClearGeneratedParts();
};
