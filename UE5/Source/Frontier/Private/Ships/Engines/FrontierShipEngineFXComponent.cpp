#include "Ships/Engines/FrontierShipEngineFXComponent.h"

#include "Ships/Core/FrontierShip.h"
#include "Ships/Engines/FrontierShipEngineComponent.h"
#include "Components/PointLightComponent.h"
#include "Components/SceneComponent.h"
#include "NiagaraComponent.h"
#include "NiagaraSystem.h"

UFrontierShipEngineFXComponent::UFrontierShipEngineFXComponent()
{
    PrimaryComponentTick.bCanEverTick = true;
}

void UFrontierShipEngineFXComponent::BeginPlay()
{
    Super::BeginPlay();
    CreateEngineVisuals();
    RefreshEngineFX();
}

void UFrontierShipEngineFXComponent::CreateEngineVisuals()
{
    AFrontierShip* Ship = Cast<AFrontierShip>(GetOwner());
    if (!Ship || !Ship->ShipRoot) return;

    // Engine cores are at the aft end of the two nacelles in the source hull.
    // Three.js (±12.2, 0.1, 97.6) -> UE local (-9760, ±1220, 10) cm.
    const FVector ExhaustLocations[] = {
        FVector(-9760.0f, -1220.0f, 10.0f),
        FVector(-9760.0f,  1220.0f, 10.0f)
    };

    for (int32 Index = 0; Index < 2; ++Index)
    {
        const FName SideName = Index == 0 ? TEXT("Port") : TEXT("Starboard");

        UPointLightComponent* Glow = NewObject<UPointLightComponent>(
            GetOwner(), MakeUniqueObjectName(GetOwner(), UPointLightComponent::StaticClass(),
                FName(*FString::Printf(TEXT("%sEngineExhaustGlow"), *SideName.ToString()))));
        if (Glow)
        {
            Glow->SetupAttachment(Ship->ShipRoot);
            Glow->SetRelativeLocation(ExhaustLocations[Index]);
            Glow->SetIntensity(0.0f);
            Glow->SetLightColor(FLinearColor(0.12f, 0.78f, 1.0f));
            Glow->SetAttenuationRadius(GlowAttenuationRadius);
            Glow->SetSourceRadius(90.0f);
            Glow->SetVisibility(true);
            Glow->RegisterComponent();
            ExhaustGlows.Add(Glow);
        }

        if (EngineSystem)
        {
            UNiagaraComponent* Emitter = NewObject<UNiagaraComponent>(
                GetOwner(), MakeUniqueObjectName(GetOwner(), UNiagaraComponent::StaticClass(),
                    FName(*FString::Printf(TEXT("%sEngineNiagara"), *SideName.ToString()))));
            if (Emitter)
            {
                Emitter->SetupAttachment(Ship->ShipRoot);
                Emitter->SetRelativeLocation(ExhaustLocations[Index]);
                // UE ship forward is +X; the aft exhaust points toward -X.
                Emitter->SetRelativeRotation(FRotator(0.0f, 180.0f, 0.0f));
                Emitter->SetAsset(EngineSystem);
                Emitter->SetAutoActivate(false);
                Emitter->RegisterComponent();
                NiagaraEmitters.Add(Emitter);
            }
        }
    }
}

void UFrontierShipEngineFXComponent::TickComponent(
    float DeltaSeconds, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaSeconds, TickType, ThisTickFunction);
    UpdateEngineVisuals(DeltaSeconds);
}

void UFrontierShipEngineFXComponent::RefreshEngineFX()
{
    UpdateEngineVisuals(0.0f);
}

void UFrontierShipEngineFXComponent::UpdateEngineVisuals(float DeltaSeconds)
{
    const AFrontierShip* Ship = Cast<AFrontierShip>(GetOwner());
    if (!Ship || !Ship->Engines) return;

    const FFrontierShipFlightState& Flight = Ship->FlightState;
    const float Throttle = FMath::Clamp(FMath::Abs(Flight.Throttle), 0.0f, 1.0f);
    const float SpeedLimit = FMath::Max(1.0f,
        Ship->Engines->MaximumSpeedCmPerSecond *
        (Flight.bBoosting ? FMath::Max(1.0f, Ship->Engines->BoostMultiplier) : 1.0f));
    const float SpeedNormalized = FMath::Clamp(
        Ship->Engines->GetCurrentSpeedCmPerSecond() / SpeedLimit, 0.0f, 1.0f);

    float TargetGlow = CruiseGlowIntensity * FMath::Max(Throttle, SpeedNormalized);
    if (Flight.bBoosting) TargetGlow = FMath::Max(TargetGlow, BoostGlowIntensity);
    if (Flight.bBraking) TargetGlow *= 0.2f;

    CurrentGlowIntensity = DeltaSeconds > 0.0f
        ? FMath::FInterpTo(CurrentGlowIntensity, TargetGlow, DeltaSeconds, 5.0f)
        : TargetGlow;

    for (UPointLightComponent* Glow : ExhaustGlows)
    {
        if (Glow)
        {
            Glow->SetIntensity(CurrentGlowIntensity);
            Glow->SetAttenuationRadius(GlowAttenuationRadius);
        }
    }

    const bool bEngineActive = Throttle > 0.01f || SpeedNormalized > 0.01f || Flight.bBoosting;
    for (UNiagaraComponent* Emitter : NiagaraEmitters)
    {
        if (!Emitter) continue;

        Emitter->SetVariableFloat(ThrottleParameter, Throttle);
        Emitter->SetVariableFloat(SpeedParameter, SpeedNormalized);
        Emitter->SetVariableFloat(BoostParameter, Flight.bBoosting ? 1.0f : 0.0f);
        Emitter->SetVariableFloat(BrakingParameter, Flight.bBraking ? 1.0f : 0.0f);

        if (bEngineActive && !Emitter->IsActive())
            Emitter->Activate(true);
        else if (!bEngineActive && Emitter->IsActive())
            Emitter->Deactivate();
    }
}
