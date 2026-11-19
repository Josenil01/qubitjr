# Graph Report - .  (2026-11-18)

## Corpus Check
- 114 files · ~0 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2251 nodes · 5322 edges · 103 communities (59 shown, 44 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 28 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Teacher Live Monitoring|Teacher Live Monitoring]]
- [[_COMMUNITY_Paint Editor Actions|Paint Editor Actions]]
- [[_COMMUNITY_Project Model & Hint Alignment|Project Model & Hint Alignment]]
- [[_COMMUNITY_SVG Drawing Tools|SVG Drawing Tools]]
- [[_COMMUNITY_Sprite Behavior|Sprite Behavior]]
- [[_COMMUNITY_Block Specs Lookup|Block Specs Lookup]]
- [[_COMMUNITY_Sprite Thumbnails|Sprite Thumbnails]]
- [[_COMMUNITY_Paint Vector Ops|Paint Vector Ops]]
- [[_COMMUNITY_Editor UI Shell|Editor UI Shell]]
- [[_COMMUNITY_Audio & Localization|Audio & Localization]]
- [[_COMMUNITY_Vector Path Ops (4)|Vector Path Ops (4)]]
- [[_COMMUNITY_Home Screen|Home Screen]]
- [[_COMMUNITY_Stage Rendering|Stage Rendering]]
- [[_COMMUNITY_Backend API Client|Backend API Client]]
- [[_COMMUNITY_Student Hint Badge UI|Student Hint Badge UI]]
- [[_COMMUNITY_ScratchJr App Core|ScratchJr App Core]]
- [[_COMMUNITY_Block Scripts Model|Block Scripts Model]]
- [[_COMMUNITY_Media Library Browser|Media Library Browser]]
- [[_COMMUNITY_Shared Player Patches|Shared Player Patches]]
- [[_COMMUNITY_SVG to Canvas Rendering|SVG to Canvas Rendering]]
- [[_COMMUNITY_Teacher Assignment Authoring|Teacher Assignment Authoring]]
- [[_COMMUNITY_Block Primitives Engine|Block Primitives Engine]]
- [[_COMMUNITY_Hint Engine Regression Tests|Hint Engine Regression Tests]]
- [[_COMMUNITY_Page Model|Page Model]]
- [[_COMMUNITY_Vector Path Model|Vector Path Model]]
- [[_COMMUNITY_Block Palette|Block Palette]]
- [[_COMMUNITY_Assignment Badge State|Assignment Badge State]]
- [[_COMMUNITY_Block Rendering|Block Rendering]]
- [[_COMMUNITY_Block Specs Lookup|Block Specs Lookup]]
- [[_COMMUNITY_Paint Editor Core|Paint Editor Core]]
- [[_COMMUNITY_Paint Core (2)|Paint Core (2)]]
- [[_COMMUNITY_Sound Recording|Sound Recording]]
- [[_COMMUNITY_Project Lobby|Project Lobby]]
- [[_COMMUNITY_Home Screen|Home Screen]]
- [[_COMMUNITY_DOM Helper Utilities|DOM Helper Utilities]]
- [[_COMMUNITY_Paint Layers|Paint Layers]]
- [[_COMMUNITY_Hint Engine Core|Hint Engine Core]]
- [[_COMMUNITY_Snap.svg Vendor Lib|Snap.svg Vendor Lib]]
- [[_COMMUNITY_Scripts Pane|Scripts Pane]]
- [[_COMMUNITY_Undo Stack|Undo Stack]]
- [[_COMMUNITY_Matrix Geometry|Matrix Geometry]]
- [[_COMMUNITY_Snap.svg Shim|Snap.svg Shim]]
- [[_COMMUNITY_Paint Transform Math|Paint Transform Math]]
- [[_COMMUNITY_Native Platform Bridge|Native Platform Bridge]]
- [[_COMMUNITY_Vector Path Ops (2)|Vector Path Ops (2)]]
- [[_COMMUNITY_Paint Ghost Preview|Paint Ghost Preview]]
- [[_COMMUNITY_Palette Scrolling|Palette Scrolling]]
- [[_COMMUNITY_Block Primitives Engine (3)|Block Primitives Engine (3)]]
- [[_COMMUNITY_Paint Ghost Preview|Paint Ghost Preview]]
- [[_COMMUNITY_Paint Ghost Preview|Paint Ghost Preview]]
- [[_COMMUNITY_Block Primitives Engine (2)|Block Primitives Engine (2)]]
- [[_COMMUNITY_Stage Placement Ghost|Stage Placement Ghost]]
- [[_COMMUNITY_Project Model & Hint Alignment|Project Model & Hint Alignment]]
- [[_COMMUNITY_Paint Ghost Preview|Paint Ghost Preview]]
- [[_COMMUNITY_Paint CameraZoom|Paint Camera/Zoom]]
- [[_COMMUNITY_ScratchJr Core (4)|ScratchJr Core (4)]]
- [[_COMMUNITY_Paint Core (3)|Paint Core (3)]]
- [[_COMMUNITY_Vector Path Ops (6)|Vector Path Ops (6)]]
- [[_COMMUNITY_Node Stream Shim|Node Stream Shim]]
- [[_COMMUNITY_Audio & Localization (2)|Audio & Localization (2)]]
- [[_COMMUNITY_Block Rendering|Block Rendering]]
- [[_COMMUNITY_Sound Playback|Sound Playback]]
- [[_COMMUNITY_SVG Image Loading|SVG Image Loading]]
- [[_COMMUNITY_Paint Core (5)|Paint Core (5)]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Vector Path Ops (5)|Vector Path Ops (5)]]
- [[_COMMUNITY_ScratchJr Core (5)|ScratchJr Core (5)]]
- [[_COMMUNITY_SVG to Canvas (5)|SVG to Canvas (5)]]
- [[_COMMUNITY_Teacher Assignment Authoring|Teacher Assignment Authoring]]
- [[_COMMUNITY_Sample Projects|Sample Projects]]
- [[_COMMUNITY_Poll Scheduler Tests|Poll Scheduler Tests]]
- [[_COMMUNITY_Math Modulo Helper|Math Modulo Helper]]
- [[_COMMUNITY_Fullscreen Control|Fullscreen Control]]
- [[_COMMUNITY_Paint Core (3)|Paint Core (3)]]

