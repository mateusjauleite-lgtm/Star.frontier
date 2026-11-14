#include "Ships/Bridge/FrontierPilotStation.h"
#include "Ships/Core/FrontierShip.h"
#include "Character/Core/FrontierCharacter.h"
#include "Components/SceneComponent.h"
#include "Components/SphereComponent.h"

AFrontierPilotStation::AFrontierPilotStation()
{
    PrimaryActorTick.bCanEverTick = false;
    InteractionVolume = CreateDefaultSubobject<USphereComponent>(TEXT("PilotStationInteraction"));
    SetRootComponent(InteractionVolume);
    InteractionVolume->InitSphereRadius(145.0f);
    InteractionVolume->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
    InteractionVolume->SetCollisionResponseToAllChannels(ECR_Ignore);
    InteractionVolume->SetCollisionResponseToChannel(ECC_Visibility, ECR_Block);
}

void AFrontierPilotStation::BeginPlay()
{
    Super::BeginPlay();
    if (OwningShip)
    {
        AttachToActor(OwningShip, FAttachmentTransformRules::SnapToTargetNotIncludingScale);
        SetActorRelativeLocation(AFrontierShip::ThreeToUnrealLocalPosition(FVector(0.0f, 8.91f, -29.5f)));
    }
}

FText AFrontierPilotStation::GetInteractionLabel_Implementation() const
{
    return FText::FromString(TEXT("Assumir comando da nave"));
}

bool AFrontierPilotStation::CanBeInteractedWith_Implementation(AActor* InteractingActor) const
{
    return OwningShip && !OwningShip->IsPiloted() &&
        Cast<AFrontierCharacter>(InteractingActor) != nullptr;
}

void AFrontierPilotStation::Interact_Implementation(AActor* InteractingActor)
{
    AFrontierCharacter* Character = Cast<AFrontierCharacter>(InteractingActor);
    if (!Character || !OwningShip) return;

    OwningShip->BeginPiloting(Character, CommanderId);
}
