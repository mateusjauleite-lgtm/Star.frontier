#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "FrontierShipExplorationProfile.generated.h"

class UStaticMesh;

USTRUCT(BlueprintType)
struct FRONTIER_API FFrontierShipVisualPart
{
    GENERATED_BODY()

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly)
    FName PartId;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly)
    TObjectPtr<UStaticMesh> Mesh;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly)
    FTransform RelativeTransform = FTransform::Identity;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly)
    bool bCastShadows = true;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly)
    bool bCollisionEnabled = true;
};

UCLASS(BlueprintType)
class FRONTIER_API UFrontierShipExplorationProfile : public UDataAsset
{
    GENERATED_BODY()

public:
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Ship|Exploration")
    TArray<FFrontierShipVisualPart> HullParts;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Ship|Exploration")
    TArray<FFrontierShipVisualPart> NacelleParts;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Ship|Exploration")
    TArray<FFrontierShipVisualPart> EngineParts;
};
