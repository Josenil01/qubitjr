# Graph Report - .  (2026-10-31)

## Corpus Check
- 8 files · ~145,596 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2079 nodes · 5152 edges · 92 communities (50 shown, 42 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 25 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Teacher Live Monitoring|Teacher Live Monitoring]]
- [[_COMMUNITY_Paint Editor Actions|Paint Editor Actions]]
- [[_COMMUNITY_Editor UI Shell|Editor UI Shell]]
- [[_COMMUNITY_Sprite Behavior|Sprite Behavior]]
- [[_COMMUNITY_Backend API Client|Backend API Client]]
- [[_COMMUNITY_SVG Drawing Tools|SVG Drawing Tools]]
- [[_COMMUNITY_Native Platform Bridge|Native Platform Bridge]]
- [[_COMMUNITY_Paint Vector Ops|Paint Vector Ops]]
- [[_COMMUNITY_Block Specs Lookup|Block Specs Lookup]]
- [[_COMMUNITY_Stage Rendering|Stage Rendering]]
- [[_COMMUNITY_Project Model & Hint Alignment|Project Model & Hint Alignment]]
- [[_COMMUNITY_Sprite Thumbnails|Sprite Thumbnails]]
- [[_COMMUNITY_ScratchJr App Core|ScratchJr App Core]]
- [[_COMMUNITY_Student Hint Badge UI|Student Hint Badge UI]]
- [[_COMMUNITY_Home Screen|Home Screen]]
- [[_COMMUNITY_SVG to Canvas Rendering|SVG to Canvas Rendering]]
- [[_COMMUNITY_Shared Player Patches|Shared Player Patches]]
- [[_COMMUNITY_Media Library Browser|Media Library Browser]]
- [[_COMMUNITY_Block Scripts Model|Block Scripts Model]]
- [[_COMMUNITY_Audio & Localization|Audio & Localization]]
- [[_COMMUNITY_Teacher Assignment Authoring|Teacher Assignment Authoring]]
- [[_COMMUNITY_Block Primitives Engine|Block Primitives Engine]]
- [[_COMMUNITY_Hint Engine Regression Tests|Hint Engine Regression Tests]]
- [[_COMMUNITY_Block Rendering|Block Rendering]]
- [[_COMMUNITY_Paint Ghost Preview|Paint Ghost Preview]]
- [[_COMMUNITY_Block Palette|Block Palette]]
- [[_COMMUNITY_Block Model|Block Model]]
- [[_COMMUNITY_Hint Engine Core|Hint Engine Core]]
- [[_COMMUNITY_Paint Editor Core|Paint Editor Core]]
- [[_COMMUNITY_Vector Path Model|Vector Path Model]]
- [[_COMMUNITY_Page Model|Page Model]]
- [[_COMMUNITY_Paint Transform Math|Paint Transform Math]]
- [[_COMMUNITY_Snap.svg Vendor Lib|Snap.svg Vendor Lib]]
- [[_COMMUNITY_Sound Recording|Sound Recording]]
- [[_COMMUNITY_Project Lobby|Project Lobby]]
- [[_COMMUNITY_PointerTouch Events|Pointer/Touch Events]]
- [[_COMMUNITY_DOM Helper Utilities|DOM Helper Utilities]]
- [[_COMMUNITY_Paint Layers|Paint Layers]]
- [[_COMMUNITY_Scripts Pane|Scripts Pane]]
- [[_COMMUNITY_Undo Stack|Undo Stack]]
- [[_COMMUNITY_Stage Grid Overlay|Stage Grid Overlay]]
- [[_COMMUNITY_Snap.svg Shim|Snap.svg Shim]]
- [[_COMMUNITY_Assignment Badge State|Assignment Badge State]]
- [[_COMMUNITY_Block Rendering|Block Rendering]]
- [[_COMMUNITY_Paint Core (7)|Paint Core (7)]]
- [[_COMMUNITY_Palette Scrolling|Palette Scrolling]]
- [[_COMMUNITY_Rectangle Geometry|Rectangle Geometry]]
- [[_COMMUNITY_Block Specs Data|Block Specs Data]]
- [[_COMMUNITY_Block Primitives Engine (2)|Block Primitives Engine (2)]]
- [[_COMMUNITY_Stage Placement Ghost|Stage Placement Ghost]]
- [[_COMMUNITY_Paint Undo History|Paint Undo History]]
- [[_COMMUNITY_SVG Image Loading|SVG Image Loading]]
- [[_COMMUNITY_Matrix Geometry|Matrix Geometry]]
- [[_COMMUNITY_Paint CameraZoom|Paint Camera/Zoom]]
- [[_COMMUNITY_Project Model & Hint Alignment|Project Model & Hint Alignment]]
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
- [[_COMMUNITY_Menus & Alerts|Menus & Alerts]]

