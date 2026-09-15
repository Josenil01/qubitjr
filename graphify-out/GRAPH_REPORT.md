# Graph Report - .  (2026-09-15)

## Corpus Check
- 79 files · ~114,454 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1944 nodes · 4940 edges · 88 communities (41 shown, 47 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_teacher|teacher]]
- [[_COMMUNITY_PaintAction|PaintAction]]
- [[_COMMUNITY_Sprite|Sprite]]
- [[_COMMUNITY_ScratchAudio|ScratchAudio]]
- [[_COMMUNITY_WebInterface|WebInterface]]
- [[_COMMUNITY_AssignmentBadge|AssignmentBadge]]
- [[_COMMUNITY_iOS|iOS]]
- [[_COMMUNITY_UI|UI]]
- [[_COMMUNITY_Stage|Stage]]
- [[_COMMUNITY_AssignmentAuthorBar|AssignmentAuthorBar]]
- [[_COMMUNITY_Library|Library]]
- [[_COMMUNITY_Project|Project]]
- [[_COMMUNITY_Thumbs|Thumbs]]
- [[_COMMUNITY_ScratchJr|ScratchJr]]
- [[_COMMUNITY_SVG2Canvas|SVG2Canvas]]
- [[_COMMUNITY_Scripts|Scripts]]
- [[_COMMUNITY_lib|lib]]
- [[_COMMUNITY_Prims|Prims]]
- [[_COMMUNITY_Path|Path]]
- [[_COMMUNITY_SVGTools|SVGTools]]
- [[_COMMUNITY_Ghost|Ghost]]
- [[_COMMUNITY_Palette|Palette]]
- [[_COMMUNITY_Block|Block]]
- [[_COMMUNITY_BlockSpecs|BlockSpecs]]
- [[_COMMUNITY_Home|Home]]
- [[_COMMUNITY_PaintAction|PaintAction]]
- [[_COMMUNITY_Paint|Paint]]
- [[_COMMUNITY_Lobby|Lobby]]
- [[_COMMUNITY_Page|Page]]
- [[_COMMUNITY_Transform|Transform]]
- [[_COMMUNITY_snap.svg-min|snap.svg-min]]
- [[_COMMUNITY_Record|Record]]
- [[_COMMUNITY_lib|lib]]
- [[_COMMUNITY_Events|Events]]
- [[_COMMUNITY_Layer|Layer]]
- [[_COMMUNITY_Undo|Undo]]
- [[_COMMUNITY_IO|IO]]
- [[_COMMUNITY_snapsvg|snapsvg]]
- [[_COMMUNITY_Paint|Paint]]
- [[_COMMUNITY_Grid|Grid]]
- [[_COMMUNITY_BlockArg|BlockArg]]
- [[_COMMUNITY_ScriptsPane|ScriptsPane]]
- [[_COMMUNITY_player|player]]
- [[_COMMUNITY_Scroll|Scroll]]
- [[_COMMUNITY_Rectangle|Rectangle]]
- [[_COMMUNITY_BlockSpecs|BlockSpecs]]
- [[_COMMUNITY_Runtime|Runtime]]
- [[_COMMUNITY_Vector|Vector]]
- [[_COMMUNITY_PaintUndo|PaintUndo]]
- [[_COMMUNITY_SVGImage|SVGImage]]
- [[_COMMUNITY_SVGTools|SVGTools]]
- [[_COMMUNITY_Matrix|Matrix]]
- [[_COMMUNITY_Camera|Camera]]
- [[_COMMUNITY_Samples|Samples]]
- [[_COMMUNITY_TimeTracker|TimeTracker]]
- [[_COMMUNITY_Thread|Thread]]
- [[_COMMUNITY_jszip|jszip]]
- [[_COMMUNITY_AssignmentNotice|AssignmentNotice]]
- [[_COMMUNITY_PNGCache|PNGCache]]
- [[_COMMUNITY_stream|stream]]
- [[_COMMUNITY_Sound|Sound]]
- [[_COMMUNITY_DrawPath|DrawPath]]
- [[_COMMUNITY_SVG2Canvas|SVG2Canvas]]

