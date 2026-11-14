#include "Ships/Computer/FrontierShipComputerComponent.h"
#include "Ships/Core/FrontierShip.h"
#include "Ships/Engines/FrontierShipEngineComponent.h"

UFrontierShipComputerComponent::UFrontierShipComputerComponent()
{
    PrimaryComponentTick.bCanEverTick = false;
    Systems = {
        { TEXT("navigation"), FText::FromString(TEXT("Navegação")), TEXT("standby") },
        { TEXT("sensors"), FText::FromString(TEXT("Sensores")), TEXT("standby") },
        { TEXT("power"), FText::FromString(TEXT("Energia e recursos")), TEXT("standby") }
    };
}

void UFrontierShipComputerComponent::Boot()
{
    bOnline = true;
    for (FFrontierShipComputerSystemStatus& System : Systems)
        System.Status = TEXT("online");
}

void UFrontierShipComputerComponent::Shutdown()
{
    ActiveTerminalId = NAME_None;
    bOnline = false;
    for (FFrontierShipComputerSystemStatus& System : Systems)
        System.Status = TEXT("standby");
}

void UFrontierShipComputerComponent::RegisterTerminal(FName TerminalId, const TArray<FName>& AllowedSystems)
{
    if (TerminalId.IsNone()) return;
    TSet<FName>& Permissions = TerminalPermissions.FindOrAdd(TerminalId);
    Permissions.Reset();
    for (const FName& SystemId : AllowedSystems)
        if (!SystemId.IsNone()) Permissions.Add(SystemId);
}

bool UFrontierShipComputerComponent::ConnectTerminal(FName TerminalId, FName OperatorId)
{
    if (!bOnline || TerminalId.IsNone() || OperatorId.IsNone() ||
        !TerminalPermissions.Contains(TerminalId)) return false;
    if (!ActiveTerminalId.IsNone() && ActiveTerminalId != TerminalId) return false;
    ActiveTerminalId = TerminalId;
    return true;
}

void UFrontierShipComputerComponent::DisconnectTerminal(FName TerminalId)
{
    if (ActiveTerminalId == TerminalId) ActiveTerminalId = NAME_None;
}

bool UFrontierShipComputerComponent::IsTerminalConnected(FName TerminalId) const
{
    return bOnline && ActiveTerminalId == TerminalId;
}

bool UFrontierShipComputerComponent::DispatchNavigationTelemetry(
    FName TerminalId, FFrontierShipTelemetry& OutTelemetry) const
{
    const TSet<FName>* Permissions = TerminalPermissions.Find(TerminalId);
    const AFrontierShip* Ship = Cast<AFrontierShip>(GetOwner());
    if (!IsTerminalConnected(TerminalId) || !Permissions ||
        !Permissions->Contains(TEXT("navigation")) || !Ship || !Ship->Engines) return false;

    OutTelemetry.Location = Ship->GetActorLocation();
    OutTelemetry.Rotation = Ship->GetActorRotation();
    OutTelemetry.SpeedCmPerSecond = Ship->Engines->GetCurrentSpeedCmPerSecond();
    return true;
}
