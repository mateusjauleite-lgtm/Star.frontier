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
    {
        AttachToActor(OwningShip, FAttachmentTransformRules::SnapToTargetNotIncludingScale);
        SetActorRelativeLocation(AFrontierShip::ThreeToUnrealLocalPosition(FVector(0.0f, 0.0f, 25.0f)));
    }
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

FText AFrontierShipElevator::GetInteractionLabel_Implementation() const
{
    return FText::FromString(TEXT("Usar elevador"));
}

bool AFrontierShipElevator::CanBeInteractedWith_Implementation(AActor* InteractingActor) const
{
    const AFrontierCharacter* Character = Cast<AFrontierCharacter>(InteractingActor);
    return OwningShip && Character && Character->CharacterState &&
        Character->CharacterState->State.Mode == EFrontierCharacterMode::OnFoot;
}

void AFrontierShipElevator::Interact_Implementation(AActor* InteractingActor)
{
    AFrontierCharacter* Character = Cast<AFrontierCharacter>(InteractingActor);
    if (!OwningShip || !Character || Stops.Num() < 2) return;

    const FVector CharacterShipLocalPosition =
        OwningShip->GetActorTransform().InverseTransformPosition(Character->GetActorLocation());

    int32 CurrentIndex = 0;
    float BestDistance = TNumericLimits<float>::Max();

    for (int32 Index = 0; Index < Stops.Num(); ++Index)
    {
        const FVector Candidate = AFrontierShip::ThreeToUnrealLocalPosition(Stops[Index].LegacyThreePosition);
        const float Distance = FVector::DistSquared(CharacterShipLocalPosition, Candidate);
        if (Distance < BestDistance)
        {
            BestDistance = Distance;
            CurrentIndex = Index;
        }
    }

    const int32 NextIndex = (CurrentIndex + 1) % Stops.Num();
    MoveCharacterToDeck(Character, Stops[NextIndex].DeckCode);
}