## God Nodes (most connected - your core abstractions)
1. `gn()` - 335 edges
2. `newHTML()` - 120 edges
3. `Paint` - 118 edges
4. `ScratchJr` - 116 edges
5. `SVG2Canvas` - 84 edges
6. `PaintAction` - 72 edges
7. `UI` - 69 edges
8. `iOS` - 68 edges
9. `setProps()` - 66 edges
10. `Sprite` - 63 edges

## Surprising Connections (you probably didn't know these)
- `setClassOfElementById()` --calls--> `gn()`  [EXTRACTED]
  src/app/src/entry/index.js → src/app/src/utils/lib.js
- `applyStageState()` --calls--> `gn()`  [EXTRACTED]
  src/app/src/editor/LiveMirror.js → src/app/src/utils/lib.js
- `applyUiState()` --calls--> `gn()`  [EXTRACTED]
  src/app/src/editor/LiveMirror.js → src/app/src/utils/lib.js
- `_findHoverElement()` --calls--> `gn()`  [EXTRACTED]
  src/app/src/editor/LiveMirror.js → src/app/src/utils/lib.js
- `broadcastPreview()` --calls--> `buildMirrorPayload()`  [EXTRACTED]
  src/app/src/editor/LiveWatch.js → src/app/src/editor/LiveMirror.js

## Import Cycles
- 3-file cycle: `src/app/src/editor/ui/Palette.js -> src/app/src/editor/ui/Undo.js -> src/app/src/editor/ui/Project.js -> src/app/src/editor/ui/Palette.js`
- 3-file cycle: `src/app/src/editor/ui/Project.js -> src/app/src/editor/ui/UI.js -> src/app/src/editor/ui/Undo.js -> src/app/src/editor/ui/Project.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/editor/ui/Palette.js -> src/app/src/editor/blocks/Block.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/editor/ui/Palette.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Project.js -> src/app/src/editor/ui/Palette.js`
- 3-file cycle: `src/app/src/editor/ui/Palette.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ui/Palette.js`
- 3-file cycle: `src/app/src/editor/ui/Project.js -> src/app/src/editor/ui/UI.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Project.js`
- 3-file cycle: `src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ui/UI.js -> src/app/src/editor/ui/ScriptsPane.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js`
- 3-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 3-file cycle: `src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Layer.js`
- 3-file cycle: `src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js`
- 3-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 3-file cycle: `src/app/src/iPad/iOS.js -> src/app/src/utils/ScratchAudio.js -> src/app/src/utils/Sound.js -> src/app/src/iPad/iOS.js`

## Communities (88 total, 47 thin omitted)

### Community 0 - "teacher"
Cohesion: 0.07
Nodes (67): applyHoverTarget(), applyPageList(), applyStageState(), applyUiState(), buildMirrorPayload(), fakeTouchEvent(), _findHoverElement(), hideLockOverlay() (+59 more)

### Community 3 - "ScratchAudio"
Cohesion: 0.07
Nodes (13): keys, MediaLib, deltaPoint, initialPoint, pensizes, Cookie, hitRect(), Localization (+5 more)

### Community 5 - "AssignmentBadge"
Cohesion: 0.07
Nodes (20): apiFetch(), AssignmentBadge, authHeader(), dismissedHintIds, CARET_TYPES, compareManifests(), computeProjectManifest(), DATA_REPRESENTATION_TYPES (+12 more)

### Community 9 - "AssignmentAuthorBar"
Cohesion: 0.08
Nodes (17): gettingStartedMain(), indexFirstTime(), indexLoadOptions(), indexLoadStart(), indexLoadUsage(), indexMain(), indexSetUsage(), setClassOfElementById() (+9 more)

### Community 10 - "Library"
Cohesion: 0.09
Nodes (3): getGalleryRestriction(), Library, getDocumentWidth()

### Community 16 - "lib"
Cohesion: 0.14
Nodes (10): Menu, Alert, drawThumbnail(), getStringSize(), globalx(), globaly(), newCanvas(), setCanvasSize() (+2 more)

### Community 23 - "BlockSpecs"
Cohesion: 0.16
Nodes (15): fontcolors, fontsizes, getshapes, loadassets, sendshapes, speeds, onBackButtonCallback, workingCanvas (+7 more)

