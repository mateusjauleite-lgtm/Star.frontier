#include "Ships/Interior/FrontierShipInteriorComponent.h"
#include "Ships/Interior/FrontierShipDeckModule.h"
#include "Ships/Interior/FrontierShipElevator.h"
#include "Ships/Bridge/FrontierPilotStation.h"
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
    EnsurePilotStation();
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
    // Runtime defaults preserve the four-deck ship layout even before Editor
    // Data Assets or imported floor meshes are available.
    struct FDefaultDeck
    {
        EFrontierShipDeckId Id;
        const TCHAR* Code;
        const TCHAR* Name;
        FVector LegacyPosition;
        float Width;
        float Length;
        bool bHangarClear;
    };

    static const FDefaultDeck DefaultDecks[] = {
        { EFrontierShipDeckId::Deck1_Command, TEXT("D1"), TEXT("Ponte de comando"), FVector(0.0f, 8.7f, -2.0f), 50.0f, 82.0f, false },
        { EFrontierShipDeckId::Deck2_OperationsScience, TEXT("D2"), TEXT("Operações e ciência"), FVector(0.0f, 2.9f, -2.0f), 50.0f, 94.0f, false },
        { EFrontierShipDeckId::Deck3_Engineering, TEXT("D3"), TEXT("Engenharia"), FVector(0.0f, -2.9f, -2.0f), 53.0f, 102.0f, false },
        { EFrontierShipDeckId::Deck4_HangarSupport, TEXT("D4"), TEXT("Hangar e suporte"), FVector(0.0f, -8.7f, -2.0f), 35.0f, 58.0f, true }
    };

    for (const FDefaultDeck& DefaultDeck : DefaultDecks)
    {
        const bool bAlreadyDefined = DeckDefinitions.ContainsByPredicate(
            [&DefaultDeck](const TObjectPtr<UFrontierShipDeckDefinition>& Existing)
            {
                return Existing && Existing->DeckCode == FName(DefaultDeck.Code);
            });
        if (bAlreadyDefined) continue;

        UFrontierShipDeckDefinition* Definition = NewObject<UFrontierShipDeckDefinition>(
            this, MakeUniqueObjectName(this, UFrontierShipDeckDefinition::StaticClass(),
                FName(*FString::Printf(TEXT("Runtime_%s"), DefaultDeck.Code))));
        Definition->DeckId = DefaultDeck.Id;
        Definition->DeckCode = FName(DefaultDeck.Code);
        Definition->DisplayName = FText::FromString(DefaultDeck.Name);
        Definition->LegacyThreePosition = DefaultDeck.LegacyPosition;
        Definition->FloorWidthMeters = DefaultDeck.Width;
        Definition->FloorLengthMeters = DefaultDeck.Length;
        Definition->FloorThicknessMeters = 0.42f;
        Definition->bGenerateDefaultFloor = true;
        Definition->bKeepHangarExitClear = DefaultDeck.bHangarClear;
        Definition->bKeepElevatorAccessClear = true;
        DeckDefinitions.Add(Definition);
    }

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


AFrontierPilotStation* UFrontierShipInteriorComponent::EnsurePilotStation()
{
    AFrontierShip* ShipOwner = Cast<AFrontierShip>(GetOwner());
    UWorld* World = GetWorld();
    if (!ShipOwner || !World) return nullptr;

    if (IsValid(PilotStationActor))
        return PilotStationActor;

    FActorSpawnParameters SpawnParameters;
    SpawnParameters.Owner = ShipOwner;
    SpawnParameters.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;

    PilotStationActor = World->SpawnActorDeferred<AFrontierPilotStation>(
        AFrontierPilotStation::StaticClass(), ShipOwner->GetActorTransform(),
        ShipOwner, nullptr, ESpawnActorCollisionHandlingMethod::AlwaysSpawn);

    if (PilotStationActor)
    {
        PilotStationActor->OwningShip = ShipOwner;
        PilotStationActor->FinishSpawning(ShipOwner->GetActorTransform());
    }

    return PilotStationActor;
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
