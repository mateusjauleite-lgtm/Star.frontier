#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "FrontierShipDeckDefinition.generated.h"

class UStaticMesh;

USTRUCT(BlueprintType)
struct FRONTIER_API FFrontierShipDeckPiece
{
    GENERATED_BODY()

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly)
    TObjectPtr<UStaticMesh> Mesh;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly)
    FTransform RelativeTransform = FTransform::Identity;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly)
    bool bCollisionEnabled = true;
};

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
    TArray<FFrontierShipDeckPiece> WallSegments;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Ship|Deck")
    FVector LocalOffset = FVector::ZeroVector;

    // Source layout is retained in legacy Three.js coordinates (metres).
    // Deck modules convert it to UE5 X-forward, Z-up centimetres at runtime.
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Ship|Deck|Layout")
    FVector LegacyThreePosition = FVector(0.0f, 8.7f, -2.0f);

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Ship|Deck|Layout")
    float FloorWidthMeters = 50.0f;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Ship|Deck|Layout")
    float FloorLengthMeters = 82.0f;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Ship|Deck|Layout")
    float FloorThicknessMeters = 0.42f;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Ship|Deck|Layout")
    bool bGenerateDefaultFloor = true;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Ship|Deck")
    bool bKeepHangarExitClear = false;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Ship|Deck")
    bool bKeepElevatorAccessClear = false;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Ship|Deck|Clearance")
    FBox HangarExitClearance = FBox(ForceInit);

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Ship|Deck|Clearance")
    FBox ElevatorAccessClearance = FBox(ForceInit);
};
