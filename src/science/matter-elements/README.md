# Matter & Elements Core

Independent scientific registry for chemical elements, minerals/crystals, metals/alloys, gases/compounds, isotopes and subatomic particles.

## Boundaries
- Owns canonical scientific records and their relationships.
- Does not import Ship Computer, AURORA OS, gameplay, rendering, inventory or engineering systems.
- Consumer systems query the public API; they must not maintain competing copies of scientific definitions.
- Composition-weighted values are estimates, not thermodynamic or phase-equilibrium simulations.

## API
- `get(id)`: retrieve one record.
- `list({ category, tag, state })`: filter records.
- `search(text, { category, limit })`: search names, symbols, formulas, descriptions and tags.
- `findByElement(elementId)`: find materials and isotopes associated with an element.
- `analyzeComposition([{ elementId, fraction }])`: normalize composition and return transparent weighted estimates.
- `getRelations(id)`: resolve compositional and declared relationships.

## Initial dataset
This is a curated starter catalog, not a complete periodic table or exhaustive mineral database. Values are reference values; future high-fidelity simulation should add source provenance, uncertainty and temperature/pressure conditions.