## God Nodes (most connected - your core abstractions)
1. `gn()` - 301 edges
2. `Paint` - 118 edges
3. `newHTML()` - 117 edges
4. `ScratchJr` - 116 edges
5. `SVG2Canvas` - 84 edges
6. `PaintAction` - 72 edges
7. `UI` - 67 edges
8. `iOS` - 66 edges
9. `setProps()` - 64 edges
10. `Sprite` - 63 edges

## Surprising Connections (you probably didn't know these)
- `blockMatch()` --calls--> `evaluate()`  [INFERRED]
  src/app/src/editor/ui/HintEngine.js → src/app/src/editor/ui/hintAlignment.test.js
- `proj()` --calls--> `Project`  [INFERRED]
  src/app/src/editor/ui/hintAlignment.test.js → src/app/src/editor/ui/Project.js
- `detailedFor()` --calls--> `Project`  [INFERRED]
  src/app/src/editor/ui/hintRegressions.test.js → src/app/src/editor/ui/Project.js
- `teacherProject()` --calls--> `script()`  [INFERRED]
  src/app/src/editor/ui/hintAlignment.test.js → src/app/src/editor/ui/HintEngine.test.js
- `detailedFor()` --calls--> `Project`  [INFERRED]
  src/app/src/editor/ui/decideHintAction.test.js → src/app/src/editor/ui/Project.js

