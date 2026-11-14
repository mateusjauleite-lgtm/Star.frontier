#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "FrontierMainMenuWidget.generated.h"

class UButton;
class UEditableTextBox;
class UTextBlock;

UENUM(BlueprintType)
enum class EFrontierMainMenuSection : uint8
{
    Explore UMETA(DisplayName="Explorar"),
    Story UMETA(DisplayName="História"),
    Character UMETA(DisplayName="Personagem"),
    Ships UMETA(DisplayName="Naves"),
    Store UMETA(DisplayName="Loja"),
    Settings UMETA(DisplayName="Configurações")
};

/**
 * Native UMG shell for the legacy main menu.
 *
 * This widget owns presentation and forwards intent only. It does not own
 * authentication, save data, currency, inventory, ship state or world startup.
 */
UCLASS(Blueprintable)
class FRONTIER_API UFrontierMainMenuWidget : public UUserWidget
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category="Main|Menu")
    void SelectSection(EFrontierMainMenuSection Section);

    UFUNCTION(BlueprintCallable, Category="Main|Menu")
    void SetProfileNameHint(const FText& Hint);

    UFUNCTION(BlueprintImplementableEvent, Category="Main|Menu|Events")
    void OnProfileNameSubmitted(const FText& DisplayName);

    UFUNCTION(BlueprintImplementableEvent, Category="Main|Menu|Events")
    void OnPlayRequested();

    UFUNCTION(BlueprintImplementableEvent, Category="Main|Menu|Events")
    void OnSectionChanged(EFrontierMainMenuSection Section);

protected:
    virtual void NativeConstruct() override;

private:
    void BuildNativeLayout();
    void RefreshSectionContent();

    UFUNCTION()
    void HandleProfileContinueClicked();

    UFUNCTION()
    void HandlePlayClicked();

    FText GetSectionTitle() const;
    FText GetSectionDescription() const;

    UPROPERTY(Transient)
    TObjectPtr<UEditableTextBox> ProfileNameInput;

    UPROPERTY(Transient)
    TObjectPtr<UTextBlock> ProfileStatusText;

    UPROPERTY(Transient)
    TObjectPtr<UTextBlock> SectionTitleText;

    UPROPERTY(Transient)
    TObjectPtr<UTextBlock> SectionDescriptionText;

    UPROPERTY(Transient)
    TObjectPtr<UButton> PlayButton;

    UPROPERTY(Transient)
    EFrontierMainMenuSection ActiveSection = EFrontierMainMenuSection::Explore;
};
