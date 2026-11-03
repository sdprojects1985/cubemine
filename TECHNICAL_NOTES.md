# Cubemine

The original cube-only Minesweeper prototype, with Random as the default and a separate fixed puzzle campaign. The original green square tiles, six-face topology, CSS 3D presentation, drag sensitivity, zoom range and cube unfold view are retained. Rotation now follows screen axes, and numbers remain upright. The experimental non-cube shapes and their geometry download have been removed.

## Random

Easy has 4 × 4 cells per face and 12 mines; Classic has 6 × 6 and 36 mines; Expert has 8 × 8 and 76 mines. The first revealed cell and all of its touching neighbors are safe. Flags, zero-region opening, chording across cube seams, win/loss handling, and the timer follow the original rules. Random boards may require guessing, as in classic Minesweeper; the no-guessing guarantee applies to Puzzles.

## Puzzles

Twelve literal, precalculated cube layouts form four chapters:

1. Around the cube: three cube puzzles with visible clusters of starting clues.
2. Read the lines: outside numbers count mines in a row or column on one face.
3. In one piece: `{n}` means all neighboring mines form one consecutive run.
4. Mind the gaps: `-n-` means the neighboring mines form at least two separate groups.

The introductory puzzles start with three revealed clues together on one face; later levels start with two clues and line totals. The final puzzle is a full 8 × 8 cube. New layouts use new IDs; the three introductory puzzles retain their mine positions and progress IDs, with improved starting clusters. Progress, elapsed time, hints, mistakes, and completion save on the device. Incorrect reveals or flags count a mistake without ending a puzzle or placing a false flag. Restart restores the exact fixed board.

### What consecutive means on the cube

Each cell's seven or eight neighbors form a physical, edge-connected ring around it. Braces require a single unbroken run in that ring; the run may wrap around its end or cross a cube seam. Dashes forbid a single run but still allow adjacent mines within multiple groups. Ordinary numbers provide only a count. Special symbols appear only when their own safe cell is revealed.

Tap a revealed clue to inspect its clockwise neighbor ring. The strip's first and last positions touch. Tap a neighbor in the strip to locate it on the cube.

A visible 0 is drawn explicitly in Puzzles and can be clicked to open its safe neighbors. Random keeps the original blank-zero appearance.

### Line clues

Line numbers appear outside the row or column they describe, include flagged mines, and stop at the face edge. Underlined face buttons identify faces with line clues. In 3D, selecting a face brings it straight toward the player and shows its outside clues; rotating hides those labels to keep the cube uncluttered. Unfold shows every line clue with extra space between faces. Selecting a line number highlights its cells and explains the scope.

### No-guessing verification

`scripts/curate-puzzles.mjs` searches at authoring time, then writes literal mine IDs, givens, special-clue kinds, and line totals to `dist/puzzles.mjs`. The browser never generates a puzzle's mine layout.

Every shipped puzzle has a complete deduction path using only visible clues, established flags, and the total mine count. The verifier first receives a player-evidence snapshot with covered numbers, unopened special clues, and all mine booleans removed. It uses direct counts, subset subtraction, and the intersection of all locally valid arrangements for special clues. It never derives or uses face totals from the mine layout. It does not guess or backtrack on hidden mines. A complete path proves every safe cell and determines the mine layout.

Every fresh puzzle also has a separate opening check: the starting camera face must contain a provable move using only the revealed clues and line totals visible on that face. The camera uses this verified opening instead of centering the first given. A regression test rejects the former opening with an isolated 1 on the Right face.

Chapter tests also remove the introduced information: the line chapter cannot complete without line clues, the consecutive chapter cannot complete without its special clues, and the separated-group chapter cannot complete without its dashed clues under the same deduction rules. This ensures that the additional mechanics participate in the intended solution.

The optional Show a deduction button uses that same evidence-only engine, highlights the next provable cells, and explains why they are safe or mined. Tests change every hidden mine and hidden number at every step in every solution and confirm that the next hint remains identical.

