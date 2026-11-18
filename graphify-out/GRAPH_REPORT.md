# Graph Report - .  (2026-11-18)

## Corpus Check
- 6 files · ~156,002 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2251 nodes · 5458 edges · 107 communities (69 shown, 38 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 29 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Teacher Live Monitoring|Teacher Live Monitoring]]
- [[_COMMUNITY_Project Model & Hint Alignment|Project Model & Hint Alignment]]
- [[_COMMUNITY_Paint Editor Actions|Paint Editor Actions]]
- [[_COMMUNITY_Block Specs Lookup|Block Specs Lookup]]
- [[_COMMUNITY_Sprite Behavior|Sprite Behavior]]
- [[_COMMUNITY_SVG Drawing Tools|SVG Drawing Tools]]
- [[_COMMUNITY_Backend API Client|Backend API Client]]
- [[_COMMUNITY_Sprite Thumbnails|Sprite Thumbnails]]
- [[_COMMUNITY_Paint Vector Ops|Paint Vector Ops]]
- [[_COMMUNITY_Editor UI Shell|Editor UI Shell]]
- [[_COMMUNITY_Audio & Localization|Audio & Localization]]
- [[_COMMUNITY_Home Screen|Home Screen]]
- [[_COMMUNITY_Stage Rendering|Stage Rendering]]
- [[_COMMUNITY_Student Hint Badge UI|Student Hint Badge UI]]
- [[_COMMUNITY_ScratchJr App Core|ScratchJr App Core]]
- [[_COMMUNITY_Media Library Browser|Media Library Browser]]
- [[_COMMUNITY_Shared Player Patches|Shared Player Patches]]
- [[_COMMUNITY_Block Scripts Model|Block Scripts Model]]
- [[_COMMUNITY_SVG to Canvas Rendering|SVG to Canvas Rendering]]
- [[_COMMUNITY_Teacher Assignment Authoring|Teacher Assignment Authoring]]
- [[_COMMUNITY_Block Primitives Engine|Block Primitives Engine]]
- [[_COMMUNITY_Hint Engine Regression Tests|Hint Engine Regression Tests]]
- [[_COMMUNITY_Page Model|Page Model]]
- [[_COMMUNITY_Block Palette|Block Palette]]
- [[_COMMUNITY_Vector Path Model|Vector Path Model]]
- [[_COMMUNITY_Block Rendering|Block Rendering]]
- [[_COMMUNITY_Paint Editor Core|Paint Editor Core]]
- [[_COMMUNITY_Paint Core (2)|Paint Core (2)]]
- [[_COMMUNITY_Paint Transform Math|Paint Transform Math]]
- [[_COMMUNITY_Snap.svg Vendor Lib|Snap.svg Vendor Lib]]
- [[_COMMUNITY_Sound Recording|Sound Recording]]
- [[_COMMUNITY_Project Lobby|Project Lobby]]
- [[_COMMUNITY_Teacher Assignment Authoring|Teacher Assignment Authoring]]
- [[_COMMUNITY_DOM Helper Utilities|DOM Helper Utilities]]
- [[_COMMUNITY_Paint Layers|Paint Layers]]
- [[_COMMUNITY_Scripts Pane|Scripts Pane]]
- [[_COMMUNITY_Undo Stack|Undo Stack]]
- [[_COMMUNITY_Snap.svg Shim|Snap.svg Shim]]
- [[_COMMUNITY_Hint Engine Core|Hint Engine Core]]
- [[_COMMUNITY_Vector Path Ops (2)|Vector Path Ops (2)]]
- [[_COMMUNITY_Native Platform Bridge|Native Platform Bridge]]
- [[_COMMUNITY_Assignment Badge State|Assignment Badge State]]
- [[_COMMUNITY_Block Rendering|Block Rendering]]
- [[_COMMUNITY_Palette Scrolling|Palette Scrolling]]
- [[_COMMUNITY_Block Specs Lookup|Block Specs Lookup]]
- [[_COMMUNITY_Vector Path Ops (3)|Vector Path Ops (3)]]
- [[_COMMUNITY_Vector Path Ops (4)|Vector Path Ops (4)]]
- [[_COMMUNITY_Block Specs Data|Block Specs Data]]
- [[_COMMUNITY_Home Screen|Home Screen]]
- [[_COMMUNITY_Paint Ghost Preview|Paint Ghost Preview]]
- [[_COMMUNITY_Paint Ghost Preview|Paint Ghost Preview]]
- [[_COMMUNITY_Block Primitives Engine (2)|Block Primitives Engine (2)]]
- [[_COMMUNITY_Stage Placement Ghost|Stage Placement Ghost]]
- [[_COMMUNITY_Paint Undo History|Paint Undo History]]
- [[_COMMUNITY_SVG to Canvas (3)|SVG to Canvas (3)]]
- [[_COMMUNITY_Matrix Geometry|Matrix Geometry]]
- [[_COMMUNITY_Paint CameraZoom|Paint Camera/Zoom]]
- [[_COMMUNITY_Sample Projects|Sample Projects]]
- [[_COMMUNITY_Usage Time Tracking|Usage Time Tracking]]
- [[_COMMUNITY_Paint Core (4)|Paint Core (4)]]
- [[_COMMUNITY_Paint Core (6)|Paint Core (6)]]
- [[_COMMUNITY_Assignment Notices|Assignment Notices]]
- [[_COMMUNITY_Vector Path Ops (6)|Vector Path Ops (6)]]
- [[_COMMUNITY_PNG Cache|PNG Cache]]
- [[_COMMUNITY_Audio & Localization (2)|Audio & Localization (2)]]
- [[_COMMUNITY_Sound Playback|Sound Playback]]
- [[_COMMUNITY_SVG Image Loading|SVG Image Loading]]
- [[_COMMUNITY_Paint Core (5)|Paint Core (5)]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Menus & Alerts|Menus & Alerts]]
- [[_COMMUNITY_Vector Path Ops (5)|Vector Path Ops (5)]]
- [[_COMMUNITY_ScratchJr Core (5)|ScratchJr Core (5)]]
- [[_COMMUNITY_SVG to Canvas (5)|SVG to Canvas (5)]]
- [[_COMMUNITY_Poll Scheduler Tests|Poll Scheduler Tests]]
- [[_COMMUNITY_SVG to Canvas (6)|SVG to Canvas (6)]]
- [[_COMMUNITY_Math Modulo Helper|Math Modulo Helper]]
- [[_COMMUNITY_Paint Core (4)|Paint Core (4)]]
- [[_COMMUNITY_Community 96|Community 96]]

