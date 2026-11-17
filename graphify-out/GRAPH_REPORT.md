# Graph Report - .  (2026-11-17)

## Corpus Check
- 1 files · ~154,860 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2240 nodes · 5484 edges · 109 communities (68 shown, 41 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 30 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Block Rendering|Block Rendering]]
- [[_COMMUNITY_Paint Ghost Preview|Paint Ghost Preview]]
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
- [[_COMMUNITY_SVG to Canvas (2)|SVG to Canvas (2)]]
- [[_COMMUNITY_Project Model & Hint Alignment|Project Model & Hint Alignment]]
- [[_COMMUNITY_Project Model & Hint Alignment|Project Model & Hint Alignment]]
- [[_COMMUNITY_Paint Ghost Preview|Paint Ghost Preview]]
- [[_COMMUNITY_Matrix Geometry|Matrix Geometry]]
- [[_COMMUNITY_Paint CameraZoom|Paint Camera/Zoom]]
- [[_COMMUNITY_Editor UI Shell|Editor UI Shell]]
- [[_COMMUNITY_Editor UI Shell|Editor UI Shell]]
- [[_COMMUNITY_Home Screen|Home Screen]]
- [[_COMMUNITY_Paint Core (3)|Paint Core (3)]]
- [[_COMMUNITY_Paint Core (6)|Paint Core (6)]]
- [[_COMMUNITY_JSZip Vendor Shim|JSZip Vendor Shim]]
- [[_COMMUNITY_PNG Cache|PNG Cache]]
- [[_COMMUNITY_Audio & Localization (2)|Audio & Localization (2)]]
- [[_COMMUNITY_Sound Playback|Sound Playback]]
- [[_COMMUNITY_SVG Image Loading|SVG Image Loading]]
- [[_COMMUNITY_Paint Core (5)|Paint Core (5)]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Menus & Alerts|Menus & Alerts]]
- [[_COMMUNITY_ScratchJr Core (5)|ScratchJr Core (5)]]
- [[_COMMUNITY_ScratchJr Core (6)|ScratchJr Core (6)]]
- [[_COMMUNITY_SVG to Canvas (6)|SVG to Canvas (6)]]
- [[_COMMUNITY_Project Test Fixtures|Project Test Fixtures]]
- [[_COMMUNITY_Math Modulo Helper|Math Modulo Helper]]
- [[_COMMUNITY_Path Drawing Helpers|Path Drawing Helpers]]
- [[_COMMUNITY_Paint Core (3)|Paint Core (3)]]
- [[_COMMUNITY_Canvas Layer Drawing|Canvas Layer Drawing]]

## God Nodes (most connected - your core abstractions)
1. `gn()` - 338 edges
2. `newHTML()` - 123 edges
3. `Paint` - 118 edges
4. `ScratchJr` - 117 edges
5. `SVG2Canvas` - 84 edges
6. `PaintAction` - 72 edges
7. `UI` - 69 edges
8. `iOS` - 67 edges
9. `setProps()` - 66 edges
10. `Sprite` - 63 edges

## Surprising Connections (you probably didn't know these)
- `blockMatch()` --calls--> `evaluate()`  [INFERRED]
  src/app/src/editor/ui/HintEngine.js → src/app/src/editor/ui/hintAlignment.test.js
- `teacherProject()` --calls--> `script()`  [INFERRED]
  src/app/src/editor/ui/hintAlignment.test.js → src/app/src/editor/ui/HintEngine.test.js
- `detailedFor()` --calls--> `Project`  [INFERRED]
  src/app/src/editor/ui/decideHintAction.test.js → src/app/src/editor/ui/Project.js
- `proj()` --calls--> `Project`  [INFERRED]
  src/app/src/editor/ui/hintAlignment.test.js → src/app/src/editor/ui/Project.js
- `detailedFor()` --calls--> `Project`  [INFERRED]
  src/app/src/editor/ui/hintRegressions.test.js → src/app/src/editor/ui/Project.js

