# Graph Report - .  (2026-08-23)

## Corpus Check
- 2 files · ~104,758 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1905 nodes · 4296 edges · 87 communities (42 shown, 45 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Live Mirror Sync|Live Mirror Sync]]
- [[_COMMUNITY_Paint Action History|Paint Action History]]
- [[_COMMUNITY_Sprite Engine|Sprite Engine]]
- [[_COMMUNITY_Web Interface Bridge|Web Interface Bridge]]
- [[_COMMUNITY_SVG Drawing Tools|SVG Drawing Tools]]
- [[_COMMUNITY_Editor UI Core|Editor UI Core]]
- [[_COMMUNITY_iOS Platform Bridge|iOS Platform Bridge]]
- [[_COMMUNITY_Editor Panel Wiring|Editor Panel Wiring]]
- [[_COMMUNITY_Stage Engine|Stage Engine]]
- [[_COMMUNITY_ScratchJr App Core|ScratchJr App Core]]
- [[_COMMUNITY_Project Lifecycle|Project Lifecycle]]
- [[_COMMUNITY_SVG to Canvas Rendering|SVG to Canvas Rendering]]
- [[_COMMUNITY_PageSprite Thumbnails|Page/Sprite Thumbnails]]
- [[_COMMUNITY_Asset Library UI|Asset Library UI]]
- [[_COMMUNITY_Block Palette|Block Palette]]
- [[_COMMUNITY_Scripts Pane Blocks|Scripts Pane Blocks]]
- [[_COMMUNITY_ScratchJr Core State|ScratchJr Core State]]
- [[_COMMUNITY_Block Primitives|Block Primitives]]
- [[_COMMUNITY_Editor Entry Boot|Editor Entry Boot]]
- [[_COMMUNITY_Ghost Outline Tool|Ghost Outline Tool]]
- [[_COMMUNITY_Block Connection Logic|Block Connection Logic]]
- [[_COMMUNITY_Home Lobby Events|Home Lobby Events]]
- [[_COMMUNITY_Paint Editor Core|Paint Editor Core]]
- [[_COMMUNITY_Block Rendering|Block Rendering]]
- [[_COMMUNITY_Home Lobby Entry|Home Lobby Entry]]
- [[_COMMUNITY_Vector Path Editing|Vector Path Editing]]
- [[_COMMUNITY_Mission Progress Badge|Mission Progress Badge]]
- [[_COMMUNITY_Page Engine|Page Engine]]
- [[_COMMUNITY_SVG Transform Matrix|SVG Transform Matrix]]
- [[_COMMUNITY_Snap.svg Library (vendored)|Snap.svg Library (vendored)]]
- [[_COMMUNITY_SoundVideo Recording UI|Sound/Video Recording UI]]
- [[_COMMUNITY_Input Event Handling|Input Event Handling]]
- [[_COMMUNITY_Paint Layer Management|Paint Layer Management]]
- [[_COMMUNITY_Block Spec Catalog|Block Spec Catalog]]
- [[_COMMUNITY_IO Persistence Layer|IO Persistence Layer]]
- [[_COMMUNITY_UndoRedo Stack|Undo/Redo Stack]]
- [[_COMMUNITY_Player Mode Patches|Player Mode Patches]]
- [[_COMMUNITY_Snap.svg Shim|Snap.svg Shim]]
- [[_COMMUNITY_Execution Engine Core|Execution Engine Core]]
- [[_COMMUNITY_Platform UI Wiring|Platform UI Wiring]]
- [[_COMMUNITY_Block Argument UI|Block Argument UI]]
- [[_COMMUNITY_Lobby Error Handling|Lobby Error Handling]]
- [[_COMMUNITY_Scripts Pane Drop Handling|Scripts Pane Drop Handling]]
- [[_COMMUNITY_ScrollPan Control|Scroll/Pan Control]]
- [[_COMMUNITY_Rectangle Geometry|Rectangle Geometry]]
- [[_COMMUNITY_Block Spec Catalog (Core)|Block Spec Catalog (Core)]]
- [[_COMMUNITY_Script Runtime Execution|Script Runtime Execution]]
- [[_COMMUNITY_2D Vector Math|2D Vector Math]]
- [[_COMMUNITY_SVG Image Element|SVG Image Element]]
- [[_COMMUNITY_2D Matrix Math|2D Matrix Math]]
- [[_COMMUNITY_Camera Capture|Camera Capture]]
- [[_COMMUNITY_Media Key Generation|Media Key Generation]]
- [[_COMMUNITY_Sample Projects List|Sample Projects List]]
- [[_COMMUNITY_Time Tracking|Time Tracking]]
- [[_COMMUNITY_Thread Execution|Thread Execution]]
- [[_COMMUNITY_JSZip Shim|JSZip Shim]]
- [[_COMMUNITY_Mission Notification Bell|Mission Notification Bell]]
- [[_COMMUNITY_PNG Render Cache|PNG Render Cache]]
- [[_COMMUNITY_Node Stream Shim|Node Stream Shim]]
- [[_COMMUNITY_SVG Path Drawing Util|SVG Path Drawing Util]]
- [[_COMMUNITY_Sound Playback|Sound Playback]]

