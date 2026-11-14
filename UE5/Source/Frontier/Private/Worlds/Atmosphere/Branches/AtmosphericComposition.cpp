#include "Worlds/Atmosphere/Branches/AtmosphericComposition.h"

double FAtmosphericComposition::GetMeanMolarMassKgPerMol() const
{
    double WeightedMolarMass = 0.0;
    double TotalFraction = 0.0;

    for (const FAtmosphericGasComponent& Component : Components)
    {
        if (Component.VolumeFraction <= 0.0 || Component.MolarMassKgPerMol <= 0.0)
        {
            continue;
        }

        WeightedMolarMass += Component.VolumeFraction * Component.MolarMassKgPerMol;
        TotalFraction += Component.VolumeFraction;
    }

    return TotalFraction > UE_DOUBLE_SMALL_NUMBER
        ? WeightedMolarMass / TotalFraction
        : 0.0;
}

bool FAtmosphericComposition::IsValidComposition() const
{
    if (Components.IsEmpty())
    {
        return false;
    }

    double TotalFraction = 0.0;
    for (const FAtmosphericGasComponent& Component : Components)
    {
        if (Component.GasId.IsNone()
            || Component.VolumeFraction < 0.0
            || Component.MolarMassKgPerMol <= 0.0)
        {
            return false;
        }

        TotalFraction += Component.VolumeFraction;
    }

    return FMath::IsNearlyEqual(TotalFraction, 1.0, 0.01);
}
