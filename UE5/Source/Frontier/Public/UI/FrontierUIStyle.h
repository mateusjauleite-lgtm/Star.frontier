#pragma once

#include "CoreMinimal.h"

class UBorder;
class UButton;
class UTextBlock;

/**
 * Shared visual language for native Star Frontier UMG widgets.
 * Values mirror the legacy web palette without depending on CSS or Slate assets.
 */
class FRONTIER_API FFrontierUIStyle
{
public:
    static const FLinearColor& Background();
    static const FLinearColor& Panel();
    static const FLinearColor& PanelEmphasis();
    static const FLinearColor& ControlSurface();
    static const FLinearColor& Primary();
    static const FLinearColor& Secondary();
    static const FLinearColor& Text();
    static const FLinearColor& MutedText();
    static const FLinearColor& Accent();
    static const FLinearColor& Positive();
    static const FLinearColor& Warning();

    static void ApplyPanel(UBorder* Border, bool bEmphasized = false);
    static void ApplyHeading(UTextBlock* TextBlock);
    static void ApplyBody(UTextBlock* TextBlock);
    static void ApplyButton(UButton* Button, bool bPrimary = false);
};
