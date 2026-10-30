# Graph Report - .  (2026-10-30)

## Corpus Check
- 91 files · ~141,535 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2050 nodes · 5188 edges · 93 communities (52 shown, 41 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 26 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Teacher Live Monitoring|Teacher Live Monitoring]]
- [[_COMMUNITY_Paint Editor Actions|Paint Editor Actions]]
- [[_COMMUNITY_Block Primitives Engine|Block Primitives Engine]]
- [[_COMMUNITY_Sprite Behavior|Sprite Behavior]]
- [[_COMMUNITY_Editor UI Shell|Editor UI Shell]]
- [[_COMMUNITY_Backend API Client|Backend API Client]]
- [[_COMMUNITY_Project Model & Hint Alignment|Project Model & Hint Alignment]]
- [[_COMMUNITY_Audio & Localization|Audio & Localization]]
- [[_COMMUNITY_SVG Drawing Tools|SVG Drawing Tools]]
- [[_COMMUNITY_Native Platform Bridge|Native Platform Bridge]]
- [[_COMMUNITY_ScratchJr App Core|ScratchJr App Core]]
- [[_COMMUNITY_Sprite Thumbnails|Sprite Thumbnails]]
- [[_COMMUNITY_SVG to Canvas Rendering|SVG to Canvas Rendering]]
- [[_COMMUNITY_Shared Player Patches|Shared Player Patches]]
- [[_COMMUNITY_Stage Rendering|Stage Rendering]]
- [[_COMMUNITY_Project Lobby|Project Lobby]]
- [[_COMMUNITY_Block Scripts Model|Block Scripts Model]]
- [[_COMMUNITY_Media Library Browser|Media Library Browser]]
- [[_COMMUNITY_Block Palette|Block Palette]]
- [[_COMMUNITY_Menus & Alerts|Menus & Alerts]]
- [[_COMMUNITY_Paint Vector Ops|Paint Vector Ops]]
- [[_COMMUNITY_Teacher Assignment Authoring|Teacher Assignment Authoring]]
- [[_COMMUNITY_Paint Ghost Preview|Paint Ghost Preview]]
- [[_COMMUNITY_Block Model|Block Model]]
- [[_COMMUNITY_Block Specs Lookup|Block Specs Lookup]]
- [[_COMMUNITY_Home Screen|Home Screen]]
- [[_COMMUNITY_Paint Editor Core|Paint Editor Core]]
- [[_COMMUNITY_Vector Path Model|Vector Path Model]]
- [[_COMMUNITY_Student Hint Badge UI|Student Hint Badge UI]]
- [[_COMMUNITY_Page Model|Page Model]]
- [[_COMMUNITY_Hint Engine Core|Hint Engine Core]]
- [[_COMMUNITY_DOM Helper Utilities|DOM Helper Utilities]]
- [[_COMMUNITY_Paint Transform Math|Paint Transform Math]]
- [[_COMMUNITY_Snap.svg Vendor Lib|Snap.svg Vendor Lib]]
- [[_COMMUNITY_Sound Recording|Sound Recording]]
- [[_COMMUNITY_PointerTouch Events|Pointer/Touch Events]]
- [[_COMMUNITY_Paint Layers|Paint Layers]]
- [[_COMMUNITY_Undo Stack|Undo Stack]]
- [[_COMMUNITY_Snap.svg Shim|Snap.svg Shim]]
- [[_COMMUNITY_Block Argument Model|Block Argument Model]]
- [[_COMMUNITY_Hint Engine Regression Tests|Hint Engine Regression Tests]]
- [[_COMMUNITY_Hint Poll Scheduling|Hint Poll Scheduling]]
- [[_COMMUNITY_Editor UI Helpers|Editor UI Helpers]]
- [[_COMMUNITY_Stage Grid Overlay|Stage Grid Overlay]]
- [[_COMMUNITY_Scripts Pane|Scripts Pane]]
- [[_COMMUNITY_Hint Expected-Sequence Tests|Hint Expected-Sequence Tests]]
- [[_COMMUNITY_Palette Scrolling|Palette Scrolling]]
- [[_COMMUNITY_Rectangle Geometry|Rectangle Geometry]]
- [[_COMMUNITY_Block Specs Data|Block Specs Data]]
- [[_COMMUNITY_SVG Image Loading|SVG Image Loading]]
- [[_COMMUNITY_Vector Math|Vector Math]]
- [[_COMMUNITY_Paint Undo History|Paint Undo History]]
- [[_COMMUNITY_Matrix Geometry|Matrix Geometry]]
- [[_COMMUNITY_Native Media Library Bridge|Native Media Library Bridge]]
- [[_COMMUNITY_Paint CameraZoom|Paint Camera/Zoom]]
- [[_COMMUNITY_Gallery Restriction|Gallery Restriction]]
- [[_COMMUNITY_Sample Projects|Sample Projects]]
- [[_COMMUNITY_Hint Badge (misc)|Hint Badge (misc)]]
- [[_COMMUNITY_Usage Time Tracking|Usage Time Tracking]]
- [[_COMMUNITY_JSZip Vendor Shim|JSZip Vendor Shim]]
- [[_COMMUNITY_Assignment Notices|Assignment Notices]]
- [[_COMMUNITY_PNG Cache|PNG Cache]]
- [[_COMMUNITY_Node Stream Shim|Node Stream Shim]]
- [[_COMMUNITY_Entry Scripts (misc)|Entry Scripts (misc)]]
- [[_COMMUNITY_Sound Playback|Sound Playback]]
- [[_COMMUNITY_Freehand Draw Path|Freehand Draw Path]]
- [[_COMMUNITY_SVG to Canvas (4)|SVG to Canvas (4)]]

