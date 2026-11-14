#include "Worlds/Earth/Branches/FrontierEarthBranchComponent.h"

UFrontierEarthBranchComponent::UFrontierEarthBranchComponent()
{
    PrimaryComponentTick.bCanEverTick = false;
}

void UFrontierEarthBranchComponent::ConfigureBranch(
    const FName InBranchId,
    const TArray<FName>& InDependencies,
    const bool bInEnabledByDefault)
{
    BranchId = InBranchId;
    Dependencies = InDependencies;
    bEnabledByDefault = bInEnabledByDefault;
}

bool UFrontierEarthBranchComponent::InitializeBranch(
    const TArray<FName>& InitializedBranchIds)
{
    if (BranchId.IsNone() || !bEnabledByDefault)
    {
        return false;
    }

    for (const FName Dependency : Dependencies)
    {
        if (!InitializedBranchIds.Contains(Dependency))
        {
            return false;
        }
    }

    bInitialized = true;
    return true;
}

void UFrontierEarthBranchComponent::DeinitializeBranch()
{
    bInitialized = false;
}
