# Graph Report - .  (2026-08-23)

## Corpus Check
- 2 files · ~104,524 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1903 nodes · 4462 edges · 83 communities (43 shown, 40 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Live Mirror Sync|Live Mirror Sync]]
- [[_COMMUNITY_Paint Action History|Paint Action History]]
- [[_COMMUNITY_Palette Drag-and-Drop|Palette Drag-and-Drop]]
- [[_COMMUNITY_Sprite Engine|Sprite Engine]]
- [[_COMMUNITY_Web Interface Bridge|Web Interface Bridge]]
- [[_COMMUNITY_SVG Drawing Tools|SVG Drawing Tools]]
- [[_COMMUNITY_iOS Platform Bridge|iOS Platform Bridge]]
- [[_COMMUNITY_ScratchJr App Core|ScratchJr App Core]]
- [[_COMMUNITY_Paint Geometry Helpers|Paint Geometry Helpers]]
- [[_COMMUNITY_ScrollPan Control|Scroll/Pan Control]]
- [[_COMMUNITY_Editor UI Core|Editor UI Core]]
- [[_COMMUNITY_Project Lifecycle|Project Lifecycle]]
- [[_COMMUNITY_Player Mode Patches|Player Mode Patches]]
- [[_COMMUNITY_SVG to Canvas Rendering|SVG to Canvas Rendering]]
- [[_COMMUNITY_Stage Engine|Stage Engine]]
- [[_COMMUNITY_Mission Notification Bell|Mission Notification Bell]]
- [[_COMMUNITY_Asset Library UI|Asset Library UI]]
- [[_COMMUNITY_Scripts Pane Blocks|Scripts Pane Blocks]]
- [[_COMMUNITY_ScratchJr Core State|ScratchJr Core State]]
- [[_COMMUNITY_Block Primitives|Block Primitives]]
- [[_COMMUNITY_Paint Editor Core|Paint Editor Core]]
- [[_COMMUNITY_Editor Entry Boot|Editor Entry Boot]]
- [[_COMMUNITY_Ghost Outline Tool|Ghost Outline Tool]]
- [[_COMMUNITY_Block Model|Block Model]]
- [[_COMMUNITY_Block Palette|Block Palette]]
- [[_COMMUNITY_Block Connection Logic|Block Connection Logic]]
- [[_COMMUNITY_Vector Path Editing|Vector Path Editing]]
- [[_COMMUNITY_Page Engine|Page Engine]]
- [[_COMMUNITY_Mission Progress Badge|Mission Progress Badge]]
- [[_COMMUNITY_SVG Transform Matrix|SVG Transform Matrix]]
- [[_COMMUNITY_Snap.svg Library (vendored)|Snap.svg Library (vendored)]]
- [[_COMMUNITY_SoundVideo Recording UI|Sound/Video Recording UI]]
- [[_COMMUNITY_ViewportCSS Helpers|Viewport/CSS Helpers]]
- [[_COMMUNITY_Paint Layer Management|Paint Layer Management]]
- [[_COMMUNITY_UndoRedo Stack|Undo/Redo Stack]]
- [[_COMMUNITY_Misc Editor Popups|Misc Editor Popups]]
- [[_COMMUNITY_Stage Interaction Handlers|Stage Interaction Handlers]]
- [[_COMMUNITY_Snap.svg Shim|Snap.svg Shim]]
- [[_COMMUNITY_Engine Wiring|Engine Wiring]]
- [[_COMMUNITY_Lobby Core|Lobby Core]]
- [[_COMMUNITY_Editor Boot Edge Cases|Editor Boot Edge Cases]]
- [[_COMMUNITY_Block Argument UI|Block Argument UI]]
- [[_COMMUNITY_Rectangle Geometry|Rectangle Geometry]]
- [[_COMMUNITY_Block Spec Catalog|Block Spec Catalog]]
- [[_COMMUNITY_Script Runtime Execution|Script Runtime Execution]]
- [[_COMMUNITY_2D Vector Math|2D Vector Math]]
- [[_COMMUNITY_Paint Undo Buffer|Paint Undo Buffer]]
- [[_COMMUNITY_2D Matrix Math|2D Matrix Math]]
- [[_COMMUNITY_Thread Execution|Thread Execution]]
- [[_COMMUNITY_Media Key Generation|Media Key Generation]]
- [[_COMMUNITY_Camera Capture|Camera Capture]]
- [[_COMMUNITY_Sample Projects List|Sample Projects List]]
- [[_COMMUNITY_Time Tracking|Time Tracking]]
- [[_COMMUNITY_JSZip Shim|JSZip Shim]]
- [[_COMMUNITY_PNG Render Cache|PNG Render Cache]]
- [[_COMMUNITY_Node Stream Shim|Node Stream Shim]]
- [[_COMMUNITY_SVG Path Drawing Util|SVG Path Drawing Util]]
- [[_COMMUNITY_Sound Playback|Sound Playback]]

