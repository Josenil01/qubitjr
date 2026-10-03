# Graph Report - .  (2026-10-03)

## Corpus Check
- 6 files · ~124,535 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2000 nodes · 4584 edges · 86 communities (45 shown, 41 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Live Mirror (Teacher View)|Live Mirror (Teacher View)]]
- [[_COMMUNITY_Paint Editor Actions|Paint Editor Actions]]
- [[_COMMUNITY_Assignment Badge (Student)|Assignment Badge (Student)]]
- [[_COMMUNITY_Block Primitives (Runtime)|Block Primitives (Runtime)]]
- [[_COMMUNITY_Editor UI Core|Editor UI Core]]
- [[_COMMUNITY_NativeWeb Bridge|Native/Web Bridge]]
- [[_COMMUNITY_Block Model|Block Model]]
- [[_COMMUNITY_Sprite Engine|Sprite Engine]]
- [[_COMMUNITY_SVG Tools|SVG Tools]]
- [[_COMMUNITY_Geometry RectangleVector|Geometry: Rectangle/Vector]]
- [[_COMMUNITY_Gallery Restriction (Assignment)|Gallery Restriction (Assignment)]]
- [[_COMMUNITY_Generate Activity Modal|Generate Activity Modal]]
- [[_COMMUNITY_Stage Engine|Stage Engine]]
- [[_COMMUNITY_Project SaveLoad|Project Save/Load]]
- [[_COMMUNITY_ScratchJr App Core|ScratchJr App Core]]
- [[_COMMUNITY_iOS Native Bridge|iOS Native Bridge]]
- [[_COMMUNITY_Gallery Restriction Provider|Gallery Restriction Provider]]
- [[_COMMUNITY_SVG to Canvas|SVG to Canvas]]
- [[_COMMUNITY_Zero Block Defaults|Zero Block Defaults]]
- [[_COMMUNITY_Block Model (Core)|Block Model (Core)]]
- [[_COMMUNITY_Block Specs|Block Specs]]
- [[_COMMUNITY_Scripts Area UI|Scripts Area UI]]
- [[_COMMUNITY_Paint Editor Path|Paint Editor: Path]]
- [[_COMMUNITY_Paint Editor Ghost Preview|Paint Editor: Ghost Preview]]
- [[_COMMUNITY_Paint Editor Core|Paint Editor Core]]
- [[_COMMUNITY_Getting Started Entry|Getting Started Entry]]
- [[_COMMUNITY_Page Engine|Page Engine]]
- [[_COMMUNITY_SVG Matrix Transform|SVG Matrix Transform]]
- [[_COMMUNITY_Snap.svg (vendored)|Snap.svg (vendored)]]
- [[_COMMUNITY_SoundVideo Recording UI|Sound/Video Recording UI]]
- [[_COMMUNITY_DOM Event Utils|DOM Event Utils]]
- [[_COMMUNITY_LobbyProject List|Lobby/Project List]]
- [[_COMMUNITY_Paint Editor Layers|Paint Editor: Layers]]
- [[_COMMUNITY_DOM Helper Lib|DOM Helper Lib]]
- [[_COMMUNITY_Native IO Bridge|Native IO Bridge]]
- [[_COMMUNITY_Snap.svg Shim|Snap.svg Shim]]
- [[_COMMUNITY_Block Argument UI|Block Argument UI]]
- [[_COMMUNITY_Player (Shared Project Viewer)|Player (Shared Project Viewer)]]
- [[_COMMUNITY_Paint Editor Path Edge|Paint Editor: Path Edge]]
- [[_COMMUNITY_iOS Dispatcher|iOS Dispatcher]]
- [[_COMMUNITY_ScratchJr Core BlurFocus|ScratchJr Core: Blur/Focus]]
- [[_COMMUNITY_Scroll UI|Scroll UI]]
- [[_COMMUNITY_Geometry Rectangle|Geometry: Rectangle]]
- [[_COMMUNITY_Block Specs (Core)|Block Specs (Core)]]
- [[_COMMUNITY_SVG Image Handling|SVG Image Handling]]
- [[_COMMUNITY_App Entry Point|App Entry Point]]
- [[_COMMUNITY_Paint Editor Clear Workspace|Paint Editor: Clear Workspace]]
- [[_COMMUNITY_ScratchJr Core Selection|ScratchJr Core: Selection]]
- [[_COMMUNITY_Paint Editor Camera|Paint Editor: Camera]]
- [[_COMMUNITY_SVG Array Utils|SVG Array Utils]]
- [[_COMMUNITY_ScratchJr App Init|ScratchJr App Init]]
- [[_COMMUNITY_Samples Gallery|Samples Gallery]]
- [[_COMMUNITY_Paint Editor Back to Project|Paint Editor: Back to Project]]
- [[_COMMUNITY_JSZip Shim|JSZip Shim]]
- [[_COMMUNITY_Paint Editor Add Points|Paint Editor: Add Points]]
- [[_COMMUNITY_Paint Editor Path Relationship|Paint Editor: Path Relationship]]
- [[_COMMUNITY_PNG Cache|PNG Cache]]
- [[_COMMUNITY_Stream Shim|Stream Shim]]
- [[_COMMUNITY_Scripts Model|Scripts Model]]
- [[_COMMUNITY_Paint Editor Add Dot|Paint Editor: Add Dot]]