## God Nodes (most connected - your core abstractions)
1. `gn()` - 325 edges
2. `Paint` - 117 edges
3. `ScratchJr` - 112 edges
4. `newHTML()` - 111 edges
5. `SVG2Canvas` - 84 edges
6. `PaintAction` - 72 edges
7. `UI` - 68 edges
8. `iOS` - 65 edges
9. `Sprite` - 63 edges
10. `SVGTools` - 60 edges

## Surprising Connections (you probably didn't know these)
- `proj()` --calls--> `Project`  [INFERRED]
  src/app/src/editor/ui/hintAlignment.test.js → src/app/src/editor/ui/Project.js
- `detailedFor()` --calls--> `Project`  [INFERRED]
  src/app/src/editor/ui/hintRegressions.test.js → src/app/src/editor/ui/Project.js
- `blockMatch()` --calls--> `evaluate()`  [INFERRED]
  src/app/src/editor/ui/HintEngine.js → src/app/src/editor/ui/hintAlignment.test.js
- `teacherProject()` --calls--> `script()`  [INFERRED]
  src/app/src/editor/ui/hintAlignment.test.js → src/app/src/editor/ui/HintEngine.test.js
- `detailedFor()` --calls--> `Project`  [INFERRED]
  src/app/src/editor/ui/decideHintAction.test.js → src/app/src/editor/ui/Project.js

