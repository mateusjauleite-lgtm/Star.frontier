#include "Worlds/Atmosphere/Core/AtmosphereClimateSubsystem.h"
#include "Worlds/Atmosphere/Core/AtmosphereClimateProfileDataAsset.h"
#include "Worlds/Atmosphere/Branches/AtmosphericLayer.h"
#include "Worlds/Atmosphere/Branches/AtmosphericComposition.h"

namespace
{
    constexpr double UniversalGasConstantJPerMolK = 8.31446261815324;
}

bool UAtmosphereClimateSubsystem::SetActiveProfile(UAtmosphereClimateProfileDataAsset* Profile)
{
    if (!IsValid(Profile) || !Profile->IsProfileValid())
    {
        return false;
    }

    ActiveProfile = Profile;
    return true;
}

const UAtmosphereClimateProfileDataAsset* UAtmosphereClimateSubsystem::GetActiveProfile() const
{
    return ActiveProfile;
}

bool UAtmosphereClimateSubsystem::SampleAtAltitude(
    const double AltitudeKm,
    FAtmosphericSample& OutSample) const
{
    OutSample = FAtmosphericSample();

    if (!IsValid(ActiveProfile) || !FMath::IsFinite(AltitudeKm))
    {
        return false;
    }

    const FAtmosphericLayerDefinition* Layer = ActiveProfile->FindLayerAtAltitude(AltitudeKm);
    if (Layer == nullptr)
    {
        return false;
    }

    const double AltitudeDeltaKm = AltitudeKm - Layer->ReferenceAltitudeKm;
    const double PressurePa = Layer->ReferencePressurePa
        * FMath::Exp(-AltitudeDeltaKm / Layer->PressureScaleHeightKm);
    const double TemperatureK = FMath::Max(
        1.0,
        Layer->ReferenceTemperatureK
            - Layer->TemperatureLapseRateKPerKm * AltitudeDeltaKm);
    const double MeanMolarMassKgPerMol =
        ActiveProfile->Composition.GetMeanMolarMassKgPerMol();

    if (PressurePa <= 0.0 || MeanMolarMassKgPerMol <= 0.0)
    {
        return false;
    }

    // Ideal-gas estimate. This is a baseline model, not a full weather simulation.
    const double DensityKgPerM3 =
        (PressurePa * MeanMolarMassKgPerMol)
        / (UniversalGasConstantJPerMolK * TemperatureK);

    OutSample.AltitudeKm = AltitudeKm;
    OutSample.PressurePa = PressurePa;
    OutSample.TemperatureK = TemperatureK;
    OutSample.DensityKgPerM3 = DensityKgPerM3;
    return true;
}
