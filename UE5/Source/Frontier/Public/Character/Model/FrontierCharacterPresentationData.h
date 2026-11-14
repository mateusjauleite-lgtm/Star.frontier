#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "FrontierCharacterPresentationData.generated.h"

class USkeletalMesh;
class UAnimInstance;
class UMaterialInterface;

UCLASS(BlueprintType)
class FRONTIER_API UFrontierCharacterPresentationData : public UDataAsset
{
    GENERATED_BODY()

public:
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Character|Model")
    TObjectPtr<USkeletalMesh> ExplorationSuitMesh;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Character|Animation")
    TSubclassOf<UAnimInstance> AnimationClass;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Character|Model")
    TArray<TObjectPtr<UMaterialInterface>> SuitMaterials;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Character|Model", meta=(ClampMin="140.0", ClampMax="220.0"))
    float CapsuleHalfHeightCm = 90.0f;
};