## God Nodes (most connected - your core abstractions)
1. `gn()` - 338 edges
2. `newHTML()` - 124 edges
3. `ScratchJr` - 118 edges
4. `Paint` - 118 edges
5. `SVG2Canvas` - 84 edges
6. `PaintAction` - 72 edges
7. `UI` - 69 edges
8. `iOS` - 68 edges
9. `setProps()` - 66 edges
10. `Sprite` - 63 edges

## Surprising Connections (you probably didn't know these)
- `blockMatch()` --calls--> `evaluate()`  [INFERRED]
  src/app/src/editor/ui/HintEngine.js → src/app/src/editor/ui/hintAlignment.test.js
- `detailedFor()` --calls--> `Project`  [INFERRED]
  src/app/src/editor/ui/hintRegressions.test.js → src/app/src/editor/ui/Project.js
- `teacherProject()` --calls--> `script()`  [INFERRED]
  src/app/src/editor/ui/hintAlignment.test.js → src/app/src/editor/ui/HintEngine.test.js
- `detailedFor()` --calls--> `Project`  [INFERRED]
  src/app/src/editor/ui/decideHintAction.test.js → src/app/src/editor/ui/Project.js
- `proj()` --calls--> `Project`  [INFERRED]
  src/app/src/editor/ui/hintAlignment.test.js → src/app/src/editor/ui/Project.js

