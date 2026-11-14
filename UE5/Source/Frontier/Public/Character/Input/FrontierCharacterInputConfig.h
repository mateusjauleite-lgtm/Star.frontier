#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "FrontierCharacterInputConfig.generated.h"

class UInputMappingContext;
class UInputAction;

UCLASS(BlueprintType)
class FRONTIER_API UFrontierCharacterInputConfig : public UDataAsset
{
    GENERATED_BODY()

public:
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Character|Input")
    TObjectPtr<UInputMappingContext> MappingContext;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Character|Input")
    TObjectPtr<UInputAction> Move;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Character|Input")
    TObjectPtr<UInputAction> Look;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Character|Input")
    TObjectPtr<UInputAction> Jump;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Character|Input")
    TObjectPtr<UInputAction> Interact;
};
