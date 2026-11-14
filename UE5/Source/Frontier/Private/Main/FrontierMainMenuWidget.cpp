#include "Main/FrontierMainMenuWidget.h"

#include "UI/FrontierUIStyle.h"
#include "Blueprint/WidgetTree.h"
#include "Components/Border.h"
#include "Components/Button.h"
#include "Components/CanvasPanel.h"
#include "Components/CanvasPanelSlot.h"
#include "Components/EditableTextBox.h"
#include "Components/HorizontalBox.h"
#include "Components/HorizontalBoxSlot.h"
#include "Components/SizeBox.h"
#include "Components/SafeZone.h"
#include "Components/TextBlock.h"
#include "Components/VerticalBox.h"
#include "Components/VerticalBoxSlot.h"

namespace
{
    UTextBlock* MakeMenuText(UWidgetTree* Tree, const FText& Text, bool bHeading)
    {
        UTextBlock* Result = Tree->ConstructWidget<UTextBlock>();
        Result->SetText(Text);
        if (bHeading)
        {
            FFrontierUIStyle::ApplyHeading(Result);
        }
        else
        {
            FFrontierUIStyle::ApplyBody(Result);
        }
        return Result;
    }

    UButton* MakeMenuButton(UWidgetTree* Tree, const FText& Label, bool bPrimary = false)
    {
        UButton* Button = Tree->ConstructWidget<UButton>();
        UTextBlock* Text = MakeMenuText(Tree, Label, true);
        Text->SetJustification(ETextJustify::Center);
        Button->AddChild(Text);
        FFrontierUIStyle::ApplyButton(Button, bPrimary);
        return Button;
    }

    UVerticalBoxSlot* AddVertical(UVerticalBox* Parent, UWidget* Child,
        const FMargin& Padding = FMargin(0.0f), EVerticalAlignment Alignment = VAlign_Fill)
    {
        UVerticalBoxSlot* Slot = Parent->AddChildToVerticalBox(Child);
        Slot->SetPadding(Padding);
        Slot->SetVerticalAlignment(Alignment);
        return Slot;
    }
}

void UFrontierMainMenuWidget::NativeConstruct()
{
    Super::NativeConstruct();
    BuildNativeLayout();
    RefreshSectionContent();
}

