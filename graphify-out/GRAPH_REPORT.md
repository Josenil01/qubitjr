# Graph Report - .  (2026-09-16)

## Corpus Check
- 6 files · ~115,703 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1950 nodes · 4767 edges · 91 communities (45 shown, 46 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_teacher|teacher]]
- [[_COMMUNITY_PaintAction|PaintAction]]
- [[_COMMUNITY_UI|UI]]
- [[_COMMUNITY_Sprite|Sprite]]
- [[_COMMUNITY_WebInterface|WebInterface]]
- [[_COMMUNITY_AssignmentBadge|AssignmentBadge]]
- [[_COMMUNITY_SVGTools|SVGTools]]
- [[_COMMUNITY_ScratchAudio|ScratchAudio]]
- [[_COMMUNITY_Stage|Stage]]
- [[_COMMUNITY_lib|lib]]
- [[_COMMUNITY_ScratchJr|ScratchJr]]
- [[_COMMUNITY_iOS|iOS]]
- [[_COMMUNITY_Project|Project]]
- [[_COMMUNITY_Thumbs|Thumbs]]
- [[_COMMUNITY_SVG2Canvas|SVG2Canvas]]
- [[_COMMUNITY_Scripts|Scripts]]
- [[_COMMUNITY_Prims|Prims]]
- [[_COMMUNITY_Library|Library]]
- [[_COMMUNITY_PaintAction|PaintAction]]
- [[_COMMUNITY_Palette|Palette]]
- [[_COMMUNITY_Ghost|Ghost]]
- [[_COMMUNITY_Paint|Paint]]
- [[_COMMUNITY_Home|Home]]
- [[_COMMUNITY_Block|Block]]
- [[_COMMUNITY_Path|Path]]
- [[_COMMUNITY_Lobby|Lobby]]
- [[_COMMUNITY_lib|lib]]
- [[_COMMUNITY_Page|Page]]
- [[_COMMUNITY_ScriptsPane|ScriptsPane]]
- [[_COMMUNITY_Transform|Transform]]
- [[_COMMUNITY_snap.svg-min|snap.svg-min]]
- [[_COMMUNITY_Record|Record]]
- [[_COMMUNITY_Events|Events]]
- [[_COMMUNITY_Layer|Layer]]
- [[_COMMUNITY_Menu|Menu]]
- [[_COMMUNITY_Undo|Undo]]
- [[_COMMUNITY_IO|IO]]
- [[_COMMUNITY_snapsvg|snapsvg]]
- [[_COMMUNITY_BlockArg|BlockArg]]
- [[_COMMUNITY_AssignmentAuthorBar|AssignmentAuthorBar]]
- [[_COMMUNITY_player|player]]
- [[_COMMUNITY_Scroll|Scroll]]
- [[_COMMUNITY_Rectangle|Rectangle]]
- [[_COMMUNITY_BlockSpecs|BlockSpecs]]
- [[_COMMUNITY_Runtime|Runtime]]
- [[_COMMUNITY_SVGImage|SVGImage]]
- [[_COMMUNITY_Grid|Grid]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_Vector|Vector]]
- [[_COMMUNITY_PaintUndo|PaintUndo]]
- [[_COMMUNITY_Thread|Thread]]
- [[_COMMUNITY_Matrix|Matrix]]
- [[_COMMUNITY_Camera|Camera]]
- [[_COMMUNITY_Samples|Samples]]
- [[_COMMUNITY_TimeTracker|TimeTracker]]
- [[_COMMUNITY_BlockSpecs|BlockSpecs]]
- [[_COMMUNITY_jszip|jszip]]
- [[_COMMUNITY_AssignmentNotice|AssignmentNotice]]
- [[_COMMUNITY_PNGCache|PNGCache]]
- [[_COMMUNITY_stream|stream]]
- [[_COMMUNITY_AppUsage|AppUsage]]
- [[_COMMUNITY_Sound|Sound]]
- [[_COMMUNITY_DrawPath|DrawPath]]
- [[_COMMUNITY_SVG2Canvas|SVG2Canvas]]

## God Nodes (most connected - your core abstractions)
1. `gn()` - 301 edges
2. `ScratchJr` - 118 edges
3. `Paint` - 115 edges
4. `newHTML()` - 91 edges
5. `SVG2Canvas` - 83 edges
6. `PaintAction` - 72 edges
7. `UI` - 69 edges
8. `iOS` - 66 edges
9. `setProps()` - 65 edges
10. `Sprite` - 63 edges

