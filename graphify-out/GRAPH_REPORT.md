# Graph Report - .  (2026-10-30)

## Corpus Check
- 9 files · ~145,184 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2073 nodes · 5255 edges · 97 communities (53 shown, 44 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 26 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Teacher Live Monitoring|Teacher Live Monitoring]]
- [[_COMMUNITY_Paint Editor Actions|Paint Editor Actions]]
- [[_COMMUNITY_Sprite Behavior|Sprite Behavior]]
- [[_COMMUNITY_Backend API Client|Backend API Client]]
- [[_COMMUNITY_Audio & Localization|Audio & Localization]]
- [[_COMMUNITY_Project Model & Hint Alignment|Project Model & Hint Alignment]]
- [[_COMMUNITY_Editor UI Shell|Editor UI Shell]]
- [[_COMMUNITY_Stage Rendering|Stage Rendering]]
- [[_COMMUNITY_ScratchJr App Core|ScratchJr App Core]]
- [[_COMMUNITY_Native Platform Bridge|Native Platform Bridge]]
- [[_COMMUNITY_Sprite Thumbnails|Sprite Thumbnails]]
- [[_COMMUNITY_SVG to Canvas Rendering|SVG to Canvas Rendering]]
- [[_COMMUNITY_Block Rendering|Block Rendering]]
- [[_COMMUNITY_Paint Vector Ops|Paint Vector Ops]]
- [[_COMMUNITY_Student Hint Badge UI|Student Hint Badge UI]]
- [[_COMMUNITY_Block Scripts Model|Block Scripts Model]]
- [[_COMMUNITY_Block Primitives Engine|Block Primitives Engine]]
- [[_COMMUNITY_Vector Path Model|Vector Path Model]]
- [[_COMMUNITY_Media Library Browser|Media Library Browser]]
- [[_COMMUNITY_DOM Helper Utilities|DOM Helper Utilities]]
- [[_COMMUNITY_Hint Engine Core|Hint Engine Core]]
- [[_COMMUNITY_Teacher Assignment Authoring|Teacher Assignment Authoring]]
- [[_COMMUNITY_Paint Ghost Preview|Paint Ghost Preview]]
- [[_COMMUNITY_Hint Engine Regression Tests|Hint Engine Regression Tests]]
- [[_COMMUNITY_Block Model|Block Model]]
- [[_COMMUNITY_Block Palette|Block Palette]]
- [[_COMMUNITY_Project Lobby|Project Lobby]]
- [[_COMMUNITY_Paint Editor Core|Paint Editor Core]]
- [[_COMMUNITY_Block Specs Lookup|Block Specs Lookup]]
- [[_COMMUNITY_Home Screen|Home Screen]]
- [[_COMMUNITY_SVG Drawing Tools|SVG Drawing Tools]]
- [[_COMMUNITY_Page Model|Page Model]]
- [[_COMMUNITY_Paint Transform Math|Paint Transform Math]]
- [[_COMMUNITY_Snap.svg Vendor Lib|Snap.svg Vendor Lib]]
- [[_COMMUNITY_Sound Recording|Sound Recording]]
- [[_COMMUNITY_PointerTouch Events|Pointer/Touch Events]]
- [[_COMMUNITY_Paint Layers|Paint Layers]]
- [[_COMMUNITY_Stage Grid Overlay|Stage Grid Overlay]]
- [[_COMMUNITY_Menus & Alerts|Menus & Alerts]]
- [[_COMMUNITY_Undo Stack|Undo Stack]]
- [[_COMMUNITY_Shared Player Patches|Shared Player Patches]]
- [[_COMMUNITY_Rectangle Geometry|Rectangle Geometry]]
- [[_COMMUNITY_Editor UI Shell (2)|Editor UI Shell (2)]]
- [[_COMMUNITY_Snap.svg Shim|Snap.svg Shim]]
- [[_COMMUNITY_Assignment Badge State|Assignment Badge State]]
- [[_COMMUNITY_Scripts Pane|Scripts Pane]]
- [[_COMMUNITY_Shared Player Patches (2)|Shared Player Patches (2)]]
- [[_COMMUNITY_Palette Scrolling|Palette Scrolling]]
- [[_COMMUNITY_Block Specs Data|Block Specs Data]]
- [[_COMMUNITY_SVG Drawing Tools (2)|SVG Drawing Tools (2)]]
- [[_COMMUNITY_Block Primitives Engine (2)|Block Primitives Engine (2)]]
- [[_COMMUNITY_Stage Placement Ghost|Stage Placement Ghost]]
- [[_COMMUNITY_Index Entry Screens|Index Entry Screens]]
- [[_COMMUNITY_Paint Undo History|Paint Undo History]]
- [[_COMMUNITY_SVG Image Loading|SVG Image Loading]]
- [[_COMMUNITY_Matrix Geometry|Matrix Geometry]]
- [[_COMMUNITY_Paint CameraZoom|Paint Camera/Zoom]]
- [[_COMMUNITY_Sample Projects|Sample Projects]]
- [[_COMMUNITY_Hint Poll Scheduling|Hint Poll Scheduling]]
- [[_COMMUNITY_Usage Time Tracking|Usage Time Tracking]]
- [[_COMMUNITY_Block Primitives Engine (3)|Block Primitives Engine (3)]]
- [[_COMMUNITY_JSZip Vendor Shim|JSZip Vendor Shim]]
- [[_COMMUNITY_Assignment Notices|Assignment Notices]]
- [[_COMMUNITY_PNG Cache|PNG Cache]]
- [[_COMMUNITY_Node Stream Shim|Node Stream Shim]]
- [[_COMMUNITY_Audio & Localization (2)|Audio & Localization (2)]]
- [[_COMMUNITY_Sound Playback|Sound Playback]]
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
- `detailedFor()` --calls--> `Project`  [INFERRED]
  src/app/src/editor/ui/hintRegressions.test.js → src/app/src/editor/ui/Project.js
