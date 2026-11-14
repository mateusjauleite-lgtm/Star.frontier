# UE 5.8 Android build runner

## Purpose

The workflow `.github/workflows/android-apk.yml` packages the native Unreal project. It does not use Node, Vite, Three.js or Capacitor.\n\nStar Frontier is pinned to **Unreal Engine 5.8** in `UE5/StarFrontier.uproject`. The Android preflight rejects any other major/minor engine version, preventing a runner from silently packaging with a different UE release.

GitHub-hosted runners do not include the licensed Unreal Engine installation needed by this project. The workflow therefore targets a trusted, self-hosted **Windows x64** runner.

## 1. Prepare the Windows machine

1. Install the official stable Unreal Engine **5.8** release from the Epic Games Launcher or an approved source-code build.
2. Open `UE5/StarFrontier.uproject` with UE 5.8 and compile the Frontier C++ module. Resolve all compiler and plugin errors before treating the runner as build-ready.
3. In Unreal Editor, open **Platforms → SDK Management → Android → Install SDK** and complete the Turnkey prompts. Turnkey installs the Android Studio command-line tools and the SDK, NDK and JDK versions verified for that engine release.
4. Restart/log out and back in if Turnkey changed environment variables.
5. Generate and save the startup map by running `UE5/Tools/EditorPython/create_main_startup_map.py` in the Unreal Editor. Commit `UE5/Content/StarFrontier/Maps/L_StarFrontier_Main.umap`.
6. Run the local preflight script from the repository root:

   ```powershell
   .\UE5\Tools\CI\Validate-AndroidRunner.ps1
   ```

The preflight checks the Unreal Automation Tool, UnrealBuildTool, enforces UE 5.8 using engine version metadata, Java, Android SDK platform-tools, NDK metadata, project descriptor and startup map. It does not replace Unreal Turnkey's SDK compatibility validation.

## 2. Register the runner with GitHub

1. Open the repository **Settings → Actions → Runners → New self-hosted runner**.
2. Select **Windows** and **x64**, then follow GitHub's displayed download/configuration commands on the Windows machine.
3. During runner configuration, add these custom labels exactly:
   - `UnrealEngine5`
   - `Android`
4. Keep the runner in a trusted, access-controlled machine. Do not run untrusted pull-request code on a self-hosted machine that has credentials or access to other systems.
5. Install it as a service only after testing an interactive run and confirming the service account can access Unreal Engine and Android SDK folders.

The workflow uses the labels `self-hosted, Windows, X64, UnrealEngine5, Android`.

## 3. Configure repository Actions variables

Open **Settings → Secrets and variables → Actions → Variables** and add:

| Variable | Value |
|---|---|
| `UE_ROOT` | Unreal Engine 5.8 installation root, containing `Engine/Build/BatchFiles/RunUAT.bat` |
| `ANDROID_HOME` | Android SDK root installed/selected by Turnkey |
| `NDKROOT` | Android NDK directory compatible with UE 5.8 |
| `JAVA_HOME` | JDK directory compatible with UE 5.8 |

These are paths, not credentials, so repository Actions variables are appropriate. Never put signing keystores, passwords or private keys in these variables; release signing should use GitHub Secrets and a separate protected release workflow.

## 4. Run the build

Use **Actions → Build Star Frontier UE5 Android APK → Run workflow**. The job:

1. Validates the UE 5.8 toolchain and startup map.
2. Calls Unreal Automation Tool with `BuildCookRun` for Android Development.
3. Checks that an APK exists.
4. Uploads the APK as a workflow artifact for 14 days.

The first successful run is the acceptance gate for this pipeline. Until then, the workflow is configured but not proven.

## Version compatibility

Use the official stable UE 5.8 release and install its Android toolchain through Turnkey. Do not hard-code a generic Android Studio/SDK/NDK/JDK combination or reuse values from another Unreal release. Epic's UE 5.8 Android documentation lists target SDK 35, minimum compile SDK 34, NDK r27c, Build Tools 35.0.1 and OpenJDK 21.0.3; confirm the installed versions with UE 5.8 Turnkey before packaging.

References:
- [Android Quick Start](https://dev.epicgames.com/documentation/unreal-engine/android-quick-start)
- [Automated Android SDK, NDK, and JDK Setup](https://dev.epicgames.com/documentation/unreal-engine/automated-android-sdk-ndk-and-jdk-setup-in-unreal-engine)
- [Android Development Requirements](https://dev.epicgames.com/documentation/unreal-engine/android-development-requirements-for-unreal-engine)
- [GitHub: Adding self-hosted runners](https://docs.github.com/actions/hosting-your-own-runners/adding-self-hosted-runners)