## God Nodes (most connected - your core abstractions)
1. `gn()` - 232 edges
2. `ScratchJr` - 116 edges
3. `Paint` - 113 edges
4. `SVG2Canvas` - 82 edges
5. `PaintAction` - 72 edges
6. `UI` - 69 edges
7. `newHTML()` - 64 edges
8. `Sprite` - 62 edges
9. `iOS` - 61 edges
10. `SVGTools` - 60 edges

## Surprising Connections (you probably didn't know these)
- `applyStageState()` --calls--> `gn()`  [EXTRACTED]
  src/app/src/editor/LiveMirror.js → src/app/src/utils/lib.js
- `applyUiState()` --calls--> `gn()`  [EXTRACTED]
  src/app/src/editor/LiveMirror.js → src/app/src/utils/lib.js
- `_findHoverElement()` --calls--> `gn()`  [EXTRACTED]
  src/app/src/editor/LiveMirror.js → src/app/src/utils/lib.js
- `_libraryScrollFraction()` --calls--> `gn()`  [EXTRACTED]
  src/app/src/editor/LiveMirror.js → src/app/src/utils/lib.js
- `gettingStartedMain()` --calls--> `getUrlVars()`  [EXTRACTED]
  src/app/src/entry/gettingstarted.js → src/app/src/utils/lib.js

