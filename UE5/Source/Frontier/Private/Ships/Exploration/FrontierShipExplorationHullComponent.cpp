#include "Ships/Exploration/FrontierShipExplorationHullComponent.h"
#include "Ships/Exploration/FrontierShipExplorationProfile.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"

namespace
{
    const FVector ToUnrealPosition(const FVector& Legacy)
    {
        return FVector(-Legacy.Z, Legacy.X, Legacy.Y) * 100.0f;
    }

    UStaticMesh* LoadBasicMesh(const TCHAR* AssetPath)
    {
        return LoadObject<UStaticMesh>(nullptr, AssetPath);
    }
}

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
    if (!GetOwner()) return;

    auto AddPart = [this](const TCHAR* Name, UStaticMesh* Mesh, const FVector& LegacyPosition,
        const FVector& Scale, const FRotator& Rotation = FRotator::ZeroRotator, bool bCollision = false)
    {
        if (!Mesh) return static_cast<UStaticMeshComponent*>(nullptr);

        UStaticMeshComponent* Component = NewObject<UStaticMeshComponent>(
            GetOwner(), MakeUniqueObjectName(GetOwner(), UStaticMeshComponent::StaticClass(), FName(Name)));
        Component->SetupAttachment(this);
        Component->SetStaticMesh(Mesh);
        Component->SetRelativeLocation(ToUnrealPosition(LegacyPosition));
        Component->SetRelativeRotation(Rotation);
        Component->SetRelativeScale3D(Scale);
        Component->SetCollisionEnabled(bCollision ? ECollisionEnabled::QueryAndPhysics : ECollisionEnabled::NoCollision);
        Component->SetCastShadow(true);
        Component->RegisterComponent();
        GeneratedParts.Add(Component);
        return Component;
    };

    if (Profile)
    {
        auto AddProfileParts = [this](const TArray<FFrontierShipVisualPart>& Parts, const TCHAR* Prefix)
        {
            for (const FFrontierShipVisualPart& Part : Parts)
            {
                if (!Part.Mesh) continue;
                const FName ComponentName(*FString::Printf(TEXT("%s_%s"), Prefix, *Part.PartId.ToString()));
                UStaticMeshComponent* MeshComponent = NewObject<UStaticMeshComponent>(GetOwner(), ComponentName);
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

        AddProfileParts(Profile->HullParts, TEXT("Hull"));
        AddProfileParts(Profile->NacelleParts, TEXT("Nacelle"));
        AddProfileParts(Profile->EngineParts, TEXT("Engine"));
        if (GeneratedParts.Num() > 0) return;
    }

    // Native fallback port of src/ships/exploration.js.
    // It uses UE's built-in primitive meshes until the authored ship meshes are imported.
    UStaticMesh* Sphere = LoadBasicMesh(TEXT("/Engine/BasicShapes/Sphere.Sphere"));
    UStaticMesh* Cube = LoadBasicMesh(TEXT("/Engine/BasicShapes/Cube.Cube"));
    UStaticMesh* Cylinder = LoadBasicMesh(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
    if (!Sphere || !Cube || !Cylinder) return;

    // Saucer hull: original Three.js ellipsoid 27.2 x 15.2 x 50 metres.
    AddPart(TEXT("ExplorationSaucerHull"), Sphere, FVector::ZeroVector, FVector(54.4f, 30.4f, 100.0f));

    // Secondary engineering shell and integrated aft pod.
    AddPart(TEXT("EngineeringSecondaryHull"), Sphere, FVector(0.0f, -10.2f, 18.0f), FVector(23.0f, 9.6f, 50.0f));
    AddPart(TEXT("IntegratedAftEngineeringPod"), Sphere, FVector(0.0f, -7.2f, 39.0f), FVector(18.4f, 8.4f, 30.0f));

    // The two nacelles retain their source separation and longitudinal placement.
    for (const float Side : {-1.0f, 1.0f})
    {
        const FVector NacelleCenter(Side * 12.2f, 0.1f, 61.5f);
        AddPart(Side < 0 ? TEXT("PortNacelleBody") : TEXT("StarboardNacelleBody"),
            Cylinder, NacelleCenter, FVector(6.7f, 6.7f, 75.0f), FRotator(0.0f, 90.0f, 0.0f));

        AddPart(Side < 0 ? TEXT("PortNacelleForwardCap") : TEXT("StarboardNacelleForwardCap"),
            Sphere, FVector(Side * 12.2f, 0.1f, 24.8f), FVector(6.4f, 6.4f, 2.2f));
        AddPart(Side < 0 ? TEXT("PortBussard") : TEXT("StarboardBussard"),
            Sphere, FVector(Side * 12.2f, 0.1f, 24.2f), FVector(4.5f, 4.5f, 1.9f));
        AddPart(Side < 0 ? TEXT("PortEngineCore") : TEXT("StarboardEngineCore"),
            Sphere, FVector(Side * 12.2f, 0.1f, 97.6f), FVector(4.9f, 4.9f, 2.4f));
        AddPart(Side < 0 ? TEXT("PortNacelleAftRing") : TEXT("StarboardNacelleAftRing"),
            Cylinder, FVector(Side * 12.2f, 0.1f, 96.8f), FVector(6.1f, 6.1f, 0.8f),
            FRotator(0.0f, 90.0f, 0.0f));

        // Cyan guide strip along the outer side of each nacelle.
        AddPart(Side < 0 ? TEXT("PortNacelleLightStrip") : TEXT("StarboardNacelleLightStrip"),
            Cube, FVector(Side * 15.05f, 0.45f, 61.0f), FVector(54.0f, 0.42f, 0.5f));
    }

    // Hangar lips frame the opening without placing a panel across the exit.
    AddPart(TEXT("CentralHangarUpperLip"), Cube, FVector(0.0f, -4.55f, 53.95f), FVector(0.42f, 13.9f, 0.32f));
    AddPart(TEXT("CentralHangarLowerLip"), Cube, FVector(0.0f, -9.65f, 53.95f), FVector(0.42f, 13.9f, 0.32f));

    // Side observation windows, positioned outside the interior walkways.
    for (const float Side : {-1.0f, 1.0f})
        for (int32 Index = 0; Index < 7; ++Index)
            AddPart(TEXT("HullObservationWindow"), Cube,
                FVector(Side * 26.5f, 2.5f, -34.0f + Index * 10.0f),
                FVector(0.72f, 0.18f, 0.12f));
}