- `blockMatch()` --calls--> `evaluate()`  [INFERRED]
  src/app/src/editor/ui/HintEngine.js → src/app/src/editor/ui/hintAlignment.test.js
- `teacherProject()` --calls--> `script()`  [INFERRED]
  src/app/src/editor/ui/hintAlignment.test.js → src/app/src/editor/ui/HintEngine.test.js
- `detailedFor()` --calls--> `Project`  [INFERRED]
  src/app/src/editor/ui/decideHintAction.test.js → src/app/src/editor/ui/Project.js
- `proj()` --calls--> `Project`  [INFERRED]
  src/app/src/editor/ui/hintAlignment.test.js → src/app/src/editor/ui/Project.js

## Import Cycles
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/editor/ui/Palette.js -> src/app/src/editor/blocks/Block.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 3-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/editor/ui/Palette.js -> src/app/src/editor/ui/Undo.js -> src/app/src/editor/ui/Project.js -> src/app/src/editor/ui/Palette.js`
- 3-file cycle: `src/app/src/editor/ui/Project.js -> src/app/src/editor/ui/UI.js -> src/app/src/editor/ui/Undo.js -> src/app/src/editor/ui/Project.js`
- 3-file cycle: `src/app/src/editor/ui/Palette.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Project.js -> src/app/src/editor/ui/Palette.js`
- 3-file cycle: `src/app/src/editor/ui/Palette.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ui/Palette.js`
- 3-file cycle: `src/app/src/editor/ui/Project.js -> src/app/src/editor/ui/UI.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Project.js`
- 3-file cycle: `src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ui/UI.js -> src/app/src/editor/ui/ScriptsPane.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Layer.js`
- 3-file cycle: `src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/iPad/iOS.js -> src/app/src/utils/ScratchAudio.js -> src/app/src/utils/Sound.js -> src/app/src/iPad/iOS.js`

## Communities (97 total, 44 thin omitted)

### Community 0 - "Teacher Live Monitoring"
Cohesion: 0.06
Nodes (70): applyHoverTarget(), applyPageList(), applyStageState(), applyUiState(), buildMirrorPayload(), fakeTouchEvent(), _findHoverElement(), hideLockOverlay() (+62 more)

### Community 4 - "Audio & Localization"
Cohesion: 0.08
Nodes (13): fontcolors, fontsizes, getshapes, loadassets, sendshapes, speeds, keys, MediaLib (+5 more)

### Community 5 - "Project Model & Hint Alignment"
Cohesion: 0.07
Nodes (4): proj(), teacherProject(), script(), Project

### Community 6 - "Editor UI Shell"
Cohesion: 0.06
Nodes (4): UI, css_vh(), getDocumentWidth(), getViewportHeight()

### Community 12 - "Block Rendering"
Cohesion: 0.11
Nodes (7): BlockArg, Menu, drawThumbnail(), getDocumentHeight(), setCanvasSize(), setProps(), writeText()

### Community 13 - "Paint Vector Ops"
Cohesion: 0.11
Nodes (15): Vector, maskCanvas, maskData, offscreen, targetOffscreen, deltaPoint, initialPoint, pensizes (+7 more)

### Community 19 - "DOM Helper Utilities"
Cohesion: 0.09
Nodes (24): gettingStartedMain(), cachedHints, HINT_WHEN_LABELS, css_vw(), CSSTransition(), drawScaled(), ensureEditorFrames(), fitInRect() (+16 more)

### Community 20 - "Hint Engine Core"
Cohesion: 0.11
Nodes (26): evaluate(), actorLabelFor(), alertText(), ALWAYS_PENDING_WHEN_TYPES, BLOCK_LABELS, blockLabel(), blockMatch(), candidatesFor() (+18 more)

### Community 21 - "Teacher Assignment Authoring"
Cohesion: 0.11
Nodes (13): apiFetch(), authHeader(), closeOverlay(), GenerateActivityModal, gotoEditor(), guessDefaultLevel(), apiFetch(), AssignmentAuthorBar (+5 more)

### Community 23 - "Hint Engine Regression Tests"
Cohesion: 0.09
Nodes (22): decide(), detailedFor(), intro, alignmentInfo(), decideHintAction(), expectedResultOf(), expectedResultsFor(), freshAlignmentTarget() (+14 more)

### Community 26 - "Project Lobby"
Cohesion: 0.14
Nodes (8): homeMain(), homeStrings(), inappAbout(), inappBlocksGuide(), inappInterfaceGuide(), inappPaintEditorGuide(), Lobby, gn()

### Community 28 - "Block Specs Lookup"
Cohesion: 0.16
Nodes (12): onBackButtonCallback, workingCanvas, workingCanvas2, buffer, pinchcenter, hit3DRect(), hitRect(), localx() (+4 more)

### Community 33 - "Snap.svg Vendor Lib"
Cohesion: 0.32
Nodes (26): a(), b(), c(), d(), e(), f(), g(), h() (+18 more)

### Community 37 - "Stage Grid Overlay"
Cohesion: 0.17
Nodes (5): hopList, Grid, newCanvas(), newDiv(), newP()

### Community 38 - "Menus & Alerts"
Cohesion: 0.15
Nodes (5): Alert, DrawPath, getStringSize(), globalx(), globaly()

### Community 41 - "Rectangle Geometry"
Cohesion: 0.12
Nodes (6): Rectangle, cmdForClick, cmdForMouseDown, cmdForMouseMove, cmdForMouseUp, dragGroup

### Community 43 - "Snap.svg Shim"
Cohesion: 0.09
Nodes (3): SnapElement, SnapPaper, SnapShim

### Community 45 - "Assignment Badge State"
Cohesion: 0.16
Nodes (15): apiFetch(), authHeader(), blockBlinkEls, dismissedHintIds, recordHintEvent(), wrongValueAlerted, allCharactersAtLimit(), isCharacterAtLimit() (+7 more)

### Community 47 - "Shared Player Patches (2)"
Cohesion: 0.22
Nodes (10): applyScratchJrPlayerPatches(), applyPagePlayerPatches(), applySpritePlayerPatches(), applyStagePlayerPatches(), EMOJIS, LABELS, playerMain(), _prefetchMedia() (+2 more)

### Community 56 - "Stage Placement Ghost"
Cohesion: 0.32
Nodes (12): getStagePlacements(), buildGhost(), ghostTransform(), isNearTarget(), liveSpritesOf(), matchStagePlacements(), reconcile(), removeAllGhosts() (+4 more)

### Community 57 - "Index Entry Screens"
Cohesion: 0.23
Nodes (7): indexFirstTime(), indexLoadOptions(), indexLoadStart(), indexLoadUsage(), indexMain(), indexSetUsage(), setClassOfElementById()

### Community 71 - "Hint Poll Scheduling"
Cohesion: 0.28
Nodes (3): PollScheduler, scheduleNext(), trackActivity()

### Community 75 - "Assignment Notices"
Cohesion: 0.52
Nodes (3): apiFetch(), AssignmentNotice, authHeader()

### Community 82 - "Node Stream Shim"
Cohesion: 0.29
Nodes (3): Readable, Transform, Writable

## Knowledge Gaps
- **65 isolated node(s):** `_lastSpriteIds`, `workingCanvas`, `workingCanvas2`, `onBackButtonCallback`, `loadassets` (+60 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **44 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `gn()` connect `Project Lobby` to `Teacher Live Monitoring`, `Paint Editor Actions`, `Sprite Behavior`, `Audio & Localization`, `Project Model & Hint Alignment`, `Editor UI Shell`, `Stage Rendering`, `ScratchJr App Core`, `Native Platform Bridge`, `Sprite Thumbnails`, `Paint Vector Ops`, `Student Hint Badge UI`, `Block Scripts Model`, `Block Primitives Engine`, `Vector Path Model`, `Media Library Browser`, `DOM Helper Utilities`, `Paint Ghost Preview`, `Block Palette`, `Paint Editor Core`, `Block Specs Lookup`, `Home Screen`, `Page Model`, `Paint Transform Math`, `Sound Recording`, `Pointer/Touch Events`, `Paint Layers`, `Stage Grid Overlay`, `Menus & Alerts`, `Undo Stack`, `Rectangle Geometry`, `Editor UI Shell (2)`, `Vector Path Ops (2)`, `Assignment Badge State`, `Scripts Pane`, `ScratchJr Core (misc)`, `Paint Core (5)`, `Vector Path Ops (3)`, `SVG Drawing Tools (2)`, `Paint Core (6)`, `Index Entry Screens`, `Paint Core (2)`, `Paint Undo History`, `Vector Path Ops (4)`, `Paint Core (3)`, `Paint Core (4)`, `SVG Image Loading`, `Paint Camera/Zoom`, `Sample Projects`, `Assignment Notices`, `Paint Core (7)`, `Vector Path Ops (6)`, `Vector Path Ops (5)`, `SVG Drawing Tools (3)`, `Vector Path Model (2)`, `ScratchJr Core (5)`, `ScratchJr Core (6)`?**
  _High betweenness centrality (0.277) - this node is a cross-community bridge._
- **Why does `Path` connect `Vector Path Model` to `Rectangle Geometry`, `Vector Path Ops (2)`, `Vector Path Ops (6)`, `Paint Vector Ops`, `Vector Path Ops (5)`, `Vector Path Model (2)`, `Vector Path Ops (3)`, `Project Lobby`, `Vector Path Ops (4)`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **Why does `ScratchJr` connect `ScratchJr App Core` to `Teacher Live Monitoring`, `ScratchJr Core (3)`, `Audio & Localization`, `ScratchJr Core (4)`, `Stage Grid Overlay`, `Usage Time Tracking`, `Rectangle Geometry`, `Block Rendering`, `Paint Vector Ops`, `Assignment Badge State`, `Shared Player Patches (2)`, `ScratchJr Core (misc)`, `DOM Helper Utilities`, `ScratchJr Core (5)`, `ScratchJr Core (6)`, `Block Specs Lookup`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **What connects `_lastSpriteIds`, `workingCanvas`, `workingCanvas2` to the rest of the system?**
  _65 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Teacher Live Monitoring` be split into smaller, more focused modules?**
  _Cohesion score 0.06361570918532944 - nodes in this community are weakly interconnected._
- **Should `Paint Editor Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._
- **Should `Sprite Behavior` be split into smaller, more focused modules?**
  _Cohesion score 0.07175141242937853 - nodes in this community are weakly interconnected._