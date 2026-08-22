# Graph Report - .  (2026-08-22)

## Corpus Check
- 2 files · ~103,220 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1892 nodes · 4443 edges · 87 communities (42 shown, 45 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Live Mirror Sync|Live Mirror Sync]]
- [[_COMMUNITY_Paint Action History|Paint Action History]]
- [[_COMMUNITY_Sprite Engine|Sprite Engine]]
- [[_COMMUNITY_Web Interface Bridge|Web Interface Bridge]]
- [[_COMMUNITY_Editor UI Core|Editor UI Core]]
- [[_COMMUNITY_SVG Drawing Tools|SVG Drawing Tools]]
- [[_COMMUNITY_iOS Platform Bridge|iOS Platform Bridge]]
- [[_COMMUNITY_Stage Engine|Stage Engine]]
- [[_COMMUNITY_Project Lifecycle|Project Lifecycle]]
- [[_COMMUNITY_ScratchJr App Core|ScratchJr App Core]]
- [[_COMMUNITY_SVG to Canvas Rendering|SVG to Canvas Rendering]]
- [[_COMMUNITY_Mission Notification Bell|Mission Notification Bell]]
- [[_COMMUNITY_PageSprite Thumbnails|Page/Sprite Thumbnails]]
- [[_COMMUNITY_Asset Library UI|Asset Library UI]]
- [[_COMMUNITY_Scripts Pane Blocks|Scripts Pane Blocks]]
- [[_COMMUNITY_Block Primitives|Block Primitives]]
- [[_COMMUNITY_Vector Path Editing|Vector Path Editing]]
- [[_COMMUNITY_Block Model|Block Model]]
- [[_COMMUNITY_Paint Geometry Helpers|Paint Geometry Helpers]]
- [[_COMMUNITY_Ghost Outline Tool|Ghost Outline Tool]]
- [[_COMMUNITY_Paint Editor Core|Paint Editor Core]]
- [[_COMMUNITY_Home Lobby Entry|Home Lobby Entry]]
- [[_COMMUNITY_Block Palette|Block Palette]]
- [[_COMMUNITY_Block Connection Logic|Block Connection Logic]]
- [[_COMMUNITY_Page Engine|Page Engine]]
- [[_COMMUNITY_SVG Transform Matrix|SVG Transform Matrix]]
- [[_COMMUNITY_Snap.svg Library (vendored)|Snap.svg Library (vendored)]]
- [[_COMMUNITY_Palette Drag-and-Drop|Palette Drag-and-Drop]]
- [[_COMMUNITY_SoundVideo Recording UI|Sound/Video Recording UI]]
- [[_COMMUNITY_Input Event Handling|Input Event Handling]]
- [[_COMMUNITY_Editor Entry Boot|Editor Entry Boot]]
- [[_COMMUNITY_Paint Layer Management|Paint Layer Management]]
- [[_COMMUNITY_IO Persistence Layer|IO Persistence Layer]]
- [[_COMMUNITY_UndoRedo Stack|Undo/Redo Stack]]
- [[_COMMUNITY_Stage-Page-Sprite Wiring|Stage-Page-Sprite Wiring]]
- [[_COMMUNITY_Editor Panel Wiring|Editor Panel Wiring]]
- [[_COMMUNITY_Snap.svg Shim|Snap.svg Shim]]
- [[_COMMUNITY_ViewportCSS Helpers|Viewport/CSS Helpers]]
- [[_COMMUNITY_Block Argument UI|Block Argument UI]]
- [[_COMMUNITY_Player Mode Patches|Player Mode Patches]]
- [[_COMMUNITY_Misc Editor Popups|Misc Editor Popups]]
- [[_COMMUNITY_Execution Engine Core|Execution Engine Core]]
- [[_COMMUNITY_Mission Progress Badge|Mission Progress Badge]]
- [[_COMMUNITY_Media & Sample Projects|Media & Sample Projects]]
- [[_COMMUNITY_ScrollPan Control|Scroll/Pan Control]]
- [[_COMMUNITY_Rectangle Geometry|Rectangle Geometry]]
- [[_COMMUNITY_Block Spec Catalog|Block Spec Catalog]]
- [[_COMMUNITY_Script Runtime Execution|Script Runtime Execution]]
- [[_COMMUNITY_Paint Undo Buffer|Paint Undo Buffer]]
- [[_COMMUNITY_SVG Image Element|SVG Image Element]]
- [[_COMMUNITY_2D Matrix Math|2D Matrix Math]]
- [[_COMMUNITY_Audio Asset Lists|Audio Asset Lists]]
- [[_COMMUNITY_Media Key Generation|Media Key Generation]]
- [[_COMMUNITY_Camera Capture|Camera Capture]]
- [[_COMMUNITY_Audio Playback Engine|Audio Playback Engine]]
- [[_COMMUNITY_Sample Projects List|Sample Projects List]]
- [[_COMMUNITY_Time Tracking|Time Tracking]]
- [[_COMMUNITY_Thread Execution|Thread Execution]]
- [[_COMMUNITY_JSZip Shim|JSZip Shim]]
- [[_COMMUNITY_Mission Authoring Button|Mission Authoring Button]]
- [[_COMMUNITY_PNG Render Cache|PNG Render Cache]]
- [[_COMMUNITY_Node Stream Shim|Node Stream Shim]]
- [[_COMMUNITY_SVG Path Drawing Util|SVG Path Drawing Util]]
- [[_COMMUNITY_ColorCanvas Draw Helpers|Color/Canvas Draw Helpers]]

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
- `inappAbout()` --calls--> `gn()`  [EXTRACTED]
  src/app/src/entry/inapp.js → src/app/src/utils/lib.js
