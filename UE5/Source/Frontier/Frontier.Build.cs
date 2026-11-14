using UnrealBuildTool;

public class Frontier : ModuleRules
{
    public Frontier(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
        PublicDependencyModuleNames.AddRange(new string[]
        {
            "Core",
            "CoreUObject",
            "Engine",
            "EnhancedInput",
            "UMG",
            "Slate",
            "SlateCore",
            "Niagara"
        });
    }
}