## Import Cycles
- 3-file cycle: `src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Layer.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 3-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js`
- 3-file cycle: `src/app/src/iPad/IO.js -> src/app/src/lobby/Lobby.js -> src/app/src/lobby/Samples.js -> src/app/src/iPad/IO.js`
- 3-file cycle: `src/app/src/iPad/iOS.js -> src/app/src/lobby/Lobby.js -> src/app/src/lobby/Samples.js -> src/app/src/iPad/iOS.js`
- 3-file cycle: `src/app/src/iPad/IO.js -> src/app/src/lobby/Lobby.js -> src/app/src/utils/Localization.js -> src/app/src/iPad/IO.js`
- 3-file cycle: `src/app/src/iPad/IO.js -> src/app/src/iPad/MediaLib.js -> src/app/src/utils/Localization.js -> src/app/src/iPad/IO.js`
- 3-file cycle: `src/app/src/iPad/iOS.js -> src/app/src/utils/ScratchAudio.js -> src/app/src/utils/Sound.js -> src/app/src/iPad/iOS.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/editor/ui/Palette.js -> src/app/src/editor/blocks/Block.js -> src/app/src/editor/ScratchJr.js`
- 4-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 4-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 4-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 4-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 4-file cycle: `src/app/src/painteditor/Layer.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Layer.js`
- 4-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`

## Communities (86 total, 41 thin omitted)

### Community 0 - "Live Mirror (Teacher View)"
Cohesion: 0.05
Nodes (67): applyHoverTarget(), applyPageList(), applyStageState(), applyUiState(), buildMirrorPayload(), fakeTouchEvent(), _findHoverElement(), hideLockOverlay() (+59 more)

### Community 1 - "Paint Editor Actions"
Cohesion: 0.06
Nodes (17): apiFetch(), authHeader(), closeOverlay(), GenerateActivityModal, gotoEditor(), guessDefaultLevel(), Events, Home (+9 more)

### Community 3 - "Block Primitives (Runtime)"
Cohesion: 0.06
Nodes (4): hopList, Prims, Runtime, Thread

### Community 4 - "Editor UI Core"
Cohesion: 0.07
Nodes (18): apiFetch(), AssignmentBadge, authHeader(), blockBlinkEls, dismissedHintIds, recordHintEvent(), wrongValueAlerted, registerGalleryRestrictionProvider() (+10 more)

### Community 8 - "SVG Tools"
Cohesion: 0.06
Nodes (15): fontcolors, fontsizes, getshapes, loadassets, sendshapes, speeds, keys, MediaLib (+7 more)

### Community 11 - "Generate Activity Modal"
Cohesion: 0.10
Nodes (21): Vector, maskCanvas, maskData, offscreen, targetOffscreen, deltaPoint, initialPoint, pensizes (+13 more)

### Community 18 - "Zero Block Defaults"
Cohesion: 0.14
Nodes (19): onBackButtonCallback, workingCanvas, workingCanvas2, allCharactersAtLimit(), getGalleryRestriction(), isCharacterAtLimit(), showAssignmentToast(), useZeroBlockDefaults() (+11 more)

### Community 23 - "Paint Editor: Ghost Preview"
Cohesion: 0.14
Nodes (8): Alert, Grid, getStringSize(), newCanvas(), newDiv(), newP(), setProps(), writeText()

### Community 26 - "Page Engine"
Cohesion: 0.13
Nodes (10): gettingStartedMain(), homeMain(), homeStrings(), inappAbout(), inappBlocksGuide(), inappInterfaceGuide(), inappPaintEditorGuide(), setClassOfElementById() (+2 more)

### Community 28 - "Snap.svg (vendored)"
Cohesion: 0.11
Nodes (22): colorToRGBA(), css_vh(), css_vw(), drawThumbnail(), ensureEditorFrames(), fitInRect(), getFit(), getHex() (+14 more)

### Community 30 - "DOM Event Utils"
Cohesion: 0.32
Nodes (26): a(), b(), c(), d(), e(), f(), g(), h() (+18 more)

### Community 36 - "Block Argument UI"
Cohesion: 0.09
Nodes (3): SnapElement, SnapPaper, SnapShim

### Community 37 - "Player (Shared Project Viewer)"
Cohesion: 0.18
Nodes (7): Menu, pinchcenter, globalx(), globaly(), hit3DRect(), localx(), localy()

### Community 40 - "iOS Dispatcher"
Cohesion: 0.22
Nodes (10): applyScratchJrPlayerPatches(), applyPagePlayerPatches(), applySpritePlayerPatches(), applyStagePlayerPatches(), EMOJIS, LABELS, playerMain(), _prefetchMedia() (+2 more)

### Community 59 - "Paint Editor: Camera"
Cohesion: 0.27
Nodes (9): CARET_TYPES, compareManifests(), computeProjectManifest(), DATA_REPRESENTATION_TYPES, emptyManifest(), NUMERIC_ARG_TYPES, SYNC_TIER2_TYPES, TRIGGER_TYPES (+1 more)

### Community 66 - "JSZip Shim"
Cohesion: 0.52
Nodes (3): apiFetch(), AssignmentNotice, authHeader()

### Community 71 - "Paint Editor: Path Relationship"
Cohesion: 0.29
Nodes (3): Readable, Transform, Writable

### Community 72 - "PNG Cache"
Cohesion: 0.38
Nodes (6): CARET_TYPES, computeDetailedManifest(), emptyManifest(), NUMERIC_ARG_TYPES, SPEED_LABELS, walkScript()

### Community 73 - "Stream Shim"
Cohesion: 0.40
Nodes (6): indexFirstTime(), indexLoadOptions(), indexLoadStart(), indexLoadUsage(), indexMain(), indexSetUsage()

## Knowledge Gaps
- **56 isolated node(s):** `_lastSpriteIds`, `loadassets`, `fontcolors`, `fontsizes`, `getshapes` (+51 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **41 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `gn()` connect `Page Engine` to `Live Mirror (Teacher View)`, `Paint Editor Actions`, `Assignment Badge (Student)`, `Block Primitives (Runtime)`, `Block Model`, `SVG Tools`, `Gallery Restriction (Assignment)`, `Generate Activity Modal`, `Stage Engine`, `Zero Block Defaults`, `Paint Editor: Path`, `Paint Editor: Ghost Preview`, `Paint Editor Core`, `Getting Started Entry`, `SVG Matrix Transform`, `Snap.svg (vendored)`, `Sound/Video Recording UI`, `Lobby/Project List`, `Paint Editor: Layers`, `DOM Helper Lib`, `Native IO Bridge`, `Player (Shared Project Viewer)`, `Assignment Author Bar (Teacher)`, `ScratchJr Core: Blur/Focus`, `Paint Editor: Path Sections`, `Paint Editor: Shape Position`, `SVG Image Handling`, `Grid UI`, `App Entry Point`, `Paint Editor: Delete Dot`, `SVG Path Closing`, `Paint Editor: Image Import`, `ScratchJr Core: Selection`, `ScratchJr App Init`, `Time Tracking Util`, `JSZip Shim`, `ScratchJr Entry`, `Assignment Notice (Lobby)`, `Paint Editor: Side Palette`, `Stream Shim`, `Detailed Manifest (shared)`, `App Usage Tracking`?**
  _High betweenness centrality (0.259) - this node is a cross-community bridge._
- **Why does `ScratchJr` connect `iOS Native Bridge` to `Live Mirror (Teacher View)`, `Block Primitives (Runtime)`, `Editor UI Core`, `Player (Shared Project Viewer)`, `iOS Dispatcher`, `Scripts Pane`, `Generate Activity Modal`, `Draw Path Util`, `Sound Playback`, `Zero Block Defaults`, `Paint Editor: Positioning`, `Paint Editor: Ghost Preview`, `Assignment Scoring (shared)`, `Samples Gallery`?**
  _High betweenness centrality (0.116) - this node is a cross-community bridge._
- **Why does `SVG2Canvas` connect `Gallery Restriction Provider` to `SVG Tools`, `Generate Activity Modal`, `Paint Editor: Clear Events`, `ScratchJr Core: Status Display`, `Zero Block Defaults`, `Paint Editor Undo`, `iOS Media Capture`, `Geometry: Matrix`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **What connects `_lastSpriteIds`, `loadassets`, `fontcolors` to the rest of the system?**
  _56 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Live Mirror (Teacher View)` be split into smaller, more focused modules?**
  _Cohesion score 0.052947052947052944 - nodes in this community are weakly interconnected._
- **Should `Paint Editor Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.05662862159789289 - nodes in this community are weakly interconnected._
- **Should `Assignment Badge (Student)` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._