## Import Cycles
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 3-file cycle: `src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Layer.js`
- 3-file cycle: `src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js`
- 3-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/editor/ui/Palette.js -> src/app/src/editor/blocks/Block.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/editor/ui/Palette.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Project.js -> src/app/src/editor/ui/Palette.js`
- 3-file cycle: `src/app/src/editor/ui/Palette.js -> src/app/src/editor/ui/Undo.js -> src/app/src/editor/ui/Project.js -> src/app/src/editor/ui/Palette.js`
- 3-file cycle: `src/app/src/editor/ui/Project.js -> src/app/src/editor/ui/UI.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Project.js`
- 3-file cycle: `src/app/src/editor/ui/Project.js -> src/app/src/editor/ui/UI.js -> src/app/src/editor/ui/Undo.js -> src/app/src/editor/ui/Project.js`
- 3-file cycle: `src/app/src/iPad/IO.js -> src/app/src/iPad/MediaLib.js -> src/app/src/utils/Localization.js -> src/app/src/iPad/IO.js`
- 3-file cycle: `src/app/src/iPad/IO.js -> src/app/src/lobby/Lobby.js -> src/app/src/utils/Localization.js -> src/app/src/iPad/IO.js`
- 3-file cycle: `src/app/src/iPad/iOS.js -> src/app/src/utils/ScratchAudio.js -> src/app/src/utils/Sound.js -> src/app/src/iPad/iOS.js`
- 3-file cycle: `src/app/src/iPad/IO.js -> src/app/src/lobby/Lobby.js -> src/app/src/lobby/Samples.js -> src/app/src/iPad/IO.js`

## Communities (92 total, 42 thin omitted)

### Community 0 - "Teacher Live Monitoring"
Cohesion: 0.05
Nodes (76): applyHoverTarget(), applyPageList(), applyStageState(), applyUiState(), buildMirrorPayload(), fakeTouchEvent(), _findHoverElement(), hideLockOverlay() (+68 more)

### Community 2 - "Editor UI Shell"
Cohesion: 0.05
Nodes (4): UI, css_vh(), getDocumentWidth(), getViewportHeight()

### Community 7 - "Paint Vector Ops"
Cohesion: 0.10
Nodes (20): Vector, maskCanvas, maskData, offscreen, targetOffscreen, deltaPoint, initialPoint, pensizes (+12 more)

### Community 8 - "Block Specs Lookup"
Cohesion: 0.14
Nodes (13): onBackButtonCallback, workingCanvas, workingCanvas2, buffer, pinchcenter, getDocumentHeight(), getIdFor(), newImage() (+5 more)

### Community 13 - "Student Hint Badge UI"
Cohesion: 0.10
Nodes (5): apiFetch(), AssignmentBadge, authHeader(), characterThumbSrc(), recordHintEvent()

### Community 14 - "Home Screen"
Cohesion: 0.09
Nodes (5): Events, Home, apiFetch(), authHeader(), MissionsMenu

### Community 16 - "Shared Player Patches"
Cohesion: 0.09
Nodes (11): applyScratchJrPlayerPatches(), applyPagePlayerPatches(), applySpritePlayerPatches(), applyStagePlayerPatches(), EMOJIS, LABELS, playerMain(), _prefetchMedia() (+3 more)

### Community 19 - "Audio & Localization"
Cohesion: 0.08
Nodes (11): fontcolors, fontsizes, getshapes, loadassets, sendshapes, speeds, keys, MediaLib (+3 more)

### Community 20 - "Teacher Assignment Authoring"
Cohesion: 0.10
Nodes (14): gettingStartedMain(), indexFirstTime(), indexLoadOptions(), indexLoadStart(), indexMain(), apiFetch(), AssignmentAuthorBar, authHeader() (+6 more)

### Community 22 - "Hint Engine Regression Tests"
Cohesion: 0.09
Nodes (23): decide(), detailedFor(), intro, alignmentInfo(), decideHintAction(), expectedResultsFor(), freshAlignmentTarget(), legacyShadowedByExpected() (+15 more)

### Community 23 - "Block Rendering"
Cohesion: 0.14
Nodes (9): Menu, Alert, drawThumbnail(), getStringSize(), globalx(), globaly(), setCanvasSize(), setProps() (+1 more)

### Community 27 - "Hint Engine Core"
Cohesion: 0.11
Nodes (24): actorLabelFor(), alertText(), ALWAYS_PENDING_WHEN_TYPES, BLOCK_LABELS, blockLabel(), blockMatch(), candidatesFor(), ENCODE_SKIPPED_TYPES (+16 more)

### Community 32 - "Snap.svg Vendor Lib"
Cohesion: 0.32
Nodes (26): a(), b(), c(), d(), e(), f(), g(), h() (+18 more)

### Community 34 - "Project Lobby"
Cohesion: 0.17
Nodes (8): homeMain(), homeStrings(), inappAbout(), inappBlocksGuide(), inappInterfaceGuide(), inappPaintEditorGuide(), Lobby, gn()

### Community 36 - "DOM Helper Utilities"
Cohesion: 0.11
Nodes (22): colorToRGBA(), css_vw(), CSSTransition(), drawScaled(), ensureEditorFrames(), fitInRect(), getFit(), getHex() (+14 more)

### Community 38 - "Scripts Pane"
Cohesion: 0.13
Nodes (4): ScriptsPane, hit3DRect(), localx(), localy()

### Community 40 - "Stage Grid Overlay"
Cohesion: 0.18
Nodes (5): hopList, Grid, newCanvas(), newDiv(), newP()

### Community 41 - "Snap.svg Shim"
Cohesion: 0.09
Nodes (3): SnapElement, SnapPaper, SnapShim

### Community 43 - "Assignment Badge State"
Cohesion: 0.15
Nodes (14): blockBlinkEls, dismissedHintIds, wrongValueAlerted, allCharactersAtLimit(), getGalleryRestriction(), isCharacterAtLimit(), isMissionPending(), registerGalleryRestrictionProvider() (+6 more)

### Community 54 - "Stage Placement Ghost"
Cohesion: 0.32
Nodes (12): getStagePlacements(), buildGhost(), ghostTransform(), isNearTarget(), liveSpritesOf(), matchStagePlacements(), reconcile(), removeAllGhosts() (+4 more)

### Community 66 - "Project Model & Hint Alignment"
Cohesion: 0.22
Nodes (4): evaluate(), proj(), teacherProject(), script()

### Community 68 - "Hint Poll Scheduling"
Cohesion: 0.28
Nodes (3): PollScheduler, scheduleNext(), trackActivity()

### Community 74 - "Assignment Notices"
Cohesion: 0.52
Nodes (3): apiFetch(), AssignmentNotice, authHeader()

### Community 77 - "Node Stream Shim"
Cohesion: 0.29
Nodes (3): Readable, Transform, Writable

## Knowledge Gaps
- **65 isolated node(s):** `workingCanvas`, `workingCanvas2`, `onBackButtonCallback`, `loadassets`, `fontcolors` (+60 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **42 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `gn()` connect `Project Lobby` to `Teacher Live Monitoring`, `Paint Editor Actions`, `Editor UI Shell`, `Sprite Behavior`, `SVG Drawing Tools`, `Native Platform Bridge`, `Paint Vector Ops`, `Block Specs Lookup`, `Stage Rendering`, `Project Model & Hint Alignment`, `ScratchJr App Core`, `Student Hint Badge UI`, `Home Screen`, `Media Library Browser`, `Block Scripts Model`, `Audio & Localization`, `Teacher Assignment Authoring`, `Block Primitives Engine`, `Block Rendering`, `Paint Ghost Preview`, `Block Palette`, `Paint Editor Core`, `Vector Path Model`, `Page Model`, `Paint Transform Math`, `Sound Recording`, `Pointer/Touch Events`, `DOM Helper Utilities`, `Paint Layers`, `Scripts Pane`, `Undo Stack`, `Stage Grid Overlay`, `Vector Path Ops (2)`, `Assignment Badge State`, `ScratchJr Core (misc)`, `Paint Core (7)`, `Paint Core (2)`, `Vector Path Ops (3)`, `Vector Path Ops (4)`, `Paint Undo History`, `SVG Image Loading`, `Paint Core (4)`, `Paint Core (5)`, `Vector Path Ops (5)`, `Paint Camera/Zoom`, `Sample Projects`, `Paint Core (3)`, `Paint Core (6)`, `Assignment Notices`, `Vector Path Ops (6)`, `Paint Core (5)`, `ScratchJr Core (5)`, `ScratchJr Core (6)`?**
  _High betweenness centrality (0.280) - this node is a cross-community bridge._
- **Why does `Path` connect `Vector Path Model` to `Paint Vector Ops`, `Vector Path Ops (2)`, `Vector Path Ops (6)`, `Vector Path Ops (4)`, `Vector Path Ops (3)`, `Vector Path Ops (4)`, `Vector Path Ops (5)`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Why does `Project` connect `Project Model & Hint Alignment` to `Project Model & Hint Alignment`, `Block Specs Lookup`, `Stage Grid Overlay`, `Assignment Badge State`, `Shared Player Patches`, `Hint Engine Regression Tests`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **What connects `workingCanvas`, `workingCanvas2`, `onBackButtonCallback` to the rest of the system?**
  _65 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Teacher Live Monitoring` be split into smaller, more focused modules?**
  _Cohesion score 0.05236091631603553 - nodes in this community are weakly interconnected._
- **Should `Paint Editor Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._
- **Should `Editor UI Shell` be split into smaller, more focused modules?**
  _Cohesion score 0.053551912568306013 - nodes in this community are weakly interconnected._