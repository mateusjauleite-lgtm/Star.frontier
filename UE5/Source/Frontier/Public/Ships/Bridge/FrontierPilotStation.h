#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Character/Interaction/FrontierInteractable.h"
#include "FrontierPilotStation.generated.h"

class AFrontierShip;
class USphereComponent;

UCLASS(Blueprintable)
class FRONTIER_API AFrontierPilotStation : public AActor, public IFrontierInteractable
{
    GENERATED_BODY()

public:
    AFrontierPilotStation();

    UPROPERTY(EditInstanceOnly, BlueprintReadOnly, Category="Ship|Bridge")
    TObjectPtr<AFrontierShip> OwningShip;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Ship|Bridge")
    TObjectPtr<USphereComponent> InteractionVolume;

    UPROPERTY(EditInstanceOnly, BlueprintReadOnly, Category="Ship|Bridge")
    FName CommanderId = TEXT("player-commander");

    virtual FText GetInteractionLabel_Implementation() const override;
    virtual bool CanBeInteractedWith_Implementation(AActor* InteractingActor) const override;
    virtual void Interact_Implementation(AActor* InteractingActor) override;
};
