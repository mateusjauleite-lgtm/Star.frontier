#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "FrontierShipDeckDefinition.generated.h"

class UStaticMesh;

UENUM(BlueprintType)
enum class EFrontierShipDeckId : uint8
{
    Deck1_Command,
    Deck2_OperationsScience,
    Deck3_Engineering,
    Deck4_HangarSupport
};

UCLASS(BlueprintType)
class FRONTIER_API UFrontierShipDeckDefinition : public UDataAsset
{
    GENERATED_BODY()

public:
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Ship|Deck")
    EFrontierShipDeckId DeckId = EFrontierShipDeckId::Deck1_Command;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Ship|Deck")
    FName DeckCode = TEXT("D1");

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Ship|Deck")
    FText DisplayName;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Ship|Deck")
    TObjectPtr<UStaticMesh> FloorMesh;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Ship|Deck")
    TArray<TObjectPtr<UStaticMesh>> WallSegments;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Ship|Deck")
    FVector LocalOffset = FVector::ZeroVector;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Ship|Deck")
    bool bKeepHangarExitClear = false;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Ship|Deck")
    bool bKeepElevatorAccessClear = false;
};