## God Nodes (most connected - your core abstractions)
1. `gn()` - 338 edges
2. `newHTML()` - 119 edges
3. `Paint` - 118 edges
4. `ScratchJr` - 116 edges
5. `SVG2Canvas` - 84 edges
6. `PaintAction` - 72 edges
7. `UI` - 69 edges
8. `iOS` - 67 edges
9. `Sprite` - 63 edges
10. `setProps()` - 63 edges

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
- 3-file cycle: `src/app/src/editor/ui/Palette.js -> src/app/src/editor/ui/Undo.js -> src/app/src/editor/ui/Project.js -> src/app/src/editor/ui/Palette.js`
- 3-file cycle: `src/app/src/editor/ui/Project.js -> src/app/src/editor/ui/UI.js -> src/app/src/editor/ui/Undo.js -> src/app/src/editor/ui/Project.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/editor/ui/Palette.js -> src/app/src/editor/blocks/Block.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/editor/ui/Palette.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Project.js -> src/app/src/editor/ui/Palette.js`
- 3-file cycle: `src/app/src/editor/ui/Project.js -> src/app/src/editor/ui/UI.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Project.js`
- 3-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 3-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 3-file cycle: `src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ui/UI.js -> src/app/src/editor/ui/ScriptsPane.js`
- 3-file cycle: `src/app/src/editor/ui/Palette.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ui/Palette.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Layer.js`
- 3-file cycle: `src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/iPad/IO.js -> src/app/src/lobby/Lobby.js -> src/app/src/lobby/Samples.js -> src/app/src/iPad/IO.js`

## Communities (107 total, 38 thin omitted)