## Import Cycles
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js`
- 3-file cycle: `src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/editor/ui/Project.js -> src/app/src/editor/ui/UI.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Project.js`
- 3-file cycle: `src/app/src/editor/ui/Project.js -> src/app/src/editor/ui/UI.js -> src/app/src/editor/ui/Undo.js -> src/app/src/editor/ui/Project.js`
- 3-file cycle: `src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ui/UI.js -> src/app/src/editor/ui/ScriptsPane.js`
- 3-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 3-file cycle: `src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Layer.js`
- 3-file cycle: `src/app/src/iPad/iOS.js -> src/app/src/lobby/Lobby.js -> src/app/src/lobby/Samples.js -> src/app/src/iPad/iOS.js`
- 3-file cycle: `src/app/src/iPad/iOS.js -> src/app/src/utils/ScratchAudio.js -> src/app/src/utils/Sound.js -> src/app/src/iPad/iOS.js`
- 3-file cycle: `src/app/src/iPad/IO.js -> src/app/src/lobby/Lobby.js -> src/app/src/lobby/Samples.js -> src/app/src/iPad/IO.js`
- 4-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js -> src/app/src/editor/ScratchJr.js`
- 4-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`

## Communities (103 total, 44 thin omitted)

### Community 0 - "Teacher Live Monitoring"
Cohesion: 0.05
Nodes (74): applyHoverTarget(), applyPageList(), applyStageState(), applyUiState(), buildMirrorPayload(), fakeTouchEvent(), _findHoverElement(), hideLockOverlay() (+66 more)

### Community 1 - "Paint Editor Actions"
Cohesion: 0.05
Nodes (51): decide(), detailedFor(), intro, evaluate(), proj(), teacherProject(), actorLabelFor(), alertText() (+43 more)

### Community 2 - "Project Model & Hint Alignment"
Cohesion: 0.06
Nodes (28): apiFetch(), AssignmentBadge, authHeader(), blockBlinkEls, characterThumbSrc(), dismissedHintIds, recordHintEvent(), wrongValueAlerted (+20 more)

### Community 7 - "Paint Vector Ops"
Cohesion: 0.09
Nodes (14): onBackButtonCallback, workingCanvas, workingCanvas2, editorApiFetch(), patchIOForAssignmentEdit(), keys, isCharacterAtLimit(), Cookie (+6 more)

### Community 9 - "Audio & Localization"
Cohesion: 0.06
Nodes (36): { buildProjectFromPlan }, { buildStagePlacements }, canEditAssignment(), { computeProjectManifest, compareManifests }, { createClient }, express, findOwnedTemplateProject(), { generateActivityPlan } (+28 more)

### Community 10 - "Vector Path Ops (4)"
Cohesion: 0.09
Nodes (17): apiFetch(), authHeader(), closeOverlay(), GenerateActivityModal, gotoEditor(), guessDefaultLevel(), MOCK_STUDENT_TOKENS, ALL_NIVEIS (+9 more)

### Community 11 - "Home Screen"
Cohesion: 0.07
Nodes (11): applyScratchJrPlayerPatches(), Page, applyPagePlayerPatches(), applySpritePlayerPatches(), applyStagePlayerPatches(), EMOJIS, LABELS, playerMain() (+3 more)

### Community 12 - "Stage Rendering"
Cohesion: 0.13
Nodes (19): costumeVariants, allCharactersAtLimit(), getGalleryRestriction(), showAssignmentToast(), buffer, pinchcenter, CSSTransition(), drawScaled() (+11 more)

### Community 23 - "Page Model"
Cohesion: 0.11
Nodes (3): Events, Home, homeApiFetch()

### Community 25 - "Block Palette"
Cohesion: 0.09
Nodes (11): costumes, fontcolors, fontsizes, getshapes, loadassets, sendshapes, speeds, ScriptsPane (+3 more)

### Community 26 - "Assignment Badge State"
Cohesion: 0.14
Nodes (21): maskCanvas, maskData, offscreen, targetOffscreen, deltaPoint, initialPoint, pensizes, cmdForClick (+13 more)

### Community 28 - "Block Specs Lookup"
Cohesion: 0.13
Nodes (9): gettingStartedMain(), homeMain(), homeStrings(), inappAbout(), inappBlocksGuide(), inappInterfaceGuide(), inappPaintEditorGuide(), Lobby (+1 more)

### Community 32 - "Project Lobby"
Cohesion: 0.32
Nodes (26): a(), b(), c(), d(), e(), f(), g(), h() (+18 more)

### Community 37 - "Snap.svg Vendor Lib"
Cohesion: 0.08
Nodes (20): allowedOrigins, app, assignmentsRoutes, cors, corsOptions, dbRoutes, envOrigins, express (+12 more)

### Community 38 - "Scripts Pane"
Cohesion: 0.17
Nodes (8): apiFetch(), AssignmentAuthorBar, authHeader(), cachedHints, getAuthorId(), HINT_WHEN_LABELS, hintWhenLabel(), isAllowedReturnUrl()

### Community 40 - "Matrix Geometry"
Cohesion: 0.09
Nodes (3): SnapElement, SnapPaper, SnapShim

### Community 42 - "Paint Transform Math"
Cohesion: 0.18
Nodes (4): hopList, Grid, newCanvas(), newP()

### Community 44 - "Native Platform Bridge"
Cohesion: 0.19
Nodes (13): automaticChecks, ensureAssignmentCaptures(), saveAssignmentCaptures(), manifest, mocks, request(), canvas(), captureActor() (+5 more)

### Community 45 - "Vector Path Ops (2)"
Cohesion: 0.14
Nodes (12): css_vh(), css_vw(), ensureEditorFrames(), fitInRect(), getDocumentHeight(), getFit(), getViewportHeight(), getViewportWidth() (+4 more)

### Community 46 - "Paint Ghost Preview"
Cohesion: 0.16
Nodes (3): Runtime, mocks, token()

### Community 47 - "Palette Scrolling"
Cohesion: 0.24
Nodes (8): costumeOptions(), drawCostumeChoice(), drawPlaceholder(), imageCache, loadIO(), menuGrid(), Menu, drawThumbnail()

### Community 49 - "Block Primitives Engine (3)"
Cohesion: 0.18
Nodes (4): Alert, getStringSize(), setCanvasSize(), writeText()

### Community 53 - "Stage Placement Ghost"
Cohesion: 0.13
Nodes (4): MediaLib, catalog, portuguese, {requestFromServer}

### Community 61 - "ScratchJr Core (4)"
Cohesion: 0.24
Nodes (6): indexFirstTime(), indexLoadOptions(), indexLoadStart(), indexMain(), setClassOfElementById(), getUrlVars()

### Community 71 - "Node Stream Shim"
Cohesion: 0.20
Nodes (5): { CAPTURE_BUCKET }, { createClient }, express, express, routes

### Community 75 - "Sound Playback"
Cohesion: 0.28
Nodes (3): PollScheduler, scheduleNext(), trackActivity()

### Community 78 - "Community 81"
Cohesion: 0.43
Nodes (3): apiFetch(), authHeader(), MissionsMenu

### Community 81 - "ScratchJr Core (5)"
Cohesion: 0.52
Nodes (3): apiFetch(), AssignmentNotice, authHeader()

### Community 84 - "SVG to Canvas (5)"
Cohesion: 0.29
Nodes (3): Readable, Transform, Writable

### Community 96 - "Paint Core (3)"
Cohesion: 0.67
Nodes (3): getHex(), rgbaToHex(), rgbToString()

## Knowledge Gaps
- **129 isolated node(s):** `{ createHash }`, `express`, `{ CAPTURE_RENDERER_VERSION, isCurrentCapture, CAPTURE_BUCKET, fingerprint, projectSnapshot, captureManifest, decodePNG, imagePath }`, `express`, `createRoutes` (+124 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **44 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `gn()` connect `Block Specs Lookup` to `Teacher Live Monitoring`, `Project Model & Hint Alignment`, `SVG Drawing Tools`, `Sprite Behavior`, `Block Specs Lookup`, `Sprite Thumbnails`, `Paint Vector Ops`, `Editor UI Shell`, `Vector Path Ops (4)`, `Home Screen`, `Stage Rendering`, `Backend API Client`, `Student Hint Badge UI`, `Block Scripts Model`, `Shared Player Patches`, `Block Primitives Engine`, `Hint Engine Regression Tests`, `Page Model`, `Block Palette`, `Assignment Badge State`, `Block Rendering`, `Paint Editor Core`, `Paint Core (2)`, `Sound Recording`, `Home Screen`, `DOM Helper Utilities`, `Paint Layers`, `Hint Engine Core`, `Paint Transform Math`, `Teacher Assignment Authoring`, `Vector Path Ops (2)`, `Vector Path Ops (3)`, `Block Primitives Engine (3)`, `SVG to Canvas (2)`, `Project Model & Hint Alignment`, `Paint Core (5)`, `Paint Ghost Preview`, `Paint Camera/Zoom`, `ScratchJr Core (4)`, `Editor UI Shell`, `Home Screen`, `Hint Poll Scheduling`, `Usage Time Tracking`, `Vector Path Ops (6)`, `Audio & Localization (2)`, `Community 81`, `Menus & Alerts`, `ScratchJr Core (5)`, `ScratchJr Core (6)`, `SVG to Canvas (4)`, `SVG to Canvas (6)`, `Paint Core (4)`, `Community 93`?**
  _High betweenness centrality (0.297) - this node is a cross-community bridge._
- **Why does `ScratchJr` connect `Student Hint Badge UI` to `Teacher Live Monitoring`, `Paint Core (4)`, `Paint Vector Ops`, `Backend API Client`, `Paint Transform Math`, `Home Screen`, `Stage Rendering`, `Native Platform Bridge`, `SVG Image Loading`, `Vector Path Ops (3)`, `Block Palette`, `Assignment Badge State`, `Paint Core (4)`, `Community 93`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **Why does `newHTML()` connect `Stage Rendering` to `Teacher Live Monitoring`, `Project Model & Hint Alignment`, `Sprite Behavior`, `Block Specs Lookup`, `Paint Vector Ops`, `Vector Path Ops (4)`, `Home Screen`, `Student Hint Badge UI`, `Block Scripts Model`, `Shared Player Patches`, `Hint Engine Regression Tests`, `Page Model`, `Block Palette`, `Assignment Badge State`, `Block Specs Lookup`, `Home Screen`, `Paint Layers`, `Scripts Pane`, `Vector Path Ops (2)`, `Palette Scrolling`, `Block Primitives Engine (3)`, `Paint Ghost Preview`, `Paint Ghost Preview`, `Editor UI Shell`, `Audio & Localization (2)`, `Community 81`, `ScratchJr Core (6)`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **What connects `{ createHash }`, `express`, `{ CAPTURE_RENDERER_VERSION, isCurrentCapture, CAPTURE_BUCKET, fingerprint, projectSnapshot, captureManifest, decodePNG, imagePath }` to the rest of the system?**
  _129 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Teacher Live Monitoring` be split into smaller, more focused modules?**
  _Cohesion score 0.05450372920252438 - nodes in this community are weakly interconnected._
- **Should `Paint Editor Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.05009009009009009 - nodes in this community are weakly interconnected._
- **Should `Project Model & Hint Alignment` be split into smaller, more focused modules?**
  _Cohesion score 0.05714285714285714 - nodes in this community are weakly interconnected._