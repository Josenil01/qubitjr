# Graph Report - .  (2026-08-23)

## Corpus Check
- 2 files · ~104,848 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1905 nodes · 4466 edges · 84 communities (43 shown, 41 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Live Mirror Sync|Live Mirror Sync]]
- [[_COMMUNITY_Paint Action History|Paint Action History]]
- [[_COMMUNITY_Sprite Engine|Sprite Engine]]
- [[_COMMUNITY_Web Interface Bridge|Web Interface Bridge]]
- [[_COMMUNITY_SVG Drawing Tools|SVG Drawing Tools]]
- [[_COMMUNITY_Editor UI Core|Editor UI Core]]
- [[_COMMUNITY_Rectangle Geometry|Rectangle Geometry]]
- [[_COMMUNITY_iOS Platform Bridge|iOS Platform Bridge]]
- [[_COMMUNITY_Project Lifecycle|Project Lifecycle]]
- [[_COMMUNITY_Block Connection Logic|Block Connection Logic]]
- [[_COMMUNITY_Player Mode Patches|Player Mode Patches]]
- [[_COMMUNITY_Stage Engine|Stage Engine]]
- [[_COMMUNITY_SVG to Canvas Rendering|SVG to Canvas Rendering]]
- [[_COMMUNITY_Mission Notification Bell|Mission Notification Bell]]
- [[_COMMUNITY_Asset Library UI|Asset Library UI]]
- [[_COMMUNITY_ScratchJr App Core|ScratchJr App Core]]
- [[_COMMUNITY_Scripts Pane Blocks|Scripts Pane Blocks]]
- [[_COMMUNITY_PageSprite Thumbnails|Page/Sprite Thumbnails]]
- [[_COMMUNITY_ScratchJr Core State|ScratchJr Core State]]
- [[_COMMUNITY_Block Primitives|Block Primitives]]
- [[_COMMUNITY_Palette Drag-and-Drop|Palette Drag-and-Drop]]
- [[_COMMUNITY_Ghost Outline Tool|Ghost Outline Tool]]
- [[_COMMUNITY_Paint Editor Core|Paint Editor Core]]
- [[_COMMUNITY_Vector Path Editing|Vector Path Editing]]
- [[_COMMUNITY_Block Palette|Block Palette]]
- [[_COMMUNITY_Mission Progress Badge|Mission Progress Badge]]
- [[_COMMUNITY_Page Engine|Page Engine]]
- [[_COMMUNITY_Home Lobby Entry|Home Lobby Entry]]
- [[_COMMUNITY_SVG Transform Matrix|SVG Transform Matrix]]
- [[_COMMUNITY_Snap.svg Library (vendored)|Snap.svg Library (vendored)]]
- [[_COMMUNITY_SoundVideo Recording UI|Sound/Video Recording UI]]
- [[_COMMUNITY_Input Event Handling|Input Event Handling]]
- [[_COMMUNITY_Engine Wiring|Engine Wiring]]
- [[_COMMUNITY_Editor Entry Boot|Editor Entry Boot]]
- [[_COMMUNITY_Paint Layer Management|Paint Layer Management]]
- [[_COMMUNITY_Block Spec Catalog|Block Spec Catalog]]
- [[_COMMUNITY_UndoRedo Stack|Undo/Redo Stack]]
- [[_COMMUNITY_Block Argument UI|Block Argument UI]]
- [[_COMMUNITY_Snap.svg Shim|Snap.svg Shim]]
- [[_COMMUNITY_Block Argument Menus|Block Argument Menus]]
- [[_COMMUNITY_Stage Grid Overlay|Stage Grid Overlay]]
- [[_COMMUNITY_Stage-Library Wiring|Stage-Library Wiring]]
- [[_COMMUNITY_ScrollPan Control|Scroll/Pan Control]]
- [[_COMMUNITY_Block Spec Catalog (Core)|Block Spec Catalog (Core)]]
- [[_COMMUNITY_Script Runtime Execution|Script Runtime Execution]]
- [[_COMMUNITY_2D Vector Math|2D Vector Math]]
- [[_COMMUNITY_Paint Undo Buffer|Paint Undo Buffer]]
- [[_COMMUNITY_SVG Image Element|SVG Image Element]]
- [[_COMMUNITY_2D Matrix Math|2D Matrix Math]]
- [[_COMMUNITY_Camera Capture|Camera Capture]]
- [[_COMMUNITY_Media Key Generation|Media Key Generation]]
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
- 3-file cycle: `src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Layer.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js`
- 3-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 3-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js`
- 3-file cycle: `src/app/src/editor/ui/Palette.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ui/Palette.js`
- 3-file cycle: `src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ui/UI.js -> src/app/src/editor/ui/ScriptsPane.js`
- 4-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Layer.js -> src/app/src/editor/ScratchJr.js`
- 4-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 4-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 4-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 4-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 4-file cycle: `src/app/src/painteditor/Layer.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Layer.js`
- 4-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/editor/ScratchJr.js`

## Communities (84 total, 41 thin omitted)

### Community 0 - "Live Mirror Sync"
Cohesion: 0.07
Nodes (65): applyHoverTarget(), applyPageList(), applyStageState(), applyUiState(), buildMirrorPayload(), fakeTouchEvent(), _findHoverElement(), hideLockOverlay() (+57 more)

### Community 6 - "Rectangle Geometry"
Cohesion: 0.09
Nodes (22): Rectangle, maskCanvas, maskData, offscreen, targetOffscreen, deltaPoint, initialPoint, pensizes (+14 more)

### Community 9 - "Block Connection Logic"
Cohesion: 0.10
Nodes (3): Block, setCanvasSize(), setProps()

### Community 10 - "Player Mode Patches"
Cohesion: 0.08
Nodes (11): applyScratchJrPlayerPatches(), applyPagePlayerPatches(), applySpritePlayerPatches(), applyStagePlayerPatches(), EMOJIS, LABELS, playerMain(), _prefetchMedia() (+3 more)

### Community 13 - "Mission Notification Bell"
Cohesion: 0.09
Nodes (5): apiFetch(), AssignmentNotice, authHeader(), Events, Home

### Community 15 - "ScratchJr App Core"
Cohesion: 0.08
Nodes (12): onBackButtonCallback, workingCanvas, workingCanvas2, hopList, buffer, ensureEditorFrames(), libInit(), defaultSounds (+4 more)

### Community 20 - "Palette Drag-and-Drop"
Cohesion: 0.12
Nodes (6): ScriptsPane, pinchcenter, hit3DRect(), hitRect(), localx(), localy()

### Community 25 - "Mission Progress Badge"
Cohesion: 0.13
Nodes (11): apiFetch(), AssignmentBadge, authHeader(), CARET_TYPES, compareManifests(), computeProjectManifest(), DATA_REPRESENTATION_TYPES, emptyManifest() (+3 more)

### Community 27 - "Home Lobby Entry"
Cohesion: 0.15
Nodes (8): homeMain(), homeStrings(), inappAbout(), inappBlocksGuide(), inappInterfaceGuide(), inappPaintEditorGuide(), Lobby, gn()

### Community 29 - "Snap.svg Library (vendored)"
Cohesion: 0.32
Nodes (26): a(), b(), c(), d(), e(), f(), g(), h() (+18 more)

### Community 32 - "Engine Wiring"
Cohesion: 0.12
Nodes (18): css_vh(), css_vw(), CSSTransition(), drawScaled(), drawThumbnail(), fitInRect(), getFit(), getHex() (+10 more)

### Community 33 - "Editor Entry Boot"
Cohesion: 0.11
Nodes (10): gettingStartedMain(), indexFirstTime(), indexLoadOptions(), indexLoadStart(), indexLoadUsage(), indexMain(), indexSetUsage(), setClassOfElementById() (+2 more)

### Community 35 - "Block Spec Catalog"
Cohesion: 0.13
Nodes (10): fontcolors, fontsizes, getshapes, loadassets, sendshapes, speeds, keys, Cookie (+2 more)

### Community 37 - "Block Argument UI"
Cohesion: 0.16
Nodes (5): Menu, Alert, getStringSize(), globalx(), globaly()

### Community 38 - "Snap.svg Shim"
Cohesion: 0.09
Nodes (3): SnapElement, SnapPaper, SnapShim

### Community 41 - "Stage Grid Overlay"
Cohesion: 0.22
Nodes (4): Grid, newCanvas(), newDiv(), newP()

### Community 42 - "Stage-Library Wiring"
Cohesion: 0.15
Nodes (5): getDocumentHeight(), getDocumentWidth(), newHTML(), newImage(), newTextInput()

### Community 69 - "Mission Authoring Button"
Cohesion: 0.39
Nodes (4): apiFetch(), AssignmentAuthorBar, authHeader(), isAllowedReturnUrl()

### Community 73 - "Node Stream Shim"
Cohesion: 0.29
Nodes (3): Readable, Transform, Writable

## Knowledge Gaps
- **47 isolated node(s):** `workingCanvas`, `workingCanvas2`, `onBackButtonCallback`, `loadassets`, `fontcolors` (+42 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **41 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `gn()` connect `Home Lobby Entry` to `Live Mirror Sync`, `Paint Action History`, `SVG Drawing Tools`, `Editor UI Core`, `Rectangle Geometry`, `iOS Platform Bridge`, `Block Connection Logic`, `Stage Engine`, `Mission Notification Bell`, `ScratchJr App Core`, `Page/Sprite Thumbnails`, `ScratchJr Core State`, `Block Primitives`, `Palette Drag-and-Drop`, `Ghost Outline Tool`, `Paint Editor Core`, `Vector Path Editing`, `Block Palette`, `SVG Transform Matrix`, `Sound/Video Recording UI`, `Input Event Handling`, `Engine Wiring`, `Editor Entry Boot`, `Paint Layer Management`, `Block Spec Catalog`, `Undo/Redo Stack`, `Block Argument UI`, `Path Background Cropping`, `Stage Grid Overlay`, `Stage-Library Wiring`, `Selection State`, `Argument Editing State`, `Bezier Curve Drawing`, `Paint Asset Import (XML)`, `Paint Undo Buffer`, `Paint Color/Size Picker`, `Paint Canvas Positioning`, `Paint Grid Overlay`, `Path Intersection Detection`, `Path Edit Mode`, `SVG Image Element`, `Camera Capture`, `Sample Projects List`, `Paint Page Navigation`, `Paint Side Palette`, `Path Point Manipulation`, `Paint Gesture Detection`, `Fullscreen Control`?**
  _High betweenness centrality (0.264) - this node is a cross-community bridge._
- **Why does `newHTML()` connect `Stage-Library Wiring` to `Live Mirror Sync`, `Editor UI Core`, `Rectangle Geometry`, `Block Connection Logic`, `Mission Notification Bell`, `ScratchJr App Core`, `Page/Sprite Thumbnails`, `ScratchJr Core State`, `Palette Drag-and-Drop`, `Block Palette`, `Mission Progress Badge`, `Home Lobby Entry`, `Sound/Video Recording UI`, `Engine Wiring`, `Block Spec Catalog`, `Undo/Redo Stack`, `Block Argument UI`, `Block Argument Menus`, `Scroll/Pan Control`, `Paint Undo Buffer`, `Paint Color/Size Picker`, `Sample Projects List`, `Mission Authoring Button`, `Paint Side Palette`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Why does `Path` connect `Vector Path Editing` to `SVG Drawing Tools`, `Rectangle Geometry`, `Path Point Manipulation`, `Path Background Cropping`, `Path Data Serialization`, `Bezier Curve Drawing`, `Path Intersection Detection`, `Path Edit Mode`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **What connects `workingCanvas`, `workingCanvas2`, `onBackButtonCallback` to the rest of the system?**
  _47 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Live Mirror Sync` be split into smaller, more focused modules?**
  _Cohesion score 0.07039573820395738 - nodes in this community are weakly interconnected._
- **Should `Paint Action History` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._
- **Should `Sprite Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.07175141242937853 - nodes in this community are weakly interconnected._