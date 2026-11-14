#include "Ships/Interior/FrontierShipElevator.h"
#include "Ships/Core/FrontierShip.h"
#include "Character/Core/FrontierCharacter.h"
#include "Components/SphereComponent.h"
#include "Components/SceneComponent.h"

AFrontierShipElevator::AFrontierShipElevator()
{
    PrimaryActorTick.bCanEverTick = false;
    USceneComponent* SceneRoot = CreateDefaultSubobject<USceneComponent>(TEXT("ElevatorRoot"));
    SetRootComponent(SceneRoot);
    InteractionVolume = CreateDefaultSubobject<USphereComponent>(TEXT("ElevatorInteraction"));
    InteractionVolume->SetupAttachment(SceneRoot);
    InteractionVolume->SetSphereRadius(1050.0f);
    InteractionVolume->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
    InteractionVolume->SetCollisionResponseToAllChannels(ECR_Ignore);
    InteractionVolume->SetCollisionResponseToChannel(ECC_Pawn, ECR_Overlap);

    FFrontierShipElevatorStop D1; D1.DeckCode = TEXT("D1"); D1.LegacyThreePosition = FVector(0.0f, 8.93f, 25.0f); Stops.Add(D1);
    FFrontierShipElevatorStop D2; D2.DeckCode = TEXT("D2"); D2.LegacyThreePosition = FVector(0.0f, 3.13f, 25.0f); Stops.Add(D2);
    FFrontierShipElevatorStop D3; D3.DeckCode = TEXT("D3"); D3.LegacyThreePosition = FVector(0.0f, -2.67f, 25.0f); Stops.Add(D3);
    FFrontierShipElevatorStop D4; D4.DeckCode = TEXT("D4"); D4.LegacyThreePosition = FVector(0.0f, -8.47f, 25.0f); Stops.Add(D4);
}

void AFrontierShipElevator::BeginPlay()
{
    Super::BeginPlay();
}

void AFrontierShipElevator::InitializeForShip(AFrontierShip* Ship)
{
    OwningShip = Ship;
    if (Ship) AttachToActor(Ship, FAttachmentTransformRules::KeepWorldTransform);
}

FName AFrontierShipElevator::GetNearestDeckCode(const AActor* Character) const
{
    if (!Character || !OwningShip) return NAME_None;
    const FVector Local = OwningShip->GetActorTransform().InverseTransformPosition(Character->GetActorLocation());
    FName Result = NAME_None;
    float Best = TNumericLimits<float>::Max();
    for (const FFrontierShipElevatorStop& Stop : Stops)
    {
        const float Height = AFrontierShip::ThreeToUnrealLocalPosition(Stop.LegacyThreePosition).Z;
        const float Distance = FMath::Abs(Local.Z - Height);
        if (Distance < Best) { Best = Distance; Result = Stop.DeckCode; }
    }
    return Result;
}

bool AFrontierShipElevator::MoveCharacterToDeck(AActor* Character, FName DeckCode)
{
    AFrontierCharacter* FrontierCharacter = Cast<AFrontierCharacter>(Character);
    return FrontierCharacter && OwningShip && OwningShip->PlaceCharacterOnDeck(FrontierCharacter, DeckCode);
}

bool AFrontierShipElevator::MoveUp(AActor* Character)
{
    const FName Current = GetNearestDeckCode(Character);
    for (int32 I = 0; I < Stops.Num(); ++I)
        if (Stops[I].DeckCode == Current)
            return I > 0 && MoveCharacterToDeck(Character, Stops[I - 1].DeckCode);
    return false;
}

bool AFrontierShipElevator::MoveDown(AActor* Character)
{
    const FName Current = GetNearestDeckCode(Character);
    for (int32 I = 0; I < Stops.Num(); ++I)
        if (Stops[I].DeckCode == Current)
            return I < Stops.Num() - 1 && MoveCharacterToDeck(Character, Stops[I + 1].DeckCode);
    return false;
}

FText AFrontierShipElevator::GetInteractionLabel_Implementation() const
{
    return FText::FromString(TEXT("Usar elevador"));
}

bool AFrontierShipElevator::CanBeInteractedWith_Implementation(AActor* InteractingActor) const
{
    return IsValid(InteractingActor) && IsValid(OwningShip);
}

void AFrontierShipElevator::Interact_Implementation(AActor* InteractingActor)
{
    if (CanBeInteractedWith_Implementation(InteractingActor))
        OnElevatorRequested.Broadcast(InteractingActor);
}