## Import Cycles
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 3-file cycle: `src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Layer.js`
- 3-file cycle: `src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/editor/ui/Palette.js -> src/app/src/editor/ui/Undo.js -> src/app/src/editor/ui/Project.js -> src/app/src/editor/ui/Palette.js`
- 3-file cycle: `src/app/src/editor/ui/Project.js -> src/app/src/editor/ui/UI.js -> src/app/src/editor/ui/Undo.js -> src/app/src/editor/ui/Project.js`
- 3-file cycle: `src/app/src/editor/ui/Palette.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Project.js -> src/app/src/editor/ui/Palette.js`
- 3-file cycle: `src/app/src/editor/ui/Project.js -> src/app/src/editor/ui/UI.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Project.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/editor/ui/Palette.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ui/Palette.js`
- 3-file cycle: `src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ui/UI.js -> src/app/src/editor/ui/ScriptsPane.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/editor/ui/Palette.js -> src/app/src/editor/blocks/Block.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/iPad/IO.js -> src/app/src/iPad/MediaLib.js -> src/app/src/utils/Localization.js -> src/app/src/iPad/IO.js`

## Communities (109 total, 41 thin omitted)

### Community 0 - "Teacher Live Monitoring"
Cohesion: 0.06
Nodes (71): applyHoverTarget(), applyPageList(), applyStageState(), applyUiState(), buildMirrorPayload(), fakeTouchEvent(), _findHoverElement(), hideLockOverlay() (+63 more)

### Community 1 - "Project Model & Hint Alignment"
Cohesion: 0.09
Nodes (24): costumes, fontcolors, fontsizes, getshapes, loadassets, sendshapes, speeds, onBackButtonCallback (+16 more)

### Community 3 - "Block Specs Lookup"
Cohesion: 0.05
Nodes (4): UI, css_vh(), getDocumentWidth(), getViewportHeight()

### Community 6 - "Backend API Client"
Cohesion: 0.07
Nodes (6): evaluate(), proj(), teacherProject(), script(), detailedFor(), Project

### Community 8 - "Paint Vector Ops"
Cohesion: 0.06
Nodes (36): { buildProjectFromPlan }, { buildStagePlacements }, canEditAssignment(), { computeProjectManifest, compareManifests }, { createClient }, express, findOwnedTemplateProject(), { generateActivityPlan } (+28 more)

### Community 9 - "Editor UI Shell"
Cohesion: 0.10
Nodes (20): Vector, maskCanvas, maskData, offscreen, targetOffscreen, deltaPoint, initialPoint, pensizes (+12 more)

### Community 10 - "Audio & Localization"
Cohesion: 0.13
Nodes (13): costumeOptions(), drawCostumeChoice(), menuGrid(), Menu, Alert, drawThumbnail(), getStringSize(), globalx() (+5 more)

### Community 11 - "Home Screen"
Cohesion: 0.10
Nodes (5): apiFetch(), AssignmentBadge, authHeader(), characterThumbSrc(), recordHintEvent()

### Community 19 - "Teacher Assignment Authoring"
Cohesion: 0.11
Nodes (3): Events, Home, homeApiFetch()

### Community 22 - "Page Model"
Cohesion: 0.09
Nodes (4): useZeroBlockDefaults(), Palette, drawScaled(), hitRect()

### Community 27 - "Paint Core (2)"
Cohesion: 0.15
Nodes (8): homeMain(), homeStrings(), inappAbout(), inappBlocksGuide(), inappInterfaceGuide(), inappPaintEditorGuide(), Lobby, gn()

### Community 29 - "Snap.svg Vendor Lib"
Cohesion: 0.32
Nodes (26): a(), b(), c(), d(), e(), f(), g(), h() (+18 more)

### Community 30 - "Sound Recording"
Cohesion: 0.12
Nodes (4): ScriptsPane, hit3DRect(), localx(), localy()

### Community 34 - "Paint Layers"
Cohesion: 0.08
Nodes (20): allowedOrigins, app, assignmentsRoutes, cors, corsOptions, dbRoutes, envOrigins, express (+12 more)

### Community 37 - "Snap.svg Shim"
Cohesion: 0.09
Nodes (3): SnapElement, SnapPaper, SnapShim

### Community 38 - "Hint Engine Core"
Cohesion: 0.15
Nodes (17): css_vw(), CSSTransition(), ensureEditorFrames(), fitInRect(), getFit(), getHex(), getRGB(), getViewportWidth() (+9 more)

### Community 40 - "Native Platform Bridge"
Cohesion: 0.21
Nodes (4): hopList, Grid, newDiv(), newP()

### Community 42 - "Block Rendering"
Cohesion: 0.19
Nodes (13): automaticChecks, ensureAssignmentCaptures(), saveAssignmentCaptures(), manifest, mocks, request(), canvas(), captureActor() (+5 more)

