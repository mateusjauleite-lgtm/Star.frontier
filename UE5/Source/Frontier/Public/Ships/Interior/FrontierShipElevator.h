#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Character/Interaction/FrontierInteractable.h"
#include "FrontierShipElevator.generated.h"

class AFrontierShip;
class USphereComponent;

USTRUCT(BlueprintType)
struct FRONTIER_API FFrontierShipElevatorStop
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Ship|Elevator")
    FName DeckCode;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Ship|Elevator")
    FVector LegacyThreePosition = FVector(0.0f, 0.23f, 25.0f);
};

UCLASS(Blueprintable)
class FRONTIER_API AFrontierShipElevator : public AActor, public IFrontierInteractable
{
    GENERATED_BODY()

public:
    AFrontierShipElevator();

    UPROPERTY(EditInstanceOnly, BlueprintReadOnly, Category="Ship|Elevator")
    TObjectPtr<AFrontierShip> OwningShip;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Ship|Elevator")
    TObjectPtr<USphereComponent> InteractionVolume;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Ship|Elevator")
    TArray<FFrontierShipElevatorStop> Stops;

protected:
    virtual void BeginPlay() override;

public:
    UFUNCTION(BlueprintCallable, Category="Ship|Elevator")
    bool MoveCharacterToDeck(AActor* Character, FName DeckCode);

    UFUNCTION(BlueprintCallable, Category="Ship|Elevator")
    bool MoveUp(AActor* Character);

    UFUNCTION(BlueprintCallable, Category="Ship|Elevator")
    bool MoveDown(AActor* Character);

    UFUNCTION(BlueprintCallable, Category="Ship|Elevator")
    FName GetNearestDeckCode(const AActor* Character) const;

    UFUNCTION(BlueprintCallable, Category="Ship|Elevator")
    void InitializeForShip(AFrontierShip* Ship);

    virtual FText GetInteractionLabel_Implementation() const override;
    virtual bool CanBeInteractedWith_Implementation(AActor* InteractingActor) const override;
    virtual void Interact_Implementation(AActor* InteractingActor) override;
};
