# Legacy Web UI → Unreal Engine 5 migration

Status: **audited; migration specification committed; UI runtime conversion not yet complete**.

This document records the actual legacy interface in `index.html`, `style.css`, `src/main.js`, `vite.config.js` and `capacitor.config.json`. The root web files are preserved as reference material. They are not loaded by the UE5 game.

## Decision by file

| Legacy file | UE5 decision | Action |
|---|---|---|
| `index.html` | Do not load HTML in the game | Preserve as the screen/layout and interaction inventory. Rebuild its screens with UMG. |
| `style.css` | CSS is not a UE runtime styling system | Recreate its palette, spacing, borders and responsive layout with UMG/Slate styles and project assets. |
| `src/main.js` | Do not run browser/Three.js code in UE5 | Port behavior into the owning C++ Core, Actor Components, Subsystems, PlayerController and UMG widgets. |
| `vite.config.js` | No UE5 equivalent | Keep only for the legacy Vite build. |
| `package.json` | No UE5 runtime role | Keep dependencies/scripts isolated to legacy web/Capacitor workflows. |
| `capacitor.config.json` | Capacitor is replaced by Unreal Android packaging | Preserve app identity and relevant Android presentation settings in UE project settings. |
| `android/` | Not the final Android app shell | UE5 BuildCookRun produces the Android package. Keep the old folder only for historical comparison. |

### Android identity and presentation

The legacy Capacitor app uses:
- App ID: `com.mateus.starfrontier`
- Display name: `Star Frontier`
- Background/status-bar colour: `#030b18`
- `webDir: dist` and the StatusBar plugin are web-wrapper settings and do not carry over.

UE5's `Config/DefaultEngine.ini` already sets the Android package name to `com.mateus.starfrontier`. Keep this identifier stable so future Android installs/updates retain the same package identity. Recreate the startup/background and status-bar presentation using Unreal Android/project settings after checking the actual UE 5.8 setting names in Editor; do not copy Capacitor plugin keys into Unreal config.

## Screens and native UE5 destinations

| Legacy screen / HTML IDs | UE5 destination | Status |
|---|---|---|
| Login: `login-screen`, `login-name`, `login-pass`, `login-email`, `country`, `login-btn`, `forgot-btn` | `WBP_FrontierProfileEntry` (UMG), backed by a future profile/account service | Not implemented. The old password field is **not real authentication**: legacy JS only checks that name/password are non-empty and stores a local profile. Do not present it as secure login or store a plaintext password. |
| Main menu: `menu-screen`, `menu-credits`, `panel-content`, `data-panel` | `WBP_FrontierMainMenu` (UMG) + game-instance/profile state | Not implemented. |
| Menu panels: play, story, character, ships, shop, settings | Separate UMG panel widgets or data-driven menu entries; gameplay/economy logic stays in its owning systems | Content inventory captured; panel widgets and backend systems remain outstanding. |
| Character HUD: `character-hud`, movement/look/action/elevator controls | `UFrontierCharacterHUDWidget` | Native UMG C++ scaffold already exists. Preserve the independent left movement and right 360° look zones. |
| Character inventory: `inventory-modal`, `inventory-grid`, `inventory-clothing-view`, quick equipment slots | `WBP_FrontierInventory` (UMG) + Character inventory/equipment component | Not implemented as a dedicated UE widget. |
| Mission loading: `loading-screen`, progress/status IDs | `WBP_FrontierLoading` (UMG), driven by map/asset loading progress | Not implemented. Use actual load progress; do not fake a percentage timer. |
| Ship HUD: `hud`, `nitro-display`, `flight-controls`, `leave-pilot-btn` | `UFrontierShipHUDWidget` + Ship Core | Native UMG C++ scaffold already exists. Keep it hidden when the character is not piloting. |
| Pause/menu: `game-menu-modal`, resume/return buttons | `WBP_FrontierPauseMenu` (UMG) + PlayerController/GameMode flow | Not implemented. Returning to menu must first release the pilot terminal and restore the character to the deck. |
| NPC/toast: `npc-bubble`, `toast` | Reusable UMG notification/dialog widgets | Not implemented. |

