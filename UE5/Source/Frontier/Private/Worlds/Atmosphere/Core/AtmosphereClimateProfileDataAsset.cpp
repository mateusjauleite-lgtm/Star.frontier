#include "Worlds/Atmosphere/Core/AtmosphereClimateProfileDataAsset.h"
#include "Worlds/Planetary/Core/PlanetaryProfileDataAsset.h"

bool UAtmosphereClimateProfileDataAsset::IsProfileValid() const
{
    if (!IsValid(PlanetaryProfile)
        || !PlanetaryProfile->IsProfileValid()
        || !Composition.IsValidComposition()
        || Layers.IsEmpty()
        || !ClimateBaseline.IsValidState())
    {
        return false;
    }

    for (const FAtmosphericLayerDefinition& Layer : Layers)
    {
        if (!Layer.IsValidLayer())
        {
            return false;
        }
    }

    return true;
}

const FAtmosphericLayerDefinition* UAtmosphereClimateProfileDataAsset::FindLayerAtAltitude(
    const double AltitudeKm) const
{
    for (const FAtmosphericLayerDefinition& Layer : Layers)
    {
        if (AltitudeKm >= Layer.MinAltitudeKm && AltitudeKm <= Layer.MaxAltitudeKm)
        {
            return &Layer;
        }
    }

    return nullptr;
}
