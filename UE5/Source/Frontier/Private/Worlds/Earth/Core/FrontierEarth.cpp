#include "Worlds/Earth/Core/FrontierEarth.h"

#include "Components/SceneComponent.h"
#include "Worlds/Earth/Branches/FrontierEarthBranchComponent.h"
#include "Worlds/Planetary/Core/PlanetaryProfileDataAsset.h"
#include "Worlds/Atmosphere/Core/AtmosphereClimateProfileDataAsset.h"
#include "Worlds/Atmosphere/Core/AtmosphereClimateSubsystem.h"

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

    InteriorBranch->ConfigureBranch(FName(TEXT("interior")), {}, true);
    SurfaceBranch->ConfigureBranch(FName(TEXT("surface")), {}, true);
    TerrainBranch->ConfigureBranch(FName(TEXT("terrain")), { FName(TEXT("surface")) }, true);
    OceansBranch->ConfigureBranch(FName(TEXT("oceans")), { FName(TEXT("surface")) }, true);
    AtmosphereBranch->ConfigureBranch(FName(TEXT("atmosphere")), {}, true);
    CloudsBranch->ConfigureBranch(FName(TEXT("clouds")), { FName(TEXT("atmosphere")) }, true);
    LightingBranch->ConfigureBranch(FName(TEXT("lighting")), { FName(TEXT("atmosphere")) }, true);

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
    for (UFrontierEarthBranchComponent* Branch : BranchesInDependencyOrder)
    {
        if (IsValid(Branch))
        {
            Branch->DeinitializeBranch();
        }
    }

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
            for (UFrontierEarthBranchComponent* InitializedBranch : BranchesInDependencyOrder)
            {
                if (IsValid(InitializedBranch))
                {
                    InitializedBranch->DeinitializeBranch();
                }
            }
            return false;
        }

        InitializedBranchIds.Add(Branch->GetBranchId());
    }

    // The current Atmosphere & Climate runtime is world-scoped. Earth supplies
    // its validated profile after branch validation; multi-planet worlds will need per-body runtime state.
    UAtmosphereClimateSubsystem* AtmosphereSubsystem =
        GetWorld() ? GetWorld()->GetSubsystem<UAtmosphereClimateSubsystem>() : nullptr;
    if (!IsValid(AtmosphereSubsystem)
        || !AtmosphereSubsystem->SetActiveProfile(AtmosphereProfile))
    {
        UE_LOG(LogFrontierEarth, Error,
            TEXT("Earth could not activate its linked Atmosphere & Climate profile."));
        for (UFrontierEarthBranchComponent* Branch : BranchesInDependencyOrder)
        {
            if (IsValid(Branch))
            {
                Branch->DeinitializeBranch();
            }
        }
        return false;
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
