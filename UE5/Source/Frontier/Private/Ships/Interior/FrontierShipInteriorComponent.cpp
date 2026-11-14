#include "Ships/Interior/FrontierShipInteriorComponent.h"
#include "Ships/Interior/FrontierShipDeckModule.h"
#include "Ships/Interior/FrontierShipElevator.h"
#include "Ships/Core/FrontierShip.h"
#include "Ships/Interior/FrontierShipDeckDefinition.h"
#include "Engine/World.h"
#include "GameFramework/Actor.h"

void UFrontierShipInteriorComponent::BeginPlay()
{
    Super::BeginPlay();
    if (bBuildMissingDeckModulesOnBeginPlay)
        BuildMissingDeckModules();

    EnsureElevator();
}

AFrontierShipDeckModule* UFrontierShipInteriorComponent::FindDeck(FName DeckCode) const
{
    for (AFrontierShipDeckModule* Deck : DeckModules)
        if (Deck && Deck->Definition && Deck->Definition->DeckCode == DeckCode)
            return Deck;
    return nullptr;
}

int32 UFrontierShipInteriorComponent::BuildMissingDeckModules()
{
    AActor* ShipOwner = GetOwner();
    UWorld* World = GetWorld();
    if (!ShipOwner || !World) return 0;

    int32 CreatedCount = 0;
    for (UFrontierShipDeckDefinition* DeckDefinition : DeckDefinitions)
    {
        if (!DeckDefinition || DeckDefinition->DeckCode.IsNone() ||
            FindDeck(DeckDefinition->DeckCode))
            continue;

        FActorSpawnParameters SpawnParameters;
        SpawnParameters.Owner = ShipOwner;
        SpawnParameters.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;

        AFrontierShipDeckModule* Deck = World->SpawnActor<AFrontierShipDeckModule>(
            AFrontierShipDeckModule::StaticClass(), ShipOwner->GetActorTransform(), SpawnParameters);
        if (!Deck) continue;

        Deck->Definition = DeckDefinition;
        Deck->AttachToActor(ShipOwner, FAttachmentTransformRules::KeepWorldTransform);
        Deck->SetActorRelativeLocation(FVector::ZeroVector);
        Deck->RebuildFromDefinition();
        DeckModules.Add(Deck);
        ++CreatedCount;
    }

    return CreatedCount;
}

AFrontierShipElevator* UFrontierShipInteriorComponent::EnsureElevator()
{
    AFrontierShip* ShipOwner = Cast<AFrontierShip>(GetOwner());
    UWorld* World = GetWorld();
    if (!ShipOwner || !World) return nullptr;

    if (IsValid(ElevatorActor))
    {
        ElevatorActor->InitializeForShip(ShipOwner);
        return ElevatorActor;
    }

    FActorSpawnParameters SpawnParameters;
    SpawnParameters.Owner = ShipOwner;
    SpawnParameters.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;

    ElevatorActor = World->SpawnActor<AFrontierShipElevator>(
        AFrontierShipElevator::StaticClass(), ShipOwner->GetActorTransform(), SpawnParameters);

    if (ElevatorActor)
        ElevatorActor->InitializeForShip(ShipOwner);

    return ElevatorActor;
}
