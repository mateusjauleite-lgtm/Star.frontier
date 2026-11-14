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

FText AFrontierPilotStation::GetInteractionLabel_Implementation() const
{
    return FText::FromString(TEXT("Assumir comando da nave"));
}

bool AFrontierPilotStation::CanBeInteractedWith_Implementation(AActor* InteractingActor) const
{
    return OwningShip && Cast<AFrontierCharacter>(InteractingActor) != nullptr;
}

void AFrontierPilotStation::Interact_Implementation(AActor* InteractingActor)
{
    AFrontierCharacter* Character = Cast<AFrontierCharacter>(InteractingActor);
    if (!Character || !OwningShip) return;

    OwningShip->BeginPiloting(Character, CommanderId);
}
