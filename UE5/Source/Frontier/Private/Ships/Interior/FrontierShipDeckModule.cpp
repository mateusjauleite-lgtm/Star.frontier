#include "Ships/Interior/FrontierShipDeckModule.h"
#include "Ships/Interior/FrontierShipDeckDefinition.h"
#include "Components/SceneComponent.h"
#include "Components/StaticMeshComponent.h"

AFrontierShipDeckModule::AFrontierShipDeckModule()
{
    PrimaryActorTick.bCanEverTick = false;
    DeckRoot = CreateDefaultSubobject<USceneComponent>(TEXT("DeckRoot"));
    SetRootComponent(DeckRoot);
}

void AFrontierShipDeckModule::RebuildFromDefinition()
{
    for (UStaticMeshComponent* Component : WallComponents)
        if (Component) Component->DestroyComponent();
    WallComponents.Reset();

    if (!Definition) return;

    if (Definition->FloorMesh)
    {
        UStaticMeshComponent* Floor = NewObject<UStaticMeshComponent>(this, TEXT("DeckFloor"));
        Floor->SetupAttachment(DeckRoot);
        Floor->SetStaticMesh(Definition->FloorMesh);
        Floor->SetRelativeLocation(Definition->LocalOffset);
        Floor->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
        Floor->RegisterComponent();
    }

    for (int32 Index = 0; Index < Definition->WallSegments.Num(); ++Index)
    {
        const FFrontierShipDeckPiece& Piece = Definition->WallSegments[Index];
        if (!Piece.Mesh) continue;

        const FBox PieceBounds = Piece.Mesh->GetBoundingBox().TransformBy(Piece.RelativeTransform);
        if (Definition->bKeepHangarExitClear && Definition->HangarExitClearance.IsValid() &&
            PieceBounds.Intersect(Definition->HangarExitClearance)) continue;
        if (Definition->bKeepElevatorAccessClear && Definition->ElevatorAccessClearance.IsValid() &&
            PieceBounds.Intersect(Definition->ElevatorAccessClearance)) continue;
        UStaticMeshComponent* Wall = NewObject<UStaticMeshComponent>(
            this, FName(*FString::Printf(TEXT("WallSegment_%02d"), Index)));
        Wall->SetupAttachment(DeckRoot);
        Wall->SetStaticMesh(Piece.Mesh);
        Wall->SetRelativeTransform(Piece.RelativeTransform);
        Wall->SetCollisionEnabled(Piece.bCollisionEnabled ? ECollisionEnabled::QueryAndPhysics : ECollisionEnabled::NoCollision);
        Wall->RegisterComponent();
        WallComponents.Add(Wall);
    }
}
