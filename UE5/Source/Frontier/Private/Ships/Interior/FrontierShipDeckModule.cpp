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
        UStaticMesh* Mesh = Definition->WallSegments[Index];
        if (!Mesh) continue;
        UStaticMeshComponent* Wall = NewObject<UStaticMeshComponent>(
            this, FName(*FString::Printf(TEXT("WallSegment_%02d"), Index)));
        Wall->SetupAttachment(DeckRoot);
        Wall->SetStaticMesh(Mesh);
        Wall->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
        Wall->RegisterComponent();
        WallComponents.Add(Wall);
    }
}
