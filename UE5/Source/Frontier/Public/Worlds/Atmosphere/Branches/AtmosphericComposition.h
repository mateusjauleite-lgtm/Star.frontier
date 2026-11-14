#pragma once

#include "CoreMinimal.h"
#include "AtmosphericComposition.generated.h"

USTRUCT(BlueprintType)
struct FRONTIER_API FAtmosphericGasComponent
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Atmosphere|Composition")
    FName GasId = NAME_None;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Atmosphere|Composition", meta=(ClampMin="0.0", ClampMax="1.0"))
    double VolumeFraction = 0.0;

    // Molecular mass in kilograms per mole (for example, dry air ~= 0.028965).
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Atmosphere|Composition", meta=(ClampMin="0.000001"))
    double MolarMassKgPerMol = 0.028965;
};

USTRUCT(BlueprintType)
struct FRONTIER_API FAtmosphericComposition
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Atmosphere|Composition")
    TArray<FAtmosphericGasComponent> Components;

    double GetMeanMolarMassKgPerMol() const;

    bool IsValidComposition() const;
};
