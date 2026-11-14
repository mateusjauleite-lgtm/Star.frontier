using UnrealBuildTool;
using System.Collections.Generic;

public class FrontierEditorTarget : TargetRules
{
    public FrontierEditorTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Editor;
        DefaultBuildSettings = BuildSettingsVersion.V5;
        IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
        ExtraModuleNames.Add("Frontier");
    }
}