void UFrontierMainMenuWidget::BuildNativeLayout()
{
    if (!WidgetTree || WidgetTree->RootWidget) return;

    UCanvasPanel* Canvas = WidgetTree->ConstructWidget<UCanvasPanel>();
    WidgetTree->RootWidget = Canvas;

    UBorder* Background = WidgetTree->ConstructWidget<UBorder>();
    Background->SetBrushColor(FFrontierUIStyle::Background());
    UCanvasPanelSlot* BackgroundSlot = Canvas->AddChildToCanvas(Background);
    BackgroundSlot->SetAnchors(FAnchors(0.0f, 0.0f, 1.0f, 1.0f));
    BackgroundSlot->SetOffsets(FMargin(0.0f));

    USafeZone* SafeZone = WidgetTree->ConstructWidget<USafeZone>();
    Background->SetContent(SafeZone);

    UVerticalBox* MainColumn = WidgetTree->ConstructWidget<UVerticalBox>();
    SafeZone->SetContent(MainColumn);
    Background->SetPadding(FMargin(28.0f, 22.0f));

    UTextBlock* Brand = MakeMenuText(
        WidgetTree, FText::FromString(TEXT("STAR FRONTIER")), true);
    AddVertical(MainColumn, Brand, FMargin(0.0f, 0.0f, 0.0f, 4.0f));

    UTextBlock* Tagline = MakeMenuText(
        WidgetTree,
        FText::FromString(TEXT("EXPLORAÇÃO  •  CIÊNCIA  •  NOVAS FRONTEIRAS")),
        false);
    AddVertical(MainColumn, Tagline, FMargin(0.0f, 0.0f, 0.0f, 18.0f));

    UBorder* ProfilePanel = WidgetTree->ConstructWidget<UBorder>();
    FFrontierUIStyle::ApplyPanel(ProfilePanel, true);
    AddVertical(MainColumn, ProfilePanel, FMargin(0.0f, 0.0f, 0.0f, 16.0f));

    UHorizontalBox* ProfileRow = WidgetTree->ConstructWidget<UHorizontalBox>();
    ProfilePanel->SetContent(ProfileRow);

    UTextBlock* ProfileLabel = MakeMenuText(
        WidgetTree, FText::FromString(TEXT("IDENTIFICAÇÃO DO EXPLORADOR")), true);
    UHorizontalBoxSlot* LabelSlot = ProfileRow->AddChildToHorizontalBox(ProfileLabel);
    LabelSlot->SetVerticalAlignment(VAlign_Center);
    LabelSlot->SetPadding(FMargin(0.0f, 0.0f, 14.0f, 0.0f));

    ProfileNameInput = WidgetTree->ConstructWidget<UEditableTextBox>();
    ProfileNameInput->SetHintText(FText::FromString(TEXT("Digite seu nome de exibição")));
    ProfileNameInput->SetIsPassword(false);
    UHorizontalBoxSlot* InputSlot = ProfileRow->AddChildToHorizontalBox(ProfileNameInput);
    InputSlot->SetSize(FSlateChildSize(ESlateSizeRule::Fill));
    InputSlot->SetPadding(FMargin(0.0f, 0.0f, 12.0f, 0.0f));

    UButton* ContinueButton = MakeMenuButton(
        WidgetTree, FText::FromString(TEXT("CONFIRMAR")), true);
    ContinueButton->OnClicked.AddDynamic(
        this, &UFrontierMainMenuWidget::HandleProfileContinueClicked);
    UHorizontalBoxSlot* ContinueSlot = ProfileRow->AddChildToHorizontalBox(ContinueButton);
    ContinueSlot->SetSize(FSlateChildSize(ESlateSizeRule::Automatic));
    ContinueSlot->SetVerticalAlignment(VAlign_Center);

    ProfileStatusText = MakeMenuText(
        WidgetTree,
        FText::FromString(TEXT("Nome de exibição local. Nenhuma conta ou senha é criada.")),
        false);
    AddVertical(MainColumn, ProfileStatusText, FMargin(0.0f, 8.0f, 0.0f, 0.0f));

    UHorizontalBox* MainContent = WidgetTree->ConstructWidget<UHorizontalBox>();
    UVerticalBoxSlot* ContentSlot = AddVertical(
        MainColumn, MainContent, FMargin(0.0f, 4.0f, 0.0f, 0.0f));
    ContentSlot->SetSize(FSlateChildSize(ESlateSizeRule::Fill));

    UVerticalBox* Navigation = WidgetTree->ConstructWidget<UVerticalBox>();
    USizeBox* NavigationWidth = WidgetTree->ConstructWidget<USizeBox>();
    NavigationWidth->SetWidthOverride(214.0f);
    NavigationWidth->SetContent(Navigation);
    UHorizontalBoxSlot* NavigationSlot =
        MainContent->AddChildToHorizontalBox(NavigationWidth);
    NavigationSlot->SetPadding(FMargin(0.0f, 0.0f, 16.0f, 0.0f));

    const TPair<EFrontierMainMenuSection, FText> NavigationItems[] =
    {
        { EFrontierMainMenuSection::Explore, FText::FromString(TEXT("EXPLORAR")) },
        { EFrontierMainMenuSection::Story, FText::FromString(TEXT("HISTÓRIA")) },
        { EFrontierMainMenuSection::Character, FText::FromString(TEXT("PERSONAGEM")) },
        { EFrontierMainMenuSection::Ships, FText::FromString(TEXT("NAVES")) },
        { EFrontierMainMenuSection::Store, FText::FromString(TEXT("LOJA")) },
        { EFrontierMainMenuSection::Settings, FText::FromString(TEXT("CONFIGURAÇÕES")) }
    };

    for (const TPair<EFrontierMainMenuSection, FText>& Item : NavigationItems)
    {
        UButton* NavigationButton = MakeMenuButton(WidgetTree, Item.Value);
        const EFrontierMainMenuSection TargetSection = Item.Key;
        NavigationButton->OnClicked.AddLambda([this, TargetSection]()
        {
            SelectSection(TargetSection);
        });
        AddVertical(Navigation, NavigationButton, FMargin(0.0f, 0.0f, 0.0f, 8.0f));
    }

    UBorder* DetailPanel = WidgetTree->ConstructWidget<UBorder>();
    FFrontierUIStyle::ApplyPanel(DetailPanel);
    UHorizontalBoxSlot* DetailSlot = MainContent->AddChildToHorizontalBox(DetailPanel);
    DetailSlot->SetSize(FSlateChildSize(ESlateSizeRule::Fill));

    UVerticalBox* DetailColumn = WidgetTree->ConstructWidget<UVerticalBox>();
    DetailPanel->SetContent(DetailColumn);

    SectionTitleText = MakeMenuText(WidgetTree, FText::GetEmpty(), true);
    AddVertical(DetailColumn, SectionTitleText, FMargin(0.0f, 0.0f, 0.0f, 14.0f));

    SectionDescriptionText = MakeMenuText(WidgetTree, FText::GetEmpty(), false);
    AddVertical(DetailColumn, SectionDescriptionText, FMargin(0.0f, 0.0f, 0.0f, 18.0f));

    PlayButton = MakeMenuButton(
        WidgetTree, FText::FromString(TEXT("INICIAR EXPLORAÇÃO")), true);
    PlayButton->OnClicked.AddDynamic(this, &UFrontierMainMenuWidget::HandlePlayClicked);
    AddVertical(DetailColumn, PlayButton, FMargin(0.0f, 12.0f, 0.0f, 0.0f));

    UTextBlock* Footer = MakeMenuText(
        WidgetTree,
        FText::FromString(TEXT("STAR FRONTIER  |  INTERFACE NATIVA UNREAL ENGINE")),
        false);
    AddVertical(MainColumn, Footer, FMargin(0.0f, 18.0f, 0.0f, 0.0f));
}