- `inappInterfaceGuide()` --calls--> `gn()`  [EXTRACTED]
  src/app/src/entry/inapp.js → src/app/src/utils/lib.js
- `inappPaintEditorGuide()` --calls--> `gn()`  [EXTRACTED]
  src/app/src/entry/inapp.js → src/app/src/utils/lib.js

## Import Cycles
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 3-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 3-file cycle: `src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Layer.js`
- 3-file cycle: `src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/editor/ui/Palette.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ui/Palette.js`
- 3-file cycle: `src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ui/UI.js -> src/app/src/editor/ui/ScriptsPane.js`
- 4-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js -> src/app/src/editor/ScratchJr.js`
- 4-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Layer.js -> src/app/src/editor/ScratchJr.js`
- 4-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/editor/ScratchJr.js`
- 4-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Path.js -> src/app/src/editor/ScratchJr.js`
- 4-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/painteditor/Path.js -> src/app/src/editor/ScratchJr.js`
- 4-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js -> src/app/src/editor/ScratchJr.js`
- 4-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`

## Communities (87 total, 45 thin omitted)

### Community 0 - "Live Mirror Sync"
Cohesion: 0.07
Nodes (65): applyHoverTarget(), applyPageList(), applyStageState(), applyUiState(), buildMirrorPayload(), fakeTouchEvent(), _findHoverElement(), hideLockOverlay() (+57 more)

### Community 11 - "Mission Notification Bell"
Cohesion: 0.09
Nodes (5): apiFetch(), AssignmentNotice, authHeader(), Events, Home

### Community 17 - "Block Model"
Cohesion: 0.11
Nodes (17): fontcolors, fontsizes, getshapes, loadassets, sendshapes, speeds, Menu, onBackButtonCallback (+9 more)

### Community 18 - "Paint Geometry Helpers"
Cohesion: 0.14
Nodes (21): maskCanvas, maskData, offscreen, targetOffscreen, deltaPoint, initialPoint, pensizes, cmdForClick (+13 more)

### Community 21 - "Home Lobby Entry"
Cohesion: 0.14
Nodes (8): homeMain(), homeStrings(), inappAbout(), inappBlocksGuide(), inappInterfaceGuide(), inappPaintEditorGuide(), Lobby, gn()

### Community 26 - "Snap.svg Library (vendored)"
Cohesion: 0.32
Nodes (26): a(), b(), c(), d(), e(), f(), g(), h() (+18 more)

### Community 27 - "Palette Drag-and-Drop"
Cohesion: 0.13
Nodes (4): ScriptsPane, hit3DRect(), localx(), localy()

### Community 30 - "Editor Entry Boot"
Cohesion: 0.11
Nodes (10): gettingStartedMain(), indexFirstTime(), indexLoadOptions(), indexLoadStart(), indexLoadUsage(), indexMain(), indexSetUsage(), setClassOfElementById() (+2 more)

### Community 34 - "Stage-Page-Sprite Wiring"
Cohesion: 0.18
Nodes (5): Grid, newCanvas(), newDiv(), newP(), setCanvasSizeScaledToWindowDocumentHeight()

### Community 35 - "Editor Panel Wiring"
Cohesion: 0.19
Nodes (5): pinchcenter, getDocumentHeight(), getDocumentWidth(), newHTML(), newTextInput()

### Community 36 - "Snap.svg Shim"
Cohesion: 0.09
Nodes (3): SnapElement, SnapPaper, SnapShim

### Community 37 - "Viewport/CSS Helpers"
Cohesion: 0.14
Nodes (16): css_vh(), css_vw(), drawScaled(), ensureEditorFrames(), fitInRect(), getFit(), getHex(), getViewportHeight() (+8 more)

### Community 40 - "Player Mode Patches"
Cohesion: 0.18
Nodes (10): applyScratchJrPlayerPatches(), applyPagePlayerPatches(), applySpritePlayerPatches(), applyStagePlayerPatches(), EMOJIS, LABELS, playerMain(), _prefetchMedia() (+2 more)

### Community 41 - "Misc Editor Popups"
Cohesion: 0.20
Nodes (4): Alert, getStringSize(), globalx(), globaly()

### Community 43 - "Mission Progress Badge"
Cohesion: 0.23
Nodes (3): apiFetch(), AssignmentBadge, authHeader()

### Community 45 - "Media & Sample Projects"
Cohesion: 0.20
Nodes (4): keys, Cookie, Localization, localizationMessages

### Community 61 - "Audio Asset Lists"
Cohesion: 0.22
Nodes (4): defaultSounds, projectSounds, uiSounds, Sound

### Community 72 - "Mission Authoring Button"
Cohesion: 0.39
Nodes (4): apiFetch(), AssignmentAuthorBar, authHeader(), isAllowedReturnUrl()

### Community 77 - "Node Stream Shim"
Cohesion: 0.29
Nodes (3): Readable, Transform, Writable

## Knowledge Gaps
- **43 isolated node(s):** `workingCanvas`, `workingCanvas2`, `onBackButtonCallback`, `loadassets`, `fontcolors` (+38 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **45 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `gn()` connect `Home Lobby Entry` to `Live Mirror Sync`, `Paint Action History`, `Editor UI Core`, `SVG Drawing Tools`, `iOS Platform Bridge`, `Stage Engine`, `ScratchJr App Core`, `Mission Notification Bell`, `Page/Sprite Thumbnails`, `Block Primitives`, `Vector Path Editing`, `Block Model`, `Paint Geometry Helpers`, `Ghost Outline Tool`, `Paint Editor Core`, `Block Palette`, `SVG Transform Matrix`, `Palette Drag-and-Drop`, `Sound/Video Recording UI`, `Input Event Handling`, `Editor Entry Boot`, `Paint Layer Management`, `Undo/Redo Stack`, `Stage-Page-Sprite Wiring`, `Editor Panel Wiring`, `Viewport/CSS Helpers`, `Path Background Cropping`, `Player Mode Patches`, `Misc Editor Popups`, `Execution Engine Core`, `Argument Editing State`, `Media & Sample Projects`, `Bezier Curve Drawing`, `Selection State`, `Paint Asset Import (XML)`, `Paint Undo Buffer`, `Path Edit Mode`, `SVG Image Element`, `Paint Color/Size Picker`, `Paint Canvas Positioning`, `Paint Grid Overlay`, `Camera Capture`, `Sample Projects List`, `Paint Page Navigation`, `Paint Side Palette`, `Path Point Manipulation`, `Path Intersection Detection`, `Path Dot Handles`, `Paint Gesture Detection`, `Fullscreen Control`?**
  _High betweenness centrality (0.272) - this node is a cross-community bridge._
- **Why does `newHTML()` connect `Editor Panel Wiring` to `Live Mirror Sync`, `Editor UI Core`, `ScratchJr App Core`, `Mission Notification Bell`, `Page/Sprite Thumbnails`, `Block Model`, `Paint Geometry Helpers`, `Home Lobby Entry`, `Block Palette`, `Palette Drag-and-Drop`, `Sound/Video Recording UI`, `Undo/Redo Stack`, `Stage-Page-Sprite Wiring`, `Viewport/CSS Helpers`, `Block Argument UI`, `Player Mode Patches`, `Mission Progress Badge`, `Media & Sample Projects`, `Scroll/Pan Control`, `Paint Undo Buffer`, `Paint Color/Size Picker`, `Sample Projects List`, `Mission Authoring Button`, `Paint Side Palette`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Why does `Path` connect `Vector Path Editing` to `Path Background Cropping`, `Path Point Manipulation`, `Path Intersection Detection`, `Path Dot Handles`, `Bezier Curve Drawing`, `Paint Geometry Helpers`, `Home Lobby Entry`, `Path Edit Mode`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **What connects `workingCanvas`, `workingCanvas2`, `onBackButtonCallback` to the rest of the system?**
  _43 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Live Mirror Sync` be split into smaller, more focused modules?**
  _Cohesion score 0.07039573820395738 - nodes in this community are weakly interconnected._
- **Should `Paint Action History` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._
- **Should `Sprite Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.07175141242937853 - nodes in this community are weakly interconnected._