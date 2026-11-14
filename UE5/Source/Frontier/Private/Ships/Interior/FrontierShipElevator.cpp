#include "Ships/Interior/FrontierShipElevator.h"
#include "Ships/Core/FrontierShip.h"
#include "Character/Core/FrontierCharacter.h"
#include "Character/Core/FrontierCharacterStateComponent.h"
#include "Components/SphereComponent.h"

AFrontierShipElevator::AFrontierShipElevator()
{
    PrimaryActorTick.bCanEverTick = false;
    InteractionVolume = CreateDefaultSubobject<USphereComponent>(TEXT("ElevatorInteraction"));
    SetRootComponent(InteractionVolume);
    InteractionVolume->InitSphereRadius(160.0f);
    InteractionVolume->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
    InteractionVolume->SetCollisionResponseToAllChannels(ECR_Ignore);
    InteractionVolume->SetCollisionResponseToChannel(ECC_Visibility, ECR_Block);

    FFrontierShipElevatorStop Deck1;
    Deck1.DeckCode = TEXT("D1");
    Deck1.LegacyThreePosition = FVector(0.0f, 8.93f, 25.0f);
    Stops.Add(Deck1);

    FFrontierShipElevatorStop Deck2;
    Deck2.DeckCode = TEXT("D2");
    Deck2.LegacyThreePosition = FVector(0.0f, 3.13f, 25.0f);
    Stops.Add(Deck2);

    FFrontierShipElevatorStop Deck3;
    Deck3.DeckCode = TEXT("D3");
    Deck3.LegacyThreePosition = FVector(0.0f, -2.67f, 25.0f);
    Stops.Add(Deck3);

    FFrontierShipElevatorStop Deck4;
    Deck4.DeckCode = TEXT("D4");
    Deck4.LegacyThreePosition = FVector(0.0f, -8.47f, 25.0f);
    Stops.Add(Deck4);
}

void AFrontierShipElevator::BeginPlay()
{
    Super::BeginPlay();
    if (OwningShip)
        InitializeForShip(OwningShip);
}

void AFrontierShipElevator::InitializeForShip(AFrontierShip* Ship)
{
    if (!IsValid(Ship)) return;

    OwningShip = Ship;
    AttachToActor(Ship, FAttachmentTransformRules::SnapToTargetNotIncludingScale);
    SetActorRelativeLocation(AFrontierShip::ThreeToUnrealLocalPosition(FVector(0.0f, 0.0f, 25.0f)));
}

bool AFrontierShipElevator::MoveCharacterToDeck(AActor* Character, FName DeckCode)
{
    AFrontierCharacter* FrontierCharacter = Cast<AFrontierCharacter>(Character);
    if (!OwningShip || !FrontierCharacter || Stops.Num() == 0 ||
        !FrontierCharacter->CharacterState ||
        FrontierCharacter->CharacterState->State.Mode != EFrontierCharacterMode::OnFoot)
        return false;

    for (const FFrontierShipElevatorStop& Stop : Stops)
    {
        if (Stop.DeckCode != DeckCode) continue;
        FrontierCharacter->AttachToActor(OwningShip, FAttachmentTransformRules::KeepWorldTransform);
        FrontierCharacter->SetActorRelativeLocation(
            AFrontierShip::ThreeToUnrealLocalPosition(Stop.LegacyThreePosition));
        return true;
    }
    return false;
}

FName AFrontierShipElevator::GetNearestDeckCode(const AActor* Character) const
{
    if (!OwningShip || !IsValid(Character) || Stops.Num() == 0) return NAME_None;

    const FVector CharacterShipLocalPosition =
        OwningShip->GetActorTransform().InverseTransformPosition(Character->GetActorLocation());

    int32 BestIndex = INDEX_NONE;
    float BestDistance = TNumericLimits<float>::Max();

    for (int32 Index = 0; Index < Stops.Num(); ++Index)
    {
        const FVector Candidate = AFrontierShip::ThreeToUnrealLocalPosition(Stops[Index].LegacyThreePosition);
        const float Distance = FVector::DistSquared(CharacterShipLocalPosition, Candidate);
        if (Distance < BestDistance)
        {
            BestDistance = Distance;
            BestIndex = Index;
        }
    }

    return Stops.IsValidIndex(BestIndex) ? Stops[BestIndex].DeckCode : NAME_None;
}

bool AFrontierShipElevator::MoveUp(AActor* Character)
{
    if (!OwningShip || !IsValid(Character) || Stops.Num() == 0) return false;

    const FName CurrentDeck = GetNearestDeckCode(Character);
    const int32 CurrentIndex = Stops.IndexOfByPredicate(
        [&CurrentDeck](const FFrontierShipElevatorStop& Stop) { return Stop.DeckCode == CurrentDeck; });

    // D1 is the uppermost deck: never wrap around from D1 to D4.
    return CurrentIndex > 0 && MoveCharacterToDeck(Character, Stops[CurrentIndex - 1].DeckCode);
}

bool AFrontierShipElevator::MoveDown(AActor* Character)
{
    if (!OwningShip || !IsValid(Character) || Stops.Num() == 0) return false;

    const FName CurrentDeck = GetNearestDeckCode(Character);
    const int32 CurrentIndex = Stops.IndexOfByPredicate(
        [&CurrentDeck](const FFrontierShipElevatorStop& Stop) { return Stop.DeckCode == CurrentDeck; });

    // D4 is the lowest deck: never wrap around from D4 to D1.
    return CurrentIndex != INDEX_NONE && CurrentIndex < Stops.Num() - 1 &&
        MoveCharacterToDeck(Character, Stops[CurrentIndex + 1].DeckCode);
}

FText AFrontierShipElevator::GetInteractionLabel_Implementation() const
{
    return FText::FromString(TEXT("Elevador — escolher andar"));
}

bool AFrontierShipElevator::CanBeInteractedWith_Implementation(AActor* InteractingActor) const
{
    const AFrontierCharacter* Character = Cast<AFrontierCharacter>(InteractingActor);
    return OwningShip && Character && Character->CharacterState &&
        Character->CharacterState->State.Mode == EFrontierCharacterMode::OnFoot;
}

void AFrontierShipElevator::Interact_Implementation(AActor* InteractingActor)
{
    // Interaction opens/activates the elevator context. Deck selection is explicit
    // through MoveUp / MoveDown so the player is never moved unexpectedly.
    (void)InteractingActor;
}
