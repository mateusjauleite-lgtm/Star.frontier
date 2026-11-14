#include "Ships/Exploration/FrontierShipExplorationHullComponent.h"
#include "Ships/Exploration/FrontierShipExplorationProfile.h"
#include "Components/StaticMeshComponent.h"

void UFrontierShipExplorationHullComponent::OnRegister()
{
    Super::OnRegister();
    RebuildHull();
}

void UFrontierShipExplorationHullComponent::ClearGeneratedParts()
{
    for (UStaticMeshComponent* Part : GeneratedParts)
        if (Part) Part->DestroyComponent();
    GeneratedParts.Reset();
}

void UFrontierShipExplorationHullComponent::RebuildHull()
{
    ClearGeneratedParts();
    if (!Profile || !GetOwner()) return;

    auto AddParts = [this](const TArray<FFrontierShipVisualPart>& Parts, const TCHAR* Prefix)
    {
        for (const FFrontierShipVisualPart& Part : Parts)
        {
            if (!Part.Mesh) continue;
            const FName ComponentName(*FString::Printf(
                TEXT("%s_%s"), Prefix, *Part.PartId.ToString()));
            UStaticMeshComponent* MeshComponent = NewObject<UStaticMeshComponent>(
                GetOwner(), ComponentName);
            MeshComponent->SetupAttachment(this);
            MeshComponent->SetStaticMesh(Part.Mesh);
            MeshComponent->SetRelativeTransform(Part.RelativeTransform);
            MeshComponent->SetCastShadow(Part.bCastShadows);
            MeshComponent->SetCollisionEnabled(
                Part.bCollisionEnabled ? ECollisionEnabled::QueryAndPhysics : ECollisionEnabled::NoCollision);
            MeshComponent->RegisterComponent();
            GeneratedParts.Add(MeshComponent);
        }
    };

    AddParts(Profile->HullParts, TEXT("Hull"));
    AddParts(Profile->NacelleParts, TEXT("Nacelle"));
    AddParts(Profile->EngineParts, TEXT("Engine"));
}
