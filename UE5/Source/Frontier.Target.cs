using UnrealBuildTool;
using System.Collections.Generic;

public class FrontierTarget : TargetRules
{
    public FrontierTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Game;
        DefaultBuildSettings = BuildSettingsVersion.V5;
        IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
        ExtraModuleNames.Add("Frontier");
    }
}