## Surprising Connections (you probably didn't know these)
- `setClassOfElementById()` --calls--> `gn()`  [EXTRACTED]
  src/app/src/entry/index.js → src/app/src/utils/lib.js
- `_warnStudentCameOnline()` --calls--> `newHTML()`  [EXTRACTED]
  src/app/src/entry/teacher.js → src/app/src/utils/lib.js
- `applyStageState()` --calls--> `gn()`  [EXTRACTED]
  src/app/src/editor/LiveMirror.js → src/app/src/utils/lib.js
- `applyUiState()` --calls--> `gn()`  [EXTRACTED]
  src/app/src/editor/LiveMirror.js → src/app/src/utils/lib.js
- `_findHoverElement()` --calls--> `gn()`  [EXTRACTED]
  src/app/src/editor/LiveMirror.js → src/app/src/utils/lib.js

## Import Cycles
- 3-file cycle: `src/app/src/editor/ui/Palette.js -> src/app/src/editor/ui/Undo.js -> src/app/src/editor/ui/Project.js -> src/app/src/editor/ui/Palette.js`
- 3-file cycle: `src/app/src/editor/ui/Palette.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Project.js -> src/app/src/editor/ui/Palette.js`
- 3-file cycle: `src/app/src/editor/ui/Palette.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ui/Palette.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js`
- 3-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 3-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 3-file cycle: `src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Layer.js`
- 3-file cycle: `src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js`
- 3-file cycle: `src/app/src/iPad/IO.js -> src/app/src/iPad/MediaLib.js -> src/app/src/utils/Localization.js -> src/app/src/iPad/IO.js`
- 3-file cycle: `src/app/src/iPad/IO.js -> src/app/src/lobby/Lobby.js -> src/app/src/lobby/Samples.js -> src/app/src/iPad/IO.js`
- 3-file cycle: `src/app/src/iPad/iOS.js -> src/app/src/lobby/Lobby.js -> src/app/src/lobby/Samples.js -> src/app/src/iPad/iOS.js`
- 3-file cycle: `src/app/src/iPad/IO.js -> src/app/src/lobby/Lobby.js -> src/app/src/utils/Localization.js -> src/app/src/iPad/IO.js`
- 3-file cycle: `src/app/src/iPad/iOS.js -> src/app/src/utils/ScratchAudio.js -> src/app/src/utils/Sound.js -> src/app/src/iPad/iOS.js`
- 4-file cycle: `src/app/src/editor/ui/Palette.js -> src/app/src/editor/ui/Record.js -> src/app/src/editor/ui/Undo.js -> src/app/src/editor/ui/Project.js -> src/app/src/editor/ui/Palette.js`
- 4-file cycle: `src/app/src/editor/ui/Palette.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Undo.js -> src/app/src/editor/ui/Project.js -> src/app/src/editor/ui/Palette.js`
- 4-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 4-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`

## Communities (91 total, 46 thin omitted)

### Community 0 - "teacher"
Cohesion: 0.07
Nodes (68): applyHoverTarget(), applyPageList(), applyStageState(), applyUiState(), buildMirrorPayload(), fakeTouchEvent(), _findHoverElement(), hideLockOverlay() (+60 more)

### Community 5 - "AssignmentBadge"
Cohesion: 0.07
Nodes (21): apiFetch(), AssignmentBadge, authHeader(), dismissedHintIds, recordHintEvent(), CARET_TYPES, compareManifests(), computeProjectManifest() (+13 more)

### Community 7 - "ScratchAudio"
Cohesion: 0.08
Nodes (9): keys, MediaLib, Cookie, Localization, localizationMessages, defaultSounds, projectSounds, ScratchAudio (+1 more)

### Community 9 - "lib"
Cohesion: 0.15
Nodes (13): buffer, pinchcenter, CSSTransition(), getDocumentHeight(), getDocumentWidth(), newDiv(), newHTML(), newImage() (+5 more)

### Community 18 - "PaintAction"
Cohesion: 0.14
Nodes (22): maskCanvas, maskData, offscreen, targetOffscreen, deltaPoint, initialPoint, pensizes, cmdForClick (+14 more)

### Community 19 - "Palette"
Cohesion: 0.09
Nodes (4): Palette, drawScaled(), getStringSize(), newCanvas()

### Community 25 - "Lobby"
Cohesion: 0.15
Nodes (9): gettingStartedMain(), homeMain(), homeStrings(), inappAbout(), inappBlocksGuide(), inappInterfaceGuide(), inappPaintEditorGuide(), Lobby (+1 more)

### Community 26 - "lib"
Cohesion: 0.10
Nodes (21): onBackButtonCallback, workingCanvas, workingCanvas2, css_vh(), css_vw(), ensureEditorFrames(), fitInRect(), getFit() (+13 more)

### Community 28 - "ScriptsPane"
Cohesion: 0.12
Nodes (4): ScriptsPane, hit3DRect(), localx(), localy()

### Community 30 - "snap.svg-min"
Cohesion: 0.32
Nodes (26): a(), b(), c(), d(), e(), f(), g(), h() (+18 more)

### Community 34 - "Menu"
Cohesion: 0.15
Nodes (5): Menu, Alert, drawThumbnail(), globalx(), globaly()

### Community 37 - "snapsvg"
Cohesion: 0.09
Nodes (3): SnapElement, SnapPaper, SnapShim

### Community 40 - "AssignmentAuthorBar"
Cohesion: 0.19
Nodes (8): apiFetch(), AssignmentAuthorBar, authHeader(), cachedHints, decodeJwtPayloadUnsafe(), getAuthorId(), HINT_WHEN_LABELS, isAllowedReturnUrl()

### Community 41 - "player"
Cohesion: 0.22
Nodes (10): applyScratchJrPlayerPatches(), applyPagePlayerPatches(), applySpritePlayerPatches(), applyStagePlayerPatches(), EMOJIS, LABELS, playerMain(), _prefetchMedia() (+2 more)

### Community 52 - "index"
Cohesion: 0.23
Nodes (7): indexFirstTime(), indexLoadOptions(), indexLoadStart(), indexLoadUsage(), indexMain(), indexSetUsage(), setClassOfElementById()

### Community 68 - "BlockSpecs"
Cohesion: 0.25
Nodes (6): fontcolors, fontsizes, getshapes, loadassets, sendshapes, speeds

### Community 72 - "AssignmentNotice"
Cohesion: 0.52
Nodes (3): apiFetch(), AssignmentNotice, authHeader()

### Community 76 - "stream"
Cohesion: 0.29
Nodes (3): Readable, Transform, Writable

## Knowledge Gaps
- **54 isolated node(s):** `_lastSpriteIds`, `loadassets`, `fontcolors`, `fontsizes`, `getshapes` (+49 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **46 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `gn()` connect `Lobby` to `teacher`, `PaintAction`, `Sprite`, `ScratchAudio`, `Stage`, `lib`, `iOS`, `Project`, `Thumbs`, `Prims`, `Library`, `PaintAction`, `Palette`, `Ghost`, `Paint`, `Home`, `Path`, `lib`, `Page`, `ScriptsPane`, `Transform`, `Record`, `Events`, `Layer`, `Menu`, `Undo`, `Path`, `Path`, `Path`, `Paint`, `SVGImage`, `Grid`, `index`, `PaintUndo`, `Thread`, `Paint`, `Paint`, `Paint`, `Path`, `Camera`, `Samples`, `Paint`, `PaintAction`, `AssignmentNotice`, `Paint`, `Path`, `Paint`?**
  _High betweenness centrality (0.249) - this node is a cross-community bridge._
- **Why does `ScratchJr` connect `ScratchJr` to `teacher`, `ScratchJr`, `Menu`, `TimeTracker`, `BlockSpecs`, `AssignmentBadge`, `ScratchAudio`, `AssignmentAuthorBar`, `player`, `ScratchJr`, `lib`, `ScratchJr`, `ScratchJr`, `PaintAction`, `Thread`, `lib`, `ScriptsPane`, `ScratchJr`?**
  _High betweenness centrality (0.114) - this node is a cross-community bridge._
- **Why does `Path` connect `Path` to `Path`, `Path`, `Path`, `Path`, `Path`, `PaintAction`, `Path`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **What connects `_lastSpriteIds`, `loadassets`, `fontcolors` to the rest of the system?**
  _54 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `teacher` be split into smaller, more focused modules?**
  _Cohesion score 0.0681081081081081 - nodes in this community are weakly interconnected._
- **Should `PaintAction` be split into smaller, more focused modules?**
  _Cohesion score 0.06497175141242938 - nodes in this community are weakly interconnected._
- **Should `UI` be split into smaller, more focused modules?**
  _Cohesion score 0.05480225988700565 - nodes in this community are weakly interconnected._