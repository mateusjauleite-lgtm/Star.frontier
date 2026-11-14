#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "Main/FrontierMainMenuWidget.h"
#include "FrontierPlayerController.generated.h"


/**
 * Main Core UI navigation owner.
 *
 * The controller creates/removes the main menu and switches input mode.
 * It forwards profile and section intent to Blueprint integration points;
 * profile persistence, authentication and gameplay state remain elsewhere.
 */
UCLASS(Blueprintable)
class FRONTIER_API AFrontierPlayerController : public APlayerController
{
    GENERATED_BODY()

public:
    AFrontierPlayerController();

    UFUNCTION(BlueprintCallable, Category="Main|UI")
    void ShowMainMenu();

    UFUNCTION(BlueprintCallable, Category="Main|UI")
    void CloseMainMenu();

    UFUNCTION(BlueprintPure, Category="Main|UI")
    bool IsMainMenuVisible() const;

    /** Optional native/Blueprint menu class override. */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Main|UI")
    TSubclassOf<UFrontierMainMenuWidget> MainMenuWidgetClass;

    /** Allows test maps to start directly in gameplay. */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Main|UI")
    bool bShowMainMenuOnStart = true;

    UFUNCTION(BlueprintImplementableEvent, Category="Main|UI|Integration")
    void OnProfileDisplayNameSubmitted(const FText& DisplayName);

    UFUNCTION(BlueprintImplementableEvent, Category="Main|UI|Integration")
    void OnMenuSectionSelected(EFrontierMainMenuSection Section);

protected:
    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

private:
    UPROPERTY(Transient)
    TObjectPtr<UFrontierMainMenuWidget> MainMenuWidget;

    UFUNCTION()
    void HandleProfileNameSubmitted(const FText& DisplayName);

    UFUNCTION()
    void HandleMenuSectionChanged(EFrontierMainMenuSection Section);

    UFUNCTION()
    void HandlePlayRequested();

    void ApplyGameplayInputMode();
};