### Community 0 - "Teacher Live Monitoring"
Cohesion: 0.05
Nodes (74): applyHoverTarget(), applyPageList(), applyStageState(), applyUiState(), buildMirrorPayload(), fakeTouchEvent(), _findHoverElement(), hideLockOverlay() (+66 more)

### Community 2 - "Paint Editor Actions"
Cohesion: 0.10
Nodes (21): costumes, fontcolors, fontsizes, getshapes, loadassets, sendshapes, speeds, onBackButtonCallback (+13 more)

### Community 3 - "Block Specs Lookup"
Cohesion: 0.08
Nodes (24): Vector, maskCanvas, maskData, offscreen, targetOffscreen, deltaPoint, initialPoint, pensizes (+16 more)

### Community 5 - "SVG Drawing Tools"
Cohesion: 0.06
Nodes (3): UI, css_vh(), getViewportHeight()

### Community 6 - "Backend API Client"
Cohesion: 0.07
Nodes (4): proj(), teacherProject(), script(), Project

### Community 9 - "Editor UI Shell"
Cohesion: 0.06
Nodes (36): { buildProjectFromPlan }, { buildStagePlacements }, canEditAssignment(), { computeProjectManifest, compareManifests }, { createClient }, express, findOwnedTemplateProject(), { generateActivityPlan } (+28 more)

### Community 10 - "Audio & Localization"
Cohesion: 0.07
Nodes (11): applyScratchJrPlayerPatches(), Page, applyPagePlayerPatches(), applySpritePlayerPatches(), applyStagePlayerPatches(), EMOJIS, LABELS, playerMain() (+3 more)

### Community 11 - "Home Screen"
Cohesion: 0.09
Nodes (3): Library, getDocumentHeight(), getDocumentWidth()

### Community 16 - "Shared Player Patches"
Cohesion: 0.11
Nodes (3): AssignmentBadge, characterThumbSrc(), recordHintEvent()

### Community 19 - "Teacher Assignment Authoring"
Cohesion: 0.11
Nodes (3): Events, Home, homeApiFetch()

### Community 23 - "Block Palette"
Cohesion: 0.11
Nodes (7): BlockArg, costumeOptions(), drawCostumeChoice(), drawPlaceholder(), imageCache, loadIO(), menuGrid()

### Community 24 - "Vector Path Model"
Cohesion: 0.15
Nodes (9): Menu, Alert, CSSTransition(), getStringSize(), globalx(), globaly(), setCanvasSize(), setProps() (+1 more)

### Community 28 - "Paint Transform Math"
Cohesion: 0.12
Nodes (3): editorApiFetch(), patchIOForAssignmentEdit(), IO

### Community 29 - "Snap.svg Vendor Lib"
Cohesion: 0.11
Nodes (22): colorToRGBA(), css_vw(), drawScaled(), drawThumbnail(), ensureEditorFrames(), fitInRect(), getFit(), getHex() (+14 more)

### Community 31 - "Project Lobby"
Cohesion: 0.32
Nodes (26): a(), b(), c(), d(), e(), f(), g(), h() (+18 more)

### Community 32 - "Teacher Assignment Authoring"
Cohesion: 0.14
Nodes (19): evaluate(), actorLabelFor(), ALWAYS_PENDING_WHEN_TYPES, BLOCK_LABELS, blockMatch(), candidatesFor(), ENCODE_SKIPPED_TYPES, expectedCache (+11 more)

### Community 33 - "DOM Helper Utilities"
Cohesion: 0.11
Nodes (3): ScriptsPane, localx(), localy()

### Community 36 - "Undo Stack"
Cohesion: 0.08
Nodes (20): allowedOrigins, app, assignmentsRoutes, cors, corsOptions, dbRoutes, envOrigins, express (+12 more)

### Community 38 - "Hint Engine Core"
Cohesion: 0.19
Nodes (5): hopList, Grid, newCanvas(), newDiv(), newP()

### Community 40 - "Native Platform Bridge"
Cohesion: 0.09
Nodes (3): SnapElement, SnapPaper, SnapShim

### Community 42 - "Block Rendering"
Cohesion: 0.15
Nodes (7): homeMain(), homeStrings(), inappAbout(), inappBlocksGuide(), inappInterfaceGuide(), inappPaintEditorGuide(), gn()