### Community 25 - "PaintAction"
Cohesion: 0.15
Nodes (18): maskCanvas, maskData, offscreen, targetOffscreen, cmdForClick, cmdForMouseDown, cmdForMouseMove, cmdForMouseUp (+10 more)

### Community 27 - "Lobby"
Cohesion: 0.15
Nodes (8): homeMain(), homeStrings(), inappAbout(), inappBlocksGuide(), inappInterfaceGuide(), inappPaintEditorGuide(), Lobby, gn()

### Community 30 - "snap.svg-min"
Cohesion: 0.32
Nodes (26): a(), b(), c(), d(), e(), f(), g(), h() (+18 more)

### Community 32 - "lib"
Cohesion: 0.11
Nodes (20): css_vh(), css_vw(), CSSTransition(), ensureEditorFrames(), fitInRect(), getDocumentHeight(), getFit(), getHex() (+12 more)

### Community 37 - "snapsvg"
Cohesion: 0.09
Nodes (3): SnapElement, SnapPaper, SnapShim

### Community 39 - "Grid"
Cohesion: 0.21
Nodes (4): hopList, Grid, newDiv(), newP()

### Community 43 - "player"
Cohesion: 0.22
Nodes (10): applyScratchJrPlayerPatches(), applyPagePlayerPatches(), applySpritePlayerPatches(), applyStagePlayerPatches(), EMOJIS, LABELS, playerMain(), _prefetchMedia() (+2 more)

### Community 70 - "AssignmentNotice"
Cohesion: 0.52
Nodes (3): apiFetch(), AssignmentNotice, authHeader()

### Community 75 - "stream"
Cohesion: 0.29
Nodes (3): Readable, Transform, Writable

## Knowledge Gaps
- **53 isolated node(s):** `_lastSpriteIds`, `workingCanvas`, `workingCanvas2`, `onBackButtonCallback`, `loadassets` (+48 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **47 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `gn()` connect `Lobby` to `teacher`, `PaintAction`, `Sprite`, `ScratchAudio`, `iOS`, `UI`, `Stage`, `AssignmentAuthorBar`, `Library`, `Project`, `Thumbs`, `ScratchJr`, `Scripts`, `lib`, `Prims`, `Path`, `Ghost`, `Palette`, `BlockSpecs`, `Home`, `PaintAction`, `Paint`, `Page`, `Transform`, `Record`, `lib`, `Events`, `Layer`, `Undo`, `Paint`, `Grid`, `Path`, `ScriptsPane`, `ScratchJr`, `Path`, `Paint`, `Paint`, `PaintUndo`, `Path`, `SVGImage`, `SVGTools`, `Paint`, `Paint`, `Camera`, `Samples`, `Paint`, `AssignmentNotice`, `Path`, `Path`, `SVGTools`, `UI`, `Path`, `ScratchJr`, `ScratchJr`?**
  _High betweenness centrality (0.263) - this node is a cross-community bridge._
- **Why does `ScratchJr` connect `ScratchJr` to `teacher`, `ScratchJr`, `TimeTracker`, `ScratchAudio`, `AssignmentBadge`, `Grid`, `AssignmentAuthorBar`, `player`, `ScratchJr`, `lib`, `ScratchJr`, `ScratchJr`, `BlockSpecs`, `PaintAction`, `ScratchJr`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **Why does `newHTML()` connect `Paint` to `teacher`, `Sprite`, `ScratchAudio`, `AssignmentBadge`, `UI`, `Stage`, `AssignmentAuthorBar`, `Library`, `Project`, `Thumbs`, `ScratchJr`, `Scripts`, `lib`, `Palette`, `BlockSpecs`, `Home`, `PaintAction`, `Paint`, `Lobby`, `Page`, `Record`, `lib`, `Undo`, `BlockArg`, `Scroll`, `PaintUndo`, `Samples`, `Paint`, `UI`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **What connects `_lastSpriteIds`, `workingCanvas`, `workingCanvas2` to the rest of the system?**
  _53 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `teacher` be split into smaller, more focused modules?**
  _Cohesion score 0.06960385042576823 - nodes in this community are weakly interconnected._
- **Should `PaintAction` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._
- **Should `Sprite` be split into smaller, more focused modules?**
  _Cohesion score 0.07188778492109878 - nodes in this community are weakly interconnected._