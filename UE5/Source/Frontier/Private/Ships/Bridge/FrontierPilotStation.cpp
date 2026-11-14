#include "Ships/Bridge/FrontierPilotStation.h"
#include "Ships/Core/FrontierShip.h"
#include "Character/Core/FrontierCharacter.h"
#include "Components/SceneComponent.h"

AFrontierPilotStation::AFrontierPilotStation()
{
    PrimaryActorTick.bCanEverTick = false;
    SetRootComponent(CreateDefaultSubobject<USceneComponent>(TEXT("StationRoot")));
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

    OwningShip->AssignCommander(CommanderId);
    Character->EnterShipControlMode();
}