### Community 44 - "Palette Scrolling"
Cohesion: 0.19
Nodes (13): automaticChecks, ensureAssignmentCaptures(), saveAssignmentCaptures(), manifest, mocks, request(), canvas(), captureActor() (+5 more)

### Community 45 - "Block Specs Lookup"
Cohesion: 0.13
Nodes (14): allCharactersAtLimit(), getGalleryRestriction(), getStagePlacements(), isCharacterAtLimit(), isMissionPending(), registerGalleryRestrictionProvider(), registerMissionPendingProvider(), registerStagePlacementGhostRenderer() (+6 more)

### Community 46 - "Vector Path Ops (3)"
Cohesion: 0.16
Nodes (3): Runtime, mocks, token()

### Community 48 - "Vector Path Ops (4)"
Cohesion: 0.23
Nodes (8): apiFetch(), authHeader(), closeOverlay(), GenerateActivityModal, gotoEditor(), guessDefaultLevel(), MOCK_STUDENT_TOKENS, decodeJwtPayloadUnsafe()

### Community 49 - "Block Specs Data"
Cohesion: 0.24
Nodes (6): ALL_NIVEIS, apiFetch(), authHeader(), MyLessons, NIVEL_LABELS, nivelLabel()

### Community 50 - "Home Screen"
Cohesion: 0.13
Nodes (9): alertText(), blockLabel(), spokenValue(), ALL_PROJECTS, CARETS, FIXTURE_DIR, fixtures, SYNTHETIC (+1 more)

### Community 53 - "Block Primitives Engine (2)"
Cohesion: 0.19
Nodes (7): gettingStartedMain(), indexFirstTime(), indexLoadOptions(), indexLoadStart(), indexMain(), setClassOfElementById(), getUrlVars()

### Community 55 - "Paint Undo History"
Cohesion: 0.13
Nodes (4): MediaLib, catalog, portuguese, {requestFromServer}

### Community 60 - "SVG to Canvas (3)"
Cohesion: 0.31
Nodes (3): apiFetch(), authHeader(), OfficialCatalog

### Community 63 - "Paint Camera/Zoom"
Cohesion: 0.35
Nodes (11): buildGhost(), ghostTransform(), isNearTarget(), liveSpritesOf(), matchStagePlacements(), reconcile(), removeAllGhosts(), removeGhostEl() (+3 more)

### Community 68 - "Sample Projects"
Cohesion: 0.23
Nodes (10): alignmentInfo(), expectedResultOf(), expectedResultsFor(), freshAlignmentTarget(), alignAlerts(), blockHint(), detailedFor(), expectedHint() (+2 more)

### Community 73 - "Paint Core (6)"
Cohesion: 0.29
Nodes (7): apiFetch(), authHeader(), cachedHints, getAuthorId(), HINT_WHEN_LABELS, hintWhenLabel(), isAllowedReturnUrl()

### Community 75 - "Assignment Notices"
Cohesion: 0.20
Nodes (5): { CAPTURE_BUCKET }, { createClient }, express, express, routes

### Community 76 - "Vector Path Ops (6)"
Cohesion: 0.22
Nodes (7): apiFetch(), authHeader(), blockBlinkEls, dismissedHintIds, wrongValueAlerted, nthEncodedBlock(), resolveLiveBlock()

### Community 77 - "PNG Cache"
Cohesion: 0.27
Nodes (8): decide(), detailedFor(), intro, decideHintAction(), legacyShadowedByExpected(), nextProactiveHint(), sameActorLoose(), decide()

### Community 81 - "SVG Image Loading"
Cohesion: 0.28
Nodes (3): PollScheduler, scheduleNext(), trackActivity()

### Community 84 - "Menus & Alerts"
Cohesion: 0.43
Nodes (3): apiFetch(), authHeader(), MissionsMenu

### Community 86 - "ScratchJr Core (5)"
Cohesion: 0.52
Nodes (3): apiFetch(), AssignmentNotice, authHeader()

### Community 89 - "SVG to Canvas (5)"
Cohesion: 0.29
Nodes (3): Readable, Transform, Writable

