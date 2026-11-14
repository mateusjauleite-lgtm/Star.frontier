#pragma once

#include "CoreMinimal.h"
#include "PlanetaryBodyIdentity.generated.h"

UENUM(BlueprintType)
enum class EPlanetaryBodyKind : uint8
{
    Unknown,
    Star,
    Terrestrial,
    GasGiant,
    IceGiant,
    DwarfPlanet,
    NaturalSatellite
};

USTRUCT(BlueprintType)
struct FRONTIER_API FPlanetaryBodyIdentity
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Planetary|Identity")
    FName BodyId = NAME_None;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Planetary|Identity")
    FText DisplayName;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Planetary|Identity")
    EPlanetaryBodyKind Kind = EPlanetaryBodyKind::Unknown;
};