## God Nodes (most connected - your core abstractions)
1. `gn()` - 281 edges
2. `Paint` - 115 edges
3. `ScratchJr` - 100 edges
4. `newHTML()` - 85 edges
5. `SVG2Canvas` - 81 edges
6. `PaintAction` - 72 edges
7. `UI` - 66 edges
8. `Sprite` - 62 edges
9. `iOS` - 60 edges
10. `SVGTools` - 59 edges

## Surprising Connections (you probably didn't know these)
- `setClassOfElementById()` --calls--> `gn()`  [EXTRACTED]
  src/app/src/entry/index.js → src/app/src/utils/lib.js
- `gettingStartedMain()` --calls--> `gn()`  [EXTRACTED]
  src/app/src/entry/gettingstarted.js → src/app/src/utils/lib.js
- `homeMain()` --calls--> `gn()`  [EXTRACTED]
  src/app/src/entry/home.js → src/app/src/utils/lib.js
- `homeStrings()` --calls--> `gn()`  [EXTRACTED]
  src/app/src/entry/home.js → src/app/src/utils/lib.js
- `inappAbout()` --calls--> `gn()`  [EXTRACTED]
  src/app/src/entry/inapp.js → src/app/src/utils/lib.js

## Import Cycles
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 3-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 3-file cycle: `src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Layer.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js`
- 3-file cycle: `src/app/src/editor/ui/Palette.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ui/Palette.js`
- 3-file cycle: `src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ui/UI.js -> src/app/src/editor/ui/ScriptsPane.js`
- 4-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js -> src/app/src/editor/ScratchJr.js`
- 4-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 4-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 4-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 4-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Layer.js -> src/app/src/editor/ScratchJr.js`
- 4-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 4-file cycle: `src/app/src/painteditor/Layer.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Layer.js`

## Communities (83 total, 40 thin omitted)

### Community 0 - "Live Mirror Sync"
Cohesion: 0.07
Nodes (65): applyHoverTarget(), applyPageList(), applyStageState(), applyUiState(), buildMirrorPayload(), fakeTouchEvent(), _findHoverElement(), hideLockOverlay() (+57 more)

### Community 2 - "Palette Drag-and-Drop"
Cohesion: 0.06
Nodes (4): ScriptsPane, Thumbs, localx(), localy()

### Community 7 - "ScratchJr App Core"
Cohesion: 0.08
Nodes (14): onBackButtonCallback, workingCanvas, workingCanvas2, homeMain(), homeStrings(), keys, buffer, Cookie (+6 more)

### Community 8 - "Paint Geometry Helpers"
Cohesion: 0.11
Nodes (22): maskCanvas, maskData, offscreen, targetOffscreen, deltaPoint, initialPoint, pensizes, cmdForClick (+14 more)

### Community 9 - "Scroll/Pan Control"
Cohesion: 0.08
Nodes (3): Scroll, Events, CSSTransition3D()

### Community 12 - "Player Mode Patches"
Cohesion: 0.08
Nodes (11): applyScratchJrPlayerPatches(), applyPagePlayerPatches(), applySpritePlayerPatches(), applyStagePlayerPatches(), EMOJIS, LABELS, playerMain(), _prefetchMedia() (+3 more)

### Community 15 - "Mission Notification Bell"
Cohesion: 0.09
Nodes (5): apiFetch(), AssignmentNotice, authHeader(), Events, Home

### Community 21 - "Editor Entry Boot"
Cohesion: 0.09
Nodes (14): gettingStartedMain(), indexFirstTime(), indexLoadOptions(), indexLoadStart(), indexLoadUsage(), indexMain(), indexSetUsage(), setClassOfElementById() (+6 more)

### Community 23 - "Block Model"
Cohesion: 0.12
Nodes (11): fontcolors, fontsizes, getshapes, loadassets, sendshapes, speeds, Menu, getDocumentHeight() (+3 more)

### Community 28 - "Mission Progress Badge"
Cohesion: 0.14
Nodes (11): apiFetch(), AssignmentBadge, authHeader(), CARET_TYPES, compareManifests(), computeProjectManifest(), DATA_REPRESENTATION_TYPES, emptyManifest() (+3 more)

### Community 30 - "Snap.svg Library (vendored)"
Cohesion: 0.32
Nodes (26): a(), b(), c(), d(), e(), f(), g(), h() (+18 more)

