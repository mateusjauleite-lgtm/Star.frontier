"""Create the four Star Frontier ship-deck Data Assets in Unreal Editor.

Run from Unreal Editor with the Frontier C++ module compiled and loaded:
    Tools > Execute Python Script
The script is idempotent: existing assets are updated rather than duplicated.
Mesh references and clearance bounds are intentionally left unset until the
final deck geometry is imported and measured.
"""
import unreal

DESTINATION = "/Game/StarFrontier/Ships/Decks"
DECKS = [
    {
        "asset": "DA_Deck01_Command",
        "enum": "DECK1_COMMAND",
        "code": "D1",
        "name": "Deck 1 - Ponte de Comando",
        "hangar_clear": False,
    },
    {
        "asset": "DA_Deck02_OperationsScience",
        "enum": "DECK2_OPERATIONSSCIENCE",
        "code": "D2",
        "name": "Deck 2 - Operações e Ciências",
        "hangar_clear": False,
    },
    {
        "asset": "DA_Deck03_Engineering",
        "enum": "DECK3_ENGINEERING",
        "code": "D3",
        "name": "Deck 3 - Engenharia",
        "hangar_clear": False,
    },
    {
        "asset": "DA_Deck04_HangarSupport",
        "enum": "DECK4_HANGARSUPPORT",
        "code": "D4",
        "name": "Deck 4 - Hangar e Suporte",
        "hangar_clear": True,
    },
]


def create_or_update_deck(deck):
    asset_path = DESTINATION + "/" + deck["asset"]
    asset = unreal.EditorAssetLibrary.load_asset(asset_path)

    if not asset:
        asset_class = unreal.load_class(
            None, "/Script/Frontier.FrontierShipDeckDefinition"
        )
        if not asset_class:
            raise RuntimeError(
                "UFrontierShipDeckDefinition não foi carregada. "
                "Compile o módulo Frontier e reabra o Editor."
            )
        factory = unreal.DataAssetFactory()
        factory.set_editor_property("data_asset_class", asset_class)
        tools = unreal.AssetToolsHelpers.get_asset_tools()
        asset = tools.create_asset(
            deck["asset"], DESTINATION, asset_class, factory
        )

    if not asset:
        raise RuntimeError("Falha ao criar/carregar " + asset_path)

    enum_type = unreal.EFrontierShipDeckId
    wanted = "".join(ch for ch in deck["enum"].upper() if ch.isalnum())
    enum_member = next(
        (
            getattr(enum_type, candidate)
            for candidate in dir(enum_type)
            if "".join(ch for ch in candidate.upper() if ch.isalnum()) == wanted
        ),
        None,
    )
    if enum_member is None:
        raise RuntimeError("Valor de DeckId não encontrado: " + deck["enum"])
    asset.set_editor_property("deck_id", enum_member)
    asset.set_editor_property("deck_code", deck["code"])
    asset.set_editor_property("display_name", unreal.Text(deck["name"]))
    asset.set_editor_property("local_offset", unreal.Vector(0.0, 0.0, 0.0))
    asset.set_editor_property("keep_hangar_exit_clear", deck["hangar_clear"])
    asset.set_editor_property("keep_elevator_access_clear", True)

    # Meshes and clearance boxes stay unassigned until the imported geometry
    # is measured. This avoids fabricated bounds that could hide real walls.
    asset.set_editor_property("floor_mesh", None)
    asset.set_editor_property("wall_segments", [])

    unreal.EditorAssetLibrary.save_loaded_asset(asset)
    unreal.log("Ship deck Data Asset ready: " + asset_path)


if not unreal.EditorAssetLibrary.does_directory_exist(DESTINATION):
    unreal.EditorAssetLibrary.make_directory(DESTINATION)

for deck_definition in DECKS:
    create_or_update_deck(deck_definition)

unreal.log("Star Frontier: all four deck Data Assets are ready.")