void UFrontierMainMenuWidget::SelectSection(EFrontierMainMenuSection Section)
{
    ActiveSection = Section;
    RefreshSectionContent();
    OnSectionChanged(ActiveSection);
}

void UFrontierMainMenuWidget::SetProfileNameHint(const FText& Hint)
{
    if (ProfileNameInput)
    {
        ProfileNameInput->SetHintText(Hint);
    }
}

void UFrontierMainMenuWidget::RefreshSectionContent()
{
    if (SectionTitleText)
    {
        SectionTitleText->SetText(GetSectionTitle());
    }
    if (SectionDescriptionText)
    {
        SectionDescriptionText->SetText(GetSectionDescription());
    }
    if (PlayButton)
    {
        PlayButton->SetVisibility(
            ActiveSection == EFrontierMainMenuSection::Explore
                ? ESlateVisibility::Visible
                : ESlateVisibility::Collapsed);
    }
}

FText UFrontierMainMenuWidget::GetSectionTitle() const
{
    switch (ActiveSection)
    {
    case EFrontierMainMenuSection::Explore:
        return FText::FromString(TEXT("PRONTO PARA EXPLORAR?"));
    case EFrontierMainMenuSection::Story:
        return FText::FromString(TEXT("HISTÓRIA"));
    case EFrontierMainMenuSection::Character:
        return FText::FromString(TEXT("PERSONAGEM"));
    case EFrontierMainMenuSection::Ships:
        return FText::FromString(TEXT("FROTA E EXPLORAÇÃO"));
    case EFrontierMainMenuSection::Store:
        return FText::FromString(TEXT("LOJA"));
    case EFrontierMainMenuSection::Settings:
        return FText::FromString(TEXT("CONFIGURAÇÕES"));
    default:
        return FText::FromString(TEXT("STAR FRONTIER"));
    }
}

FText UFrontierMainMenuWidget::GetSectionDescription() const
{
    switch (ActiveSection)
    {
    case EFrontierMainMenuSection::Explore:
        return FText::FromString(TEXT("Entre no universo Star Frontier. A experiência começa na ponte de comando, no Deck 1 da nave de exploração."));
    case EFrontierMainMenuSection::Story:
        return FText::FromString(TEXT("O painel de história está reservado para a integração do sistema narrativo. Nenhum conteúdo fictício foi adicionado."));
    case EFrontierMainMenuSection::Character:
        return FText::FromString(TEXT("A personalização será conectada ao Character Core, que continuará responsável pelo modelo, equipamento e estado do personagem."));
    case EFrontierMainMenuSection::Ships:
        return FText::FromString(TEXT("A frota será conectada ao Ship Core. Identidade, comandante, interiores, decks e controles permanecem sob responsabilidade desse Core."));
    case EFrontierMainMenuSection::Store:
        return FText::FromString(TEXT("A loja aguardará a implementação dos sistemas de economia e inventário. Este painel não realiza compras nem altera créditos."));
    case EFrontierMainMenuSection::Settings:
        return FText::FromString(TEXT("As opções de vídeo, áudio e sensibilidade serão conectadas às configurações nativas da Unreal e ao perfil do jogador."));
    default:
        return FText::GetEmpty();
    }
}

void UFrontierMainMenuWidget::HandleProfileContinueClicked()
{
    if (!ProfileNameInput || !ProfileStatusText) return;

    FString DisplayName = ProfileNameInput->GetText().ToString();
    DisplayName.TrimStartAndEndInline();
    if (DisplayName.IsEmpty())
    {
        ProfileStatusText->SetText(
            FText::FromString(TEXT("Digite um nome de exibição para continuar.")));
        ProfileStatusText->SetColorAndOpacity(
            FSlateColor(FFrontierUIStyle::Warning()));
        return;
    }

    ProfileStatusText->SetText(
        FText::FromString(TEXT("Identificação local pronta. A autenticação de conta ainda não está implementada.")));
    ProfileStatusText->SetColorAndOpacity(
        FSlateColor(FFrontierUIStyle::Positive()));
    OnProfileNameSubmitted(FText::FromString(DisplayName));
}

void UFrontierMainMenuWidget::HandlePlayClicked()
{
    OnPlayRequested();
}