### Community 32 - "Viewport/CSS Helpers"
Cohesion: 0.11
Nodes (22): colorToRGBA(), css_vh(), css_vw(), CSSTransition(), drawScaled(), drawThumbnail(), ensureEditorFrames(), fitInRect() (+14 more)

### Community 35 - "Misc Editor Popups"
Cohesion: 0.21
Nodes (6): Alert, pinchcenter, getStringSize(), globalx(), globaly(), writeText()

### Community 36 - "Stage Interaction Handlers"
Cohesion: 0.13
Nodes (6): inappAbout(), inappBlocksGuide(), inappInterfaceGuide(), inappPaintEditorGuide(), gn(), hitRect()

### Community 37 - "Snap.svg Shim"
Cohesion: 0.09
Nodes (3): SnapElement, SnapPaper, SnapShim

### Community 38 - "Engine Wiring"
Cohesion: 0.20
Nodes (6): hopList, Grid, newCanvas(), newDiv(), newP(), setCanvasSizeScaledToWindowDocumentHeight()

### Community 39 - "Lobby Core"
Cohesion: 0.17
Nodes (4): Lobby, preprocess(), preprocessAndLoad(), preprocessAndLoadCss()

### Community 70 - "Node Stream Shim"
Cohesion: 0.29
Nodes (3): Readable, Transform, Writable

## Knowledge Gaps
- **47 isolated node(s):** `workingCanvas`, `workingCanvas2`, `onBackButtonCallback`, `loadassets`, `fontcolors` (+42 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **40 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `gn()` connect `Stage Interaction Handlers` to `Live Mirror Sync`, `Paint Action History`, `Palette Drag-and-Drop`, `SVG Drawing Tools`, `iOS Platform Bridge`, `ScratchJr App Core`, `Paint Geometry Helpers`, `Scroll/Pan Control`, `Editor UI Core`, `Stage Engine`, `Mission Notification Bell`, `ScratchJr Core State`, `Block Primitives`, `Paint Editor Core`, `Editor Entry Boot`, `Ghost Outline Tool`, `Block Model`, `Block Palette`, `Vector Path Editing`, `SVG Transform Matrix`, `Sound/Video Recording UI`, `Viewport/CSS Helpers`, `Paint Layer Management`, `Undo/Redo Stack`, `Misc Editor Popups`, `Engine Wiring`, `Lobby Core`, `Path Background Cropping`, `Editor Boot Edge Cases`, `Selection State`, `Argument Editing State`, `Bezier Curve Drawing`, `Path Dot Handles`, `Paint Asset Import (XML)`, `Paint Undo Buffer`, `Paint Canvas Positioning`, `Path Intersection Detection`, `Paint Page Navigation`, `Paint Color/Size Picker`, `Camera Capture`, `Sample Projects List`, `Paint Side Palette`, `Path Point Manipulation`, `Paint Swatch Picker`, `Fullscreen Control`?**
  _High betweenness centrality (0.264) - this node is a cross-community bridge._
- **Why does `newHTML()` connect `Editor Boot Edge Cases` to `Live Mirror Sync`, `Palette Drag-and-Drop`, `ScratchJr App Core`, `Paint Geometry Helpers`, `Scroll/Pan Control`, `Editor UI Core`, `Mission Notification Bell`, `ScratchJr Core State`, `Editor Entry Boot`, `Block Model`, `Block Palette`, `Mission Progress Badge`, `Sound/Video Recording UI`, `Viewport/CSS Helpers`, `Undo/Redo Stack`, `Misc Editor Popups`, `Stage Interaction Handlers`, `Engine Wiring`, `Lobby Core`, `Block Argument UI`, `Paint Undo Buffer`, `Paint Color/Size Picker`, `Sample Projects List`, `Paint Side Palette`, `Paint Swatch Picker`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **Why does `Path` connect `Vector Path Editing` to `Path Point Manipulation`, `Paint Geometry Helpers`, `Path Background Cropping`, `Path Data Serialization`, `Bezier Curve Drawing`, `Path Dot Handles`, `Path Intersection Detection`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **What connects `workingCanvas`, `workingCanvas2`, `onBackButtonCallback` to the rest of the system?**
  _47 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Live Mirror Sync` be split into smaller, more focused modules?**
  _Cohesion score 0.07039573820395738 - nodes in this community are weakly interconnected._
- **Should `Paint Action History` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._
- **Should `Palette Drag-and-Drop` be split into smaller, more focused modules?**
  _Cohesion score 0.05853174603174603 - nodes in this community are weakly interconnected._