#include "Main/FrontierPlayerController.h"

#include "Main/FrontierMainMenuWidget.h"
#include "Blueprint/UserWidget.h"
#include "Engine/World.h"

AFrontierPlayerController::AFrontierPlayerController()
{
    MainMenuWidgetClass = UFrontierMainMenuWidget::StaticClass();
}

void AFrontierPlayerController::BeginPlay()
{
    Super::BeginPlay();

    if (bShowMainMenuOnStart)
    {
        ShowMainMenu();
    }
    else
    {
        ApplyGameplayInputMode();
    }
}

void AFrontierPlayerController::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    if (MainMenuWidget)
    {
        MainMenuWidget->RemoveFromParent();
        MainMenuWidget = nullptr;
    }

    Super::EndPlay(EndPlayReason);
}

void AFrontierPlayerController::ShowMainMenu()
{
    if (!IsLocalController())
    {
        return;
    }

    if (!MainMenuWidget)
    {
        const TSubclassOf<UFrontierMainMenuWidget> WidgetClass =
            MainMenuWidgetClass ? MainMenuWidgetClass : UFrontierMainMenuWidget::StaticClass();

        MainMenuWidget = CreateWidget<UFrontierMainMenuWidget>(this, WidgetClass);
        if (!MainMenuWidget)
        {
            ApplyGameplayInputMode();
            return;
        }

        MainMenuWidget->OnProfileNameSubmittedEvent.AddDynamic(
            this, &AFrontierPlayerController::HandleProfileNameSubmitted);
        MainMenuWidget->OnSectionChangedEvent.AddDynamic(
            this, &AFrontierPlayerController::HandleMenuSectionChanged);
        MainMenuWidget->OnPlayRequestedEvent.AddDynamic(
            this, &AFrontierPlayerController::HandlePlayRequested);
    }

    if (!MainMenuWidget->IsInViewport())
    {
        MainMenuWidget->AddToViewport(100);
    }

    FInputModeUIOnly InputMode;
    InputMode.SetWidgetToFocus(MainMenuWidget->TakeWidget());
    SetInputMode(InputMode);
    SetShowMouseCursor(true);
}

void AFrontierPlayerController::CloseMainMenu()
{
    if (MainMenuWidget)
    {
        MainMenuWidget->RemoveFromParent();
    }

    ApplyGameplayInputMode();
}

bool AFrontierPlayerController::IsMainMenuVisible() const
{
    return MainMenuWidget && MainMenuWidget->IsInViewport();
}

void AFrontierPlayerController::HandleProfileNameSubmitted(const FText& DisplayName)
{
    // Forward only. A profile/save service must own persistence and validation.
    OnProfileDisplayNameSubmitted(DisplayName);
}

void AFrontierPlayerController::HandleMenuSectionChanged(uint8 Section)
{
    OnMenuSectionSelected(Section);
}

void AFrontierPlayerController::HandlePlayRequested()
{
    // The world and Main Core are already running behind the menu.
    // Closing the menu reveals the existing game; it does not load a new map.
    CloseMainMenu();
}

void AFrontierPlayerController::ApplyGameplayInputMode()
{
    FInputModeGameOnly InputMode;
    SetInputMode(InputMode);
    SetShowMouseCursor(false);
}