## God Nodes (most connected - your core abstractions)
1. `gn()` - 231 edges
2. `Paint` - 117 edges
3. `ScratchJr` - 105 edges
4. `SVG2Canvas` - 79 edges
5. `PaintAction` - 71 edges
6. `newHTML()` - 67 edges
7. `UI` - 65 edges
8. `Sprite` - 63 edges
9. `SVGTools` - 60 edges
10. `iOS` - 57 edges

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
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ui/UI.js -> src/app/src/editor/ui/ScriptsPane.js`
- 4-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 4-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 4-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 5-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 5-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 5-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`

## Communities (87 total, 45 thin omitted)

### Community 0 - "Live Mirror Sync"
Cohesion: 0.07
Nodes (65): applyHoverTarget(), applyPageList(), applyStageState(), applyUiState(), buildMirrorPayload(), fakeTouchEvent(), _findHoverElement(), hideLockOverlay() (+57 more)

### Community 5 - "Editor UI Core"
Cohesion: 0.06
Nodes (3): UI, css_vh(), getViewportHeight()

### Community 7 - "Editor Panel Wiring"
Cohesion: 0.10
Nodes (27): pinchcenter, css_vw(), CSSTransition(), drawScaled(), ensureEditorFrames(), fitInRect(), getDocumentHeight(), getDocumentWidth() (+19 more)

### Community 9 - "ScratchJr App Core"
Cohesion: 0.11
Nodes (25): onBackButtonCallback, workingCanvas, workingCanvas2, maskCanvas, maskData, offscreen, targetOffscreen, deltaPoint (+17 more)

### Community 18 - "Editor Entry Boot"
Cohesion: 0.09
Nodes (14): gettingStartedMain(), indexFirstTime(), indexLoadOptions(), indexLoadStart(), indexLoadUsage(), indexMain(), indexSetUsage(), setClassOfElementById() (+6 more)

### Community 23 - "Block Rendering"
Cohesion: 0.15
Nodes (10): Menu, Alert, drawThumbnail(), getStringSize(), globalx(), globaly(), newCanvas(), newDiv() (+2 more)

### Community 24 - "Home Lobby Entry"
Cohesion: 0.14
Nodes (8): homeMain(), homeStrings(), inappAbout(), inappBlocksGuide(), inappInterfaceGuide(), inappPaintEditorGuide(), Lobby, gn()

### Community 26 - "Mission Progress Badge"
Cohesion: 0.12
Nodes (11): apiFetch(), AssignmentBadge, authHeader(), CARET_TYPES, compareManifests(), computeProjectManifest(), DATA_REPRESENTATION_TYPES, emptyManifest() (+3 more)

