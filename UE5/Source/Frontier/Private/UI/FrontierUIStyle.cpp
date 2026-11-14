#include "UI/FrontierUIStyle.h"

#include "Components/Border.h"
#include "Components/Button.h"
#include "Components/TextBlock.h"

namespace
{
    const FLinearColor ColorBackground(0.008f, 0.020f, 0.055f, 1.0f);
    const FLinearColor ColorPanel(0.018f, 0.045f, 0.090f, 0.94f);
    const FLinearColor ColorPanelEmphasis(0.025f, 0.105f, 0.155f, 0.96f);
    const FLinearColor ColorControlSurface(0.025f, 0.105f, 0.155f, 0.38f);
    const FLinearColor ColorPrimary(0.263f, 0.851f, 1.0f, 1.0f);
    const FLinearColor ColorSecondary(0.086f, 0.545f, 1.0f, 1.0f);
    const FLinearColor ColorText(0.918f, 0.965f, 1.0f, 1.0f);
    const FLinearColor ColorMutedText(0.569f, 0.659f, 0.749f, 1.0f);
    const FLinearColor ColorAccent(1.0f, 0.784f, 0.341f, 1.0f);
    const FLinearColor ColorPositive(0.329f, 0.902f, 0.627f, 1.0f);
    const FLinearColor ColorWarning(1.0f, 0.357f, 0.408f, 1.0f);
}

const FLinearColor& FFrontierUIStyle::Background() { return ColorBackground; }
const FLinearColor& FFrontierUIStyle::Panel() { return ColorPanel; }
const FLinearColor& FFrontierUIStyle::PanelEmphasis() { return ColorPanelEmphasis; }
const FLinearColor& FFrontierUIStyle::ControlSurface() { return ColorControlSurface; }
const FLinearColor& FFrontierUIStyle::Primary() { return ColorPrimary; }
const FLinearColor& FFrontierUIStyle::Secondary() { return ColorSecondary; }
const FLinearColor& FFrontierUIStyle::Text() { return ColorText; }
const FLinearColor& FFrontierUIStyle::MutedText() { return ColorMutedText; }
const FLinearColor& FFrontierUIStyle::Accent() { return ColorAccent; }
const FLinearColor& FFrontierUIStyle::Positive() { return ColorPositive; }
const FLinearColor& FFrontierUIStyle::Warning() { return ColorWarning; }

void FFrontierUIStyle::ApplyPanel(UBorder* Border, bool bEmphasized)
{
    if (!Border) return;
    Border->SetBrushColor(bEmphasized ? PanelEmphasis() : Panel());
    Border->SetPadding(FMargin(18.0f));
}

void FFrontierUIStyle::ApplyHeading(UTextBlock* TextBlock)
{
    if (!TextBlock) return;
    TextBlock->SetColorAndOpacity(FSlateColor(Text()));
    TextBlock->SetJustification(ETextJustify::Left);
    TextBlock->SetAutoWrapText(true);
}

void FFrontierUIStyle::ApplyBody(UTextBlock* TextBlock)
{
    if (!TextBlock) return;
    TextBlock->SetColorAndOpacity(FSlateColor(MutedText()));
    TextBlock->SetJustification(ETextJustify::Left);
    TextBlock->SetAutoWrapText(true);
}

void FFrontierUIStyle::ApplyButton(UButton* Button, bool bPrimary)
{
    if (!Button) return;
    Button->SetBackgroundColor(bPrimary ? Secondary() : PanelEmphasis());
    Button->SetColorAndOpacity(FLinearColor::White);
}
