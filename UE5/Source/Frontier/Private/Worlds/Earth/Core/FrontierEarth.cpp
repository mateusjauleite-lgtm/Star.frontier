#include "Worlds/Earth/Core/FrontierEarth.h"

#include "Components/SceneComponent.h"
#include "Worlds/Earth/Branches/FrontierEarthBranchComponent.h"
#include "Worlds/Planetary/Core/PlanetaryProfileDataAsset.h"
#include "Worlds/Atmosphere/Core/AtmosphereClimateProfileDataAsset.h"

DEFINE_LOG_CATEGORY_STATIC(LogFrontierEarth, Log, All);

AFrontierEarth::AFrontierEarth()
{
    PrimaryActorTick.bCanEverTick = false;

    SceneRoot = CreateDefaultSubobject<USceneComponent>(TEXT("EarthRoot"));
    SetRootComponent(SceneRoot);

    InteriorBranch = CreateDefaultSubobject<UFrontierEarthBranchComponent>(TEXT("InteriorBranch"));
    SurfaceBranch = CreateDefaultSubobject<UFrontierEarthBranchComponent>(TEXT("SurfaceBranch"));
    TerrainBranch = CreateDefaultSubobject<UFrontierEarthBranchComponent>(TEXT("TerrainBranch"));
    OceansBranch = CreateDefaultSubobject<UFrontierEarthBranchComponent>(TEXT("OceansBranch"));
    AtmosphereBranch = CreateDefaultSubobject<UFrontierEarthBranchComponent>(TEXT("AtmosphereBranch"));
    CloudsBranch = CreateDefaultSubobject<UFrontierEarthBranchComponent>(TEXT("CloudsBranch"));
    LightingBranch = CreateDefaultSubobject<UFrontierEarthBranchComponent>(TEXT("LightingBranch"));

    InteriorBranch->ConfigureBranch(TEXT("interior"), {}, true);
    SurfaceBranch->ConfigureBranch(TEXT("surface"), {}, true);
    TerrainBranch->ConfigureBranch(TEXT("terrain"), { TEXT("surface") }, true);
    OceansBranch->ConfigureBranch(TEXT("oceans"), { TEXT("surface") }, true);
    AtmosphereBranch->ConfigureBranch(TEXT("atmosphere"), {}, true);
    CloudsBranch->ConfigureBranch(TEXT("clouds"), { TEXT("atmosphere") }, true);
    LightingBranch->ConfigureBranch(TEXT("lighting"), { TEXT("atmosphere") }, true);

    // Keep the same dependency-safe order as src/world/earth/modules/index.js.
    BranchesInDependencyOrder = {
        InteriorBranch, SurfaceBranch, TerrainBranch, OceansBranch,
        AtmosphereBranch, CloudsBranch, LightingBranch
    };
}

void AFrontierEarth::BeginPlay()
{
    Super::BeginPlay();
    InitializeEarth();
}

void AFrontierEarth::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    for (int32 Index = BranchesInDependencyOrder.Num() - 1; Index >= 0; --Index)
    {
        if (IsValid(BranchesInDependencyOrder[Index]))
        {
            BranchesInDependencyOrder[Index]->DeinitializeBranch();
        }
    }

    bEarthReady = false;
    Super::EndPlay(EndPlayReason);
}

bool AFrontierEarth::InitializeEarth()
{
    bEarthReady = false;

    if (!IsValid(PlanetaryProfile) || !PlanetaryProfile->IsProfileValid())
    {
        UE_LOG(LogFrontierEarth, Error,
            TEXT("Earth initialization requires a valid UPlanetaryProfileDataAsset."));
        return false;
    }

    if (PlanetaryProfile->Identity.BodyId != FName(TEXT("earth")))
    {
        UE_LOG(LogFrontierEarth, Error,
            TEXT("AFrontierEarth requires a planetary profile with BodyId 'earth'."));
        return false;
    }

    if (!IsValid(AtmosphereProfile) || !AtmosphereProfile->IsProfileValid())
    {
        UE_LOG(LogFrontierEarth, Error,
            TEXT("Earth initialization requires a valid UAtmosphereClimateProfileDataAsset."));
        return false;
    }

    if (AtmosphereProfile->PlanetaryProfile != PlanetaryProfile)
    {
        UE_LOG(LogFrontierEarth, Error,
            TEXT("Earth and atmosphere profiles must reference the same planetary profile asset."));
        return false;
    }

    TArray<FName> InitializedBranchIds;
    for (UFrontierEarthBranchComponent* Branch : BranchesInDependencyOrder)
    {
        if (!IsValid(Branch))
        {
            UE_LOG(LogFrontierEarth, Error, TEXT("Earth contains an invalid branch component."));
            return false;
        }

        if (!Branch->IsEnabledByDefault())
        {
            continue;
        }

        if (!Branch->InitializeBranch(InitializedBranchIds))
        {
            UE_LOG(LogFrontierEarth, Error,
                TEXT("Earth branch '%s' could not initialize; check its declared dependencies."),
                *Branch->GetBranchId().ToString());
            return false;
        }

        InitializedBranchIds.Add(Branch->GetBranchId());
    }

    bEarthReady = true;
    UE_LOG(LogFrontierEarth, Log,
        TEXT("Earth Core initialized with %d active branches. Visual radius: %.3f units."),
        InitializedBranchIds.Num(), VisualRadiusUnits);
    return true;
}

double AFrontierEarth::GetVisualUnitsPerKilometre() const
{
    if (!IsValid(PlanetaryProfile)
        || PlanetaryProfile->Dimensions.MeanRadiusKm <= 0.0
        || VisualRadiusUnits <= 0.0)
    {
        return 0.0;
    }

    return VisualRadiusUnits / PlanetaryProfile->Dimensions.MeanRadiusKm;
}