### Community 29 - "Snap.svg Library (vendored)"
Cohesion: 0.32
Nodes (26): a(), b(), c(), d(), e(), f(), g(), h() (+18 more)

### Community 33 - "Block Spec Catalog"
Cohesion: 0.12
Nodes (10): fontcolors, fontsizes, getshapes, loadassets, sendshapes, speeds, keys, Cookie (+2 more)

### Community 36 - "Player Mode Patches"
Cohesion: 0.17
Nodes (12): applyScratchJrPlayerPatches(), applyPagePlayerPatches(), applySpritePlayerPatches(), applyStagePlayerPatches(), EMOJIS, LABELS, playerMain(), _prefetchMedia() (+4 more)

### Community 37 - "Snap.svg Shim"
Cohesion: 0.09
Nodes (3): SnapElement, SnapPaper, SnapShim

### Community 38 - "Execution Engine Core"
Cohesion: 0.18
Nodes (3): hopList, Grid, newP()

### Community 39 - "Platform UI Wiring"
Cohesion: 0.14
Nodes (5): buffer, defaultSounds, projectSounds, ScratchAudio, uiSounds

### Community 70 - "Mission Notification Bell"
Cohesion: 0.48
Nodes (3): apiFetch(), AssignmentNotice, authHeader()

### Community 74 - "Node Stream Shim"
Cohesion: 0.29
Nodes (3): Readable, Transform, Writable

## Knowledge Gaps
- **47 isolated node(s):** `loadassets`, `fontcolors`, `fontsizes`, `getshapes`, `sendshapes` (+42 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **45 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `gn()` connect `Home Lobby Entry` to `Live Mirror Sync`, `Paint Action History`, `Editor UI Core`, `iOS Platform Bridge`, `Editor Panel Wiring`, `Stage Engine`, `ScratchJr App Core`, `Page/Sprite Thumbnails`, `Block Primitives`, `Editor Entry Boot`, `Ghost Outline Tool`, `Block Rendering`, `Vector Path Editing`, `SVG Transform Matrix`, `Sound/Video Recording UI`, `Input Event Handling`, `Paint Layer Management`, `Block Spec Catalog`, `Undo/Redo Stack`, `Player Mode Patches`, `Execution Engine Core`, `Platform UI Wiring`, `Path Background Cropping`, `Lobby Error Handling`, `Scripts Pane Drop Handling`, `Bezier Curve Drawing`, `Path Dot Handles`, `SVG Image Element`, `Path Intersection Detection`, `Camera Capture`, `Sample Projects List`, `Mission Notification Bell`, `Path Point Manipulation`, `Paint Undo Buffer`?**
  _High betweenness centrality (0.241) - this node is a cross-community bridge._
- **Why does `Paint` connect `Paint Editor Core` to `Player Mode Patches`, `Paint Side Palette`, `Editor Panel Wiring`, `ScratchJr App Core`, `Paint Gesture Detection`, `Paint Page Navigation`, `Paint Asset Import (XML)`, `Paint Color/Size Picker`, `Paint Canvas Positioning`, `Paint Grid Overlay`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **Why does `ScratchJr` connect `ScratchJr Core State` to `App Boot Sequence`, `Block Spec Catalog`, `Player Mode Patches`, `Execution Engine Core`, `Editor Panel Wiring`, `Platform UI Wiring`, `ScratchJr App Core`, `Selection State`, `Argument Editing State`, `Fullscreen Control`, `Numeric Keypad Input`, `Block Rendering`, `Mission Progress Badge`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **What connects `loadassets`, `fontcolors`, `fontsizes` to the rest of the system?**
  _47 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Live Mirror Sync` be split into smaller, more focused modules?**
  _Cohesion score 0.07039573820395738 - nodes in this community are weakly interconnected._
- **Should `Paint Action History` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._
- **Should `Sprite Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.07175141242937853 - nodes in this community are weakly interconnected._