### Community 43 - "Paint Ghost Preview"
Cohesion: 0.18
Nodes (12): actorLabelFor(), blockMatch(), candidatesFor(), findSceneAndCharacter(), hintConditionHolds(), isBlockHintDoneFor(), mistakeInfo(), mistakeInfoFor() (+4 more)

### Community 44 - "Palette Scrolling"
Cohesion: 0.16
Nodes (3): Runtime, mocks, token()

### Community 45 - "Block Specs Lookup"
Cohesion: 0.15
Nodes (4): getDocumentHeight(), newHTML(), newImage(), newTextInput()

### Community 46 - "Vector Path Ops (3)"
Cohesion: 0.22
Nodes (10): applyScratchJrPlayerPatches(), applyPagePlayerPatches(), applySpritePlayerPatches(), applyStagePlayerPatches(), EMOJIS, LABELS, playerMain(), _prefetchMedia() (+2 more)

### Community 48 - "Vector Path Ops (4)"
Cohesion: 0.23
Nodes (8): apiFetch(), authHeader(), closeOverlay(), GenerateActivityModal, gotoEditor(), guessDefaultLevel(), MOCK_STUDENT_TOKENS, decodeJwtPayloadUnsafe()

### Community 49 - "Block Specs Data"
Cohesion: 0.24
Nodes (6): ALL_NIVEIS, apiFetch(), authHeader(), MyLessons, NIVEL_LABELS, nivelLabel()

### Community 50 - "Home Screen"
Cohesion: 0.17
Nodes (13): blockBlinkEls, dismissedHintIds, wrongValueAlerted, allCharactersAtLimit(), getStagePlacements(), isCharacterAtLimit(), isMissionPending(), registerGalleryRestrictionProvider() (+5 more)

### Community 51 - "Paint Ghost Preview"
Cohesion: 0.18
Nodes (12): decide(), detailedFor(), intro, decideHintAction(), expectedResultOf(), expectedResultsFor(), nextProactiveHint(), decide() (+4 more)

### Community 52 - "Paint Ghost Preview"
Cohesion: 0.14
Nodes (9): alignmentInfo(), freshAlignmentTarget(), alignAlerts(), ALL_PROJECTS, CARETS, FIXTURE_DIR, fixtures, SYNTHETIC (+1 more)

### Community 57 - "Project Model & Hint Alignment"
Cohesion: 0.13
Nodes (4): MediaLib, catalog, portuguese, {requestFromServer}

### Community 61 - "Paint Ghost Preview"
Cohesion: 0.19
Nodes (13): alertText(), ALWAYS_PENDING_WHEN_TYPES, BLOCK_LABELS, blockLabel(), ENCODE_SKIPPED_TYPES, expectedCache, LEGACY_ALERT_PREFIX, legacyShadowedByExpected() (+5 more)

### Community 62 - "Matrix Geometry"
Cohesion: 0.27
Nodes (4): editorApiFetch(), patchIOForAssignmentEdit(), authHeader(), TimeTracker

### Community 63 - "Paint Camera/Zoom"
Cohesion: 0.31
Nodes (3): apiFetch(), authHeader(), OfficialCatalog

### Community 67 - "Home Screen"
Cohesion: 0.35
Nodes (11): buildGhost(), ghostTransform(), isNearTarget(), liveSpritesOf(), matchStagePlacements(), reconcile(), removeAllGhosts(), removeGhostEl() (+3 more)

### Community 72 - "Paint Core (3)"
Cohesion: 0.25
Nodes (5): indexFirstTime(), indexLoadOptions(), indexLoadStart(), indexMain(), setClassOfElementById()

### Community 77 - "PNG Cache"
Cohesion: 0.20
Nodes (5): { CAPTURE_BUCKET }, { createClient }, express, express, routes

### Community 81 - "SVG Image Loading"
Cohesion: 0.31
Nodes (6): authHeader(), cachedHints, getAuthorId(), HINT_WHEN_LABELS, hintWhenLabel(), isAllowedReturnUrl()

### Community 82 - "Paint Core (5)"
Cohesion: 0.28
Nodes (3): PollScheduler, scheduleNext(), trackActivity()

### Community 84 - "Menus & Alerts"
Cohesion: 0.43
Nodes (3): apiFetch(), authHeader(), MissionsMenu

### Community 87 - "ScratchJr Core (6)"
Cohesion: 0.52
Nodes (3): apiFetch(), AssignmentNotice, authHeader()