## Behavior ownership from `src/main.js`

The legacy entry point is 1,568 lines and mixes DOM events, Three.js rendering and game rules. Do not translate it as one monolithic UE class.

| Legacy behavior | UE5 owner / destination |
|---|---|
| Profile name, credits, settings, inventory persistence (`state.js`, `storage.js`) | A profile/save-game layer (SaveGame object and a GameInstance/profile subsystem); no browser localStorage. |
| Login/menu screen switching and panel selection | Main menu/profile UMG widgets + PlayerController/GameInstance navigation flow. |
| Startup, loading and initial world entry | Main Core / `AFrontierGameMode` and level/asset loading; splash screen is separate from the in-game menu. |
| Character movement, camera, look, animation and interaction | Character Core; its state must not be duplicated in UI widgets. |
| Character ↔ pilot-seat transition | Existing Character Core / Ship Core bridge handoff. Preserve the rule that leaving the game menu cannot strand the character in ship-control mode. |
| Ship steering, throttle, brake, boost, camera and pilot exit | Ship Core and `UFrontierShipHUDWidget`; UI forwards input and does not own flight physics. |
| Ship computer terminal registration and telemetry | Ship Computer branch. |
| Asteroids, mining, cargo and station trading | Future Mining/Resource and Economy/Trading gameplay components or subsystems; not UMG code. |
| Story briefing and NPC dialog | Narrative/dialogue service plus reusable UMG presentation. |
| Character choice, rename, equipment and inventory | Character profile/presentation and inventory/equipment domain components. |
| Shop purchases and fuel/drill upgrades | Economy/inventory/ship equipment systems; validate currency and ownership outside widgets. |
| Graphics quality and sensitivity | UE scalability settings and Enhanced Input/player settings; persist through profile settings. |
| Toasts and notifications | Shared notification presenter; gameplay systems publish events rather than editing widgets directly. |

## Visual language to preserve

The CSS currently defines a dark navy science-fiction interface:
- Background: `#050914`; panels: dark navy translucent surfaces.
- Primary cyan: `#43d9ff`; blue: `#168bff`.
- Text: `#eaf6ff`; muted text: `#91a8bf`.
- Accent gold: `#ffc857`; health/positive green: `#54e6a0`; warning red: `#ff5b68`.
- Thin cyan-blue borders, compact uppercase labels, translucent panels and restrained glow.

Recreate these as shared UE5 Slate/UMG style resources rather than translating CSS selectors one by one. Use anchors/size boxes and safe-zone-aware layout instead of CSS media queries. Keep the mobile landscape layout usable on narrow screens; test touch targets and safe areas on device.

## Conversion order

1. **Shared UI theme and shell:** establish reusable colours, typography, panel/button styles, safe-zone rules and a single screen-navigation owner.
2. **Main menu/profile entry:** replace the local demo login with a profile flow that does not imply server authentication; create play/story/character/ships/shop/settings panels.
3. **Loading and pause:** bind loading to real UE level/asset progress; preserve the safe pilot-exit sequence.
4. **Inventory:** move item/equipment data into a Character-owned component and build a separate UMG view.
5. **Integration:** bind the existing character and ship HUDs to the same shared theme; do not merge their ownership.
6. **Gameplay systems:** port mining, station trade, economy, fuel and upgrades into gameplay systems before exposing them through menu buttons.
7. **Acceptance:** compile in UE 5.8, inspect every widget in UMG/Editor, test touch input and safe areas, then package and test on Android.

## Explicit non-goals

- Do not delete the root HTML/CSS/JS or legacy Vite/Capacitor workflow during this phase.
- Do not add new Three.js features or make Vite/Capacitor a dependency of the UE5 runtime.
- Do not claim the menu, inventory, login, loading screen or pause menu are migrated merely because a mapping document exists.
- Do not mark any widget complete until its native UMG implementation is committed and tested in Unreal Editor.