## Knowledge Gaps
- **129 isolated node(s):** `{ createHash }`, `express`, `{ CAPTURE_RENDERER_VERSION, isCurrentCapture, CAPTURE_BUCKET, fingerprint, projectSnapshot, captureManifest, decodePNG, imagePath }`, `express`, `createRoutes` (+124 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **38 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `gn()` connect `Block Rendering` to `Teacher Live Monitoring`, `Project Model & Hint Alignment`, `Paint Editor Actions`, `Block Specs Lookup`, `Sprite Behavior`, `SVG Drawing Tools`, `Backend API Client`, `Sprite Thumbnails`, `Paint Vector Ops`, `Audio & Localization`, `Home Screen`, `Stage Rendering`, `Student Hint Badge UI`, `Media Library Browser`, `Block Scripts Model`, `SVG to Canvas Rendering`, `Teacher Assignment Authoring`, `Hint Engine Regression Tests`, `Page Model`, `Vector Path Model`, `Paint Editor Core`, `Paint Core (2)`, `Snap.svg Vendor Lib`, `Sound Recording`, `DOM Helper Utilities`, `Paint Layers`, `Scripts Pane`, `Snap.svg Shim`, `Hint Engine Core`, `Vector Path Ops (2)`, `Assignment Badge State`, `Paint Ghost Preview`, `Block Specs Lookup`, `Block Primitives Engine (3)`, `Block Specs Data`, `Block Primitives Engine (2)`, `SVG to Canvas (2)`, `Project Model & Hint Alignment`, `Paint Core (5)`, `Project Model & Hint Alignment`, `SVG to Canvas (3)`, `Paint Ghost Preview`, `ScratchJr Core (4)`, `Editor UI Shell`, `Home Screen`, `Paint Core (4)`, `Vector Path Ops (6)`, `Audio & Localization (2)`, `Menus & Alerts`, `ScratchJr Core (5)`, `ScratchJr Core (6)`, `SVG to Canvas (4)`, `Community 93`, `Path Drawing Helpers`?**
  _High betweenness centrality (0.295) - this node is a cross-community bridge._
- **Why does `ScratchJr` connect `Student Hint Badge UI` to `Teacher Live Monitoring`, `Community 93`, `Paint Editor Actions`, `Path Drawing Helpers`, `Block Specs Lookup`, `Hint Poll Scheduling`, `Hint Engine Core`, `Paint Core (6)`, `Audio & Localization`, `Palette Scrolling`, `Node Stream Shim`, `Block Primitives Engine (3)`, `Paint Core (5)`, `Vector Path Model`, `Paint Transform Math`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Why does `newHTML()` connect `Assignment Badge State` to `Teacher Live Monitoring`, `Paint Editor Actions`, `Block Specs Lookup`, `Sprite Behavior`, `SVG Drawing Tools`, `Backend API Client`, `Audio & Localization`, `Home Screen`, `Stage Rendering`, `Student Hint Badge UI`, `Media Library Browser`, `Block Scripts Model`, `Teacher Assignment Authoring`, `Hint Engine Regression Tests`, `Vector Path Model`, `Paint Core (2)`, `Snap.svg Vendor Lib`, `Paint Layers`, `Snap.svg Shim`, `Block Specs Lookup`, `Vector Path Ops (4)`, `Block Specs Data`, `Paint Ghost Preview`, `SVG to Canvas (3)`, `Matrix Geometry`, `ScratchJr Core (4)`, `Paint Core (6)`, `Vector Path Ops (6)`, `Audio & Localization (2)`, `Menus & Alerts`, `ScratchJr Core (6)`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **What connects `{ createHash }`, `express`, `{ CAPTURE_RENDERER_VERSION, isCurrentCapture, CAPTURE_BUCKET, fingerprint, projectSnapshot, captureManifest, decodePNG, imagePath }` to the rest of the system?**
  _129 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Teacher Live Monitoring` be split into smaller, more focused modules?**
  _Cohesion score 0.05450372920252438 - nodes in this community are weakly interconnected._
- **Should `Project Model & Hint Alignment` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._
- **Should `Paint Editor Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.10087045570916539 - nodes in this community are weakly interconnected._