## Controls

Spanish is the default language. The header selector switches between Español and English without creating a new board, resetting the camera, or clearing progress. The preference is stored separately as `cubemine-language-v1`; blocked storage falls back gracefully. Rules, puzzle names and briefs, deduction explanations, face navigation, announcements, and accessible labels are translated. Puzzle IDs and layouts are language independent.

- Drag to rotate relative to the screen: right moves the facing surface right, down moves it down, regardless of the current face or an upside-down orientation. Wheel or +/− to zoom. Rotation never recalculates zoom or auto-fits the camera.
- Numbers, special clues, line totals, flags, mines and incorrect-flag symbols are drawn directly on their buttons. Each mark rotates within the face to keep its vertical direction readable. The face supplies its tilt, perspective, clipping and back-face visibility. In Unfold, each mark returns to its ordinary reading orientation.
- Click to reveal. Right-click, Shift-click, touch-and-hold, or Flag mode marks a mine.
- Click a revealed number after flagging its mines to open its remaining neighbors.
- Face buttons focus the six sides; Unfold shows the connected cube net.
- F toggles flag mode; N starts a new random game or restarts a puzzle; H resets the camera. Arrow keys rotate outside the board or navigate tiles when a tile is focused. Tab from a face button enters that face; Enter/Space acts.

## Source and verification

- `dist/engine.mjs`: original random game and fixed puzzle sessions.
- `dist/shapes.mjs`: cube geometry, physical neighbor rings, and face-local line scopes.
- `dist/puzzle-rules.mjs`: consecutive-ring rules and possible local arrangements.
- `dist/deduction.mjs`: player-evidence snapshots, deductions, opening visibility checks, and full proof playback.
- `scripts/repair-openings.mjs`: authors clear introductory clusters and verifies starting faces without changing mine positions.
- `dist/puzzles.mjs`: twelve fixed levels, chapter metadata, and clue data.
- `dist/i18n.mjs`: complete Spanish and English catalogs, formatting, and language preference.
- `dist/camera.mjs` calculates screen-relative cube rotations, shortest-arc face transitions and the reading angle at each mark. It uses the cube orientation and perspective origin from the same frame. The angle aligns a vertical stroke through the mark’s center with screen vertical.
- `dist/markings.mjs` renders a mark as a child of the button that owns it. A two-dimensional CSS rotation keeps the mark in the face plane, so its apparent width and height change with the tile’s perspective. Each button handles input and supplies the accessible description.
- `dist/app.mjs`, `dist/index.html`, `dist/styles.css`: original cube interface with mode selection, puzzle progression, line clues, and clue inspection.

Run `npm test`. All 47 checks passed for this export, including 37 game and localization checks, eight camera and marking checks, and two HTTP hosting checks. The camera suite projects finite strokes on the cube to check reading direction during tumbles and zooms, sideways foreshortening, and consistent markup for clues, flags and mines. It also exercises 20,000 rotation steps for scale drift and verifies shortest-arc animation. The game suite covers all twelve solve paths, meaningful rule use, hidden-data independence, progress restoration and identical proofs in both languages. `npm run check` passed module syntax and relative asset-path validation.

Browser and device review is pending because the preview service was unavailable for this update. Inspect a numbered tile, a flag and a revealed mine while turning a face sideways and rolling the cube. Each should follow the tile’s perspective while keeping its reading direction. Check special clues and line totals, then switch between Cube and Unfold.

## Hosting

Buildless static site with no runtime dependencies. GitHub Pages deploys the contents of `dist/` using `.github/workflows/pages.yml`. All runtime asset paths are relative, so the game works at a repository subpath. Hosting-specific configuration and Git history are excluded from this export.

The browser prototype is the signed-off design baseline. The planned UE 5.8.4 production version, enhanced audiovisual feedback, adventure unlocks, stars, achievements, time trials, leaderboards, and secrets are future work; they are not implemented in this prototype. Public play does not require making the source repository public.