### Community 91 - "SVG to Canvas (6)"
Cohesion: 0.29
Nodes (3): Readable, Transform, Writable

## Knowledge Gaps
- **126 isolated node(s):** `{ createHash }`, `express`, `{ CAPTURE_RENDERER_VERSION, isCurrentCapture, CAPTURE_BUCKET, fingerprint, projectSnapshot, captureManifest, decodePNG, imagePath }`, `express`, `createRoutes` (+121 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **41 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `gn()` connect `Paint Core (2)` to `Teacher Live Monitoring`, `Project Model & Hint Alignment`, `Paint Editor Actions`, `Block Specs Lookup`, `Sprite Behavior`, `SVG Drawing Tools`, `Backend API Client`, `Sprite Thumbnails`, `Editor UI Shell`, `Audio & Localization`, `Stage Rendering`, `Student Hint Badge UI`, `Media Library Browser`, `Block Scripts Model`, `SVG to Canvas Rendering`, `Teacher Assignment Authoring`, `Block Primitives Engine`, `Page Model`, `Block Palette`, `Vector Path Model`, `Paint Editor Core`, `Paint Transform Math`, `Sound Recording`, `Project Lobby`, `Teacher Assignment Authoring`, `DOM Helper Utilities`, `Scripts Pane`, `Hint Engine Core`, `Native Platform Bridge`, `Assignment Badge State`, `Block Specs Lookup`, `Block Primitives Engine (3)`, `Block Specs Data`, `Home Screen`, `Paint Undo History`, `Paint Core (5)`, `SVG to Canvas (3)`, `Paint Camera/Zoom`, `Editor UI Shell`, `ScratchJr Core (4)`, `Editor UI Shell`, `Hint Poll Scheduling`, `Usage Time Tracking`, `Paint Core (4)`, `Paint Core (3)`, `JSZip Vendor Shim`, `Audio & Localization (2)`, `Menus & Alerts`, `Vector Path Ops (5)`, `ScratchJr Core (6)`, `SVG to Canvas (4)`, `SVG to Canvas (5)`, `Poll Scheduler Tests`, `Mock Entry Screen`, `Paint Core (4)`, `Fullscreen Control`, `Paint Core (3)`?**
  _High betweenness centrality (0.249) - this node is a cross-community bridge._
- **Why does `newHTML()` connect `Block Specs Lookup` to `Teacher Live Monitoring`, `Project Model & Hint Alignment`, `Block Specs Lookup`, `Sprite Behavior`, `Backend API Client`, `Editor UI Shell`, `Audio & Localization`, `Student Hint Badge UI`, `Media Library Browser`, `SVG to Canvas Rendering`, `Teacher Assignment Authoring`, `Page Model`, `Paint Editor Core`, `Paint Core (2)`, `Sound Recording`, `Project Lobby`, `Scripts Pane`, `Hint Engine Core`, `Vector Path Ops (2)`, `Vector Path Ops (4)`, `Block Specs Data`, `Home Screen`, `Block Primitives Engine (2)`, `Project Model & Hint Alignment`, `Paint Camera/Zoom`, `Editor UI Shell`, `Hint Poll Scheduling`, `Audio & Localization (2)`, `SVG Image Loading`, `Menus & Alerts`, `SVG to Canvas (4)`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **Why does `ScratchJr` connect `Media Library Browser` to `Teacher Live Monitoring`, `Project Model & Hint Alignment`, `Fullscreen Control`, `Community 96`, `Native Platform Bridge`, `Editor UI Shell`, `Audio & Localization`, `Block Rendering`, `Vector Path Ops (3)`, `Node Stream Shim`, `Block Primitives Engine (3)`, `SVG Image Loading`, `Sound Recording`, `Paint Undo History`, `Matrix Geometry`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **What connects `{ createHash }`, `express`, `{ CAPTURE_RENDERER_VERSION, isCurrentCapture, CAPTURE_BUCKET, fingerprint, projectSnapshot, captureManifest, decodePNG, imagePath }` to the rest of the system?**
  _126 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Teacher Live Monitoring` be split into smaller, more focused modules?**
  _Cohesion score 0.056790123456790124 - nodes in this community are weakly interconnected._
- **Should `Project Model & Hint Alignment` be split into smaller, more focused modules?**
  _Cohesion score 0.08738277919863598 - nodes in this community are weakly interconnected._
- **Should `Paint Editor Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._