## Import Cycles
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js`
- 3-file cycle: `src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Layer.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/editor/ui/Palette.js -> src/app/src/editor/blocks/Block.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/editor/ui/Palette.js -> src/app/src/editor/ui/Undo.js -> src/app/src/editor/ui/Project.js -> src/app/src/editor/ui/Palette.js`
- 3-file cycle: `src/app/src/editor/ui/Project.js -> src/app/src/editor/ui/UI.js -> src/app/src/editor/ui/Undo.js -> src/app/src/editor/ui/Project.js`
- 3-file cycle: `src/app/src/editor/ui/Palette.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Project.js -> src/app/src/editor/ui/Palette.js`
- 3-file cycle: `src/app/src/editor/ui/Project.js -> src/app/src/editor/ui/UI.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Project.js`
- 3-file cycle: `src/app/src/editor/ui/Palette.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ui/Palette.js`
- 3-file cycle: `src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ui/UI.js -> src/app/src/editor/ui/ScriptsPane.js`
- 3-file cycle: `src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js`
- 3-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 3-file cycle: `src/app/src/iPad/IO.js -> src/app/src/iPad/MediaLib.js -> src/app/src/utils/Localization.js -> src/app/src/iPad/IO.js`

## Communities (93 total, 41 thin omitted)

### Community 0 - "Teacher Live Monitoring"
Cohesion: 0.06
Nodes (69): applyHoverTarget(), applyPageList(), applyStageState(), applyUiState(), buildMirrorPayload(), fakeTouchEvent(), _findHoverElement(), hideLockOverlay() (+61 more)

### Community 2 - "Block Primitives Engine"
Cohesion: 0.06
Nodes (4): hopList, Prims, Runtime, Thread

### Community 4 - "Editor UI Shell"
Cohesion: 0.06
Nodes (3): UI, css_vh(), getViewportHeight()

### Community 6 - "Project Model & Hint Alignment"
Cohesion: 0.07
Nodes (5): evaluate(), proj(), teacherProject(), script(), Project

### Community 7 - "Audio & Localization"
Cohesion: 0.08
Nodes (9): keys, AppUsage, Cookie, Localization, localizationMessages, defaultSounds, projectSounds, ScratchAudio (+1 more)

### Community 13 - "Shared Player Patches"
Cohesion: 0.09
Nodes (11): applyScratchJrPlayerPatches(), applyPagePlayerPatches(), applySpritePlayerPatches(), applyStagePlayerPatches(), EMOJIS, LABELS, playerMain(), _prefetchMedia() (+3 more)

### Community 15 - "Project Lobby"
Cohesion: 0.10
Nodes (10): gettingStartedMain(), homeMain(), homeStrings(), inappAbout(), inappBlocksGuide(), inappInterfaceGuide(), inappPaintEditorGuide(), setClassOfElementById() (+2 more)

### Community 18 - "Block Palette"
Cohesion: 0.09
Nodes (3): Palette, drawScaled(), hitRect()

### Community 19 - "Menus & Alerts"
Cohesion: 0.16
Nodes (9): Menu, Alert, getStringSize(), globalx(), globaly(), newCanvas(), setCanvasSize(), setProps() (+1 more)

### Community 20 - "Paint Vector Ops"
Cohesion: 0.14
Nodes (21): maskCanvas, maskData, offscreen, targetOffscreen, deltaPoint, initialPoint, pensizes, cmdForClick (+13 more)

### Community 21 - "Teacher Assignment Authoring"
Cohesion: 0.11
Nodes (13): apiFetch(), authHeader(), closeOverlay(), GenerateActivityModal, gotoEditor(), guessDefaultLevel(), apiFetch(), AssignmentAuthorBar (+5 more)

### Community 24 - "Block Specs Lookup"
Cohesion: 0.16
Nodes (15): fontcolors, fontsizes, getshapes, loadassets, sendshapes, speeds, onBackButtonCallback, workingCanvas (+7 more)

### Community 30 - "Hint Engine Core"
Cohesion: 0.13
Nodes (20): actorLabelFor(), ALWAYS_PENDING_WHEN_TYPES, BLOCK_LABELS, blockMatch(), candidatesFor(), ENCODE_SKIPPED_TYPES, expectedCache, findSceneAndCharacter() (+12 more)

### Community 31 - "DOM Helper Utilities"
Cohesion: 0.11
Nodes (19): cachedHints, HINT_WHEN_LABELS, css_vw(), CSSTransition(), drawThumbnail(), ensureEditorFrames(), fitInRect(), getFit() (+11 more)

### Community 33 - "Snap.svg Vendor Lib"
Cohesion: 0.32
Nodes (26): a(), b(), c(), d(), e(), f(), g(), h() (+18 more)

### Community 38 - "Snap.svg Shim"
Cohesion: 0.09
Nodes (3): SnapElement, SnapPaper, SnapShim

### Community 41 - "Hint Engine Regression Tests"
Cohesion: 0.16
Nodes (15): decide(), detailedFor(), intro, alignmentInfo(), decideHintAction(), expectedResultOf(), expectedResultsFor(), nextProactiveHint() (+7 more)

### Community 42 - "Hint Poll Scheduling"
Cohesion: 0.14
Nodes (11): apiFetch(), authHeader(), blockBlinkEls, dismissedHintIds, recordHintEvent(), wrongValueAlerted, registerGalleryRestrictionProvider(), registerZeroBlockDefaultsProvider() (+3 more)

### Community 43 - "Editor UI Helpers"
Cohesion: 0.16
Nodes (4): getDocumentHeight(), getDocumentWidth(), newHTML(), newTextInput()

### Community 44 - "Stage Grid Overlay"
Cohesion: 0.24
Nodes (3): Grid, newDiv(), newP()

### Community 47 - "Hint Expected-Sequence Tests"
Cohesion: 0.13
Nodes (9): alertText(), blockLabel(), spokenValue(), ALL_PROJECTS, CARETS, FIXTURE_DIR, fixtures, SYNTHETIC (+1 more)

### Community 67 - "Gallery Restriction"
Cohesion: 0.29
Nodes (6): allCharactersAtLimit(), getGalleryRestriction(), isCharacterAtLimit(), showAssignmentToast(), useZeroBlockDefaults(), newImage()

### Community 70 - "Hint Badge (misc)"
Cohesion: 0.25
Nodes (3): freshAlignmentTarget(), nthEncodedBlock(), resolveLiveBlock()

### Community 74 - "Assignment Notices"
Cohesion: 0.52
Nodes (3): apiFetch(), AssignmentNotice, authHeader()

### Community 78 - "Node Stream Shim"
Cohesion: 0.29
Nodes (3): Readable, Transform, Writable

### Community 79 - "Entry Scripts (misc)"
Cohesion: 0.40
Nodes (6): indexFirstTime(), indexLoadOptions(), indexLoadStart(), indexLoadUsage(), indexMain(), indexSetUsage()

## Knowledge Gaps
- **65 isolated node(s):** `_lastSpriteIds`, `workingCanvas`, `workingCanvas2`, `onBackButtonCallback`, `loadassets` (+60 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **41 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `gn()` connect `Project Lobby` to `Teacher Live Monitoring`, `Paint Editor Actions`, `Block Primitives Engine`, `Sprite Behavior`, `Editor UI Shell`, `Project Model & Hint Alignment`, `Audio & Localization`, `SVG Drawing Tools`, `Native Platform Bridge`, `ScratchJr App Core`, `Sprite Thumbnails`, `Stage Rendering`, `Media Library Browser`, `Block Palette`, `Menus & Alerts`, `Paint Vector Ops`, `Paint Ghost Preview`, `Block Specs Lookup`, `Home Screen`, `Paint Editor Core`, `Vector Path Model`, `Page Model`, `DOM Helper Utilities`, `Paint Transform Math`, `Sound Recording`, `Pointer/Touch Events`, `Paint Layers`, `Undo Stack`, `Vector Path Ops (2)`, `Hint Poll Scheduling`, `Editor UI Helpers`, `Stage Grid Overlay`, `Scripts Pane`, `ScratchJr Core (misc)`, `Vector Path Ops (3)`, `Vector Path Ops (4)`, `Paint Core (2)`, `SVG Image Loading`, `Paint Undo History`, `Paint Core (3)`, `Paint Core (4)`, `Paint Core (5)`, `Vector Path Ops (5)`, `Paint Camera/Zoom`, `Gallery Restriction`, `Sample Projects`, `Hint Badge (misc)`, `Paint Core (6)`, `Assignment Notices`, `Paint Core (7)`, `Vector Path Ops (6)`, `Entry Scripts (misc)`, `Paint Core (8)`, `ScratchJr Core (5)`, `ScratchJr Core (6)`?**
  _High betweenness centrality (0.300) - this node is a cross-community bridge._
- **Why does `ScratchJr` connect `ScratchJr App Core` to `Teacher Live Monitoring`, `Block Primitives Engine`, `ScratchJr Core (4)`, `Audio & Localization`, `Usage Time Tracking`, `Hint Poll Scheduling`, `Stage Grid Overlay`, `Shared Player Patches`, `ScratchJr Core (misc)`, `Menus & Alerts`, `ScratchJr Core (5)`, `ScratchJr Core (6)`, `Paint Vector Ops`, `Block Specs Lookup`, `ScratchJr Core (3)`, `DOM Helper Utilities`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **Why does `Project` connect `Project Model & Hint Alignment` to `Teacher Live Monitoring`, `Block Primitives Engine`, `Audio & Localization`, `Hint Engine Regression Tests`, `Hint Poll Scheduling`, `Shared Player Patches`, `Block Specs Lookup`, `DOM Helper Utilities`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **What connects `_lastSpriteIds`, `workingCanvas`, `workingCanvas2` to the rest of the system?**
  _65 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Teacher Live Monitoring` be split into smaller, more focused modules?**
  _Cohesion score 0.06426906426906427 - nodes in this community are weakly interconnected._
- **Should `Paint Editor Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._
- **Should `Block Primitives Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.05901639344262295 - nodes in this community are weakly interconnected._