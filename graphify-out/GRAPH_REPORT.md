# Graph Report - .  (2026-08-24)

## Corpus Check
- 2 files · ~105,337 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1907 nodes · 4282 edges · 84 communities (41 shown, 43 thin omitted)
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
- [[_COMMUNITY_Path Background Cropping|Path Background Cropping]]
- [[_COMMUNITY_Block Argument UI|Block Argument UI]]
- [[_COMMUNITY_ScrollPan Control|Scroll/Pan Control]]
- [[_COMMUNITY_Rectangle Geometry|Rectangle Geometry]]
- [[_COMMUNITY_Bezier Curve Drawing|Bezier Curve Drawing]]
- [[_COMMUNITY_Path Dot Handles|Path Dot Handles]]
- [[_COMMUNITY_Block Spec Catalog (Core)|Block Spec Catalog (Core)]]
- [[_COMMUNITY_2D Vector Math|2D Vector Math]]
- [[_COMMUNITY_Canvas Drawing Primitives|Canvas Drawing Primitives]]
- [[_COMMUNITY_Paint ColorSize Picker|Paint Color/Size Picker]]
- [[_COMMUNITY_Paint Canvas Positioning|Paint Canvas Positioning]]
- [[_COMMUNITY_Path Intersection Detection|Path Intersection Detection]]
- [[_COMMUNITY_Canvas Draw Commands|Canvas Draw Commands]]
- [[_COMMUNITY_App Boot Sequence|App Boot Sequence]]
- [[_COMMUNITY_Time Tracking|Time Tracking]]
- [[_COMMUNITY_Thread Execution|Thread Execution]]
- [[_COMMUNITY_JSZip Shim|JSZip Shim]]
- [[_COMMUNITY_Mission Notification Bell|Mission Notification Bell]]
- [[_COMMUNITY_Path Point Manipulation|Path Point Manipulation]]
- [[_COMMUNITY_PNG Render Cache|PNG Render Cache]]
- [[_COMMUNITY_Fullscreen Control|Fullscreen Control]]

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
- `homeMain()` --calls--> `gn()`  [EXTRACTED]
  src/app/src/entry/home.js → src/app/src/utils/lib.js
- `homeStrings()` --calls--> `gn()`  [EXTRACTED]
  src/app/src/entry/home.js → src/app/src/utils/lib.js
- `inappAbout()` --calls--> `gn()`  [EXTRACTED]
  src/app/src/entry/inapp.js → src/app/src/utils/lib.js

## Import Cycles
- 3-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ui/UI.js -> src/app/src/editor/ui/ScriptsPane.js`
- 4-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 4-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 4-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 5-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 5-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 5-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`

## Communities (84 total, 43 thin omitted)

### Community 0 - "Live Mirror Sync"
Cohesion: 0.06
Nodes (66): applyHoverTarget(), applyPageList(), applyStageState(), applyUiState(), buildMirrorPayload(), fakeTouchEvent(), _findHoverElement(), hideLockOverlay() (+58 more)

### Community 4 - "SVG Drawing Tools"
Cohesion: 0.08
Nodes (7): hopList, Thread, Grid, Scroll, CSSTransition3D(), newDiv(), newP()

### Community 8 - "Stage Engine"
Cohesion: 0.08
Nodes (27): Menu, css_vh(), css_vw(), CSSTransition(), drawScaled(), drawThumbnail(), ensureEditorFrames(), fitInRect() (+19 more)

### Community 13 - "Asset Library UI"
Cohesion: 0.12
Nodes (7): ScriptsPane, pinchcenter, globalx(), globaly(), hit3DRect(), localx(), localy()

### Community 20 - "Block Connection Logic"
Cohesion: 0.10
Nodes (19): onBackButtonCallback, applyScratchJrPlayerPatches(), workingCanvas, workingCanvas2, applyPagePlayerPatches(), applySpritePlayerPatches(), applyStagePlayerPatches(), EMOJIS (+11 more)

### Community 23 - "Block Rendering"
Cohesion: 0.09
Nodes (14): gettingStartedMain(), indexFirstTime(), indexLoadOptions(), indexLoadStart(), indexLoadUsage(), indexMain(), indexSetUsage(), setClassOfElementById() (+6 more)

### Community 26 - "Mission Progress Badge"
Cohesion: 0.12
Nodes (11): apiFetch(), AssignmentBadge, authHeader(), CARET_TYPES, compareManifests(), computeProjectManifest(), DATA_REPRESENTATION_TYPES, emptyManifest() (+3 more)

### Community 28 - "SVG Transform Matrix"
Cohesion: 0.16
Nodes (16): maskCanvas, maskData, offscreen, targetOffscreen, cmdForClick, cmdForMouseDown, cmdForMouseMove, cmdForMouseUp (+8 more)

### Community 30 - "Sound/Video Recording UI"
Cohesion: 0.32
Nodes (26): a(), b(), c(), d(), e(), f(), g(), h() (+18 more)

### Community 37 - "Snap.svg Shim"
Cohesion: 0.16
Nodes (3): BlockArg, newCanvas(), writeText()

### Community 38 - "Execution Engine Core"
Cohesion: 0.19
Nodes (6): inappAbout(), inappBlocksGuide(), inappInterfaceGuide(), inappPaintEditorGuide(), Lobby, gn()

### Community 40 - "Path Background Cropping"
Cohesion: 0.09
Nodes (3): SnapElement, SnapPaper, SnapShim

### Community 41 - "Block Argument UI"
Cohesion: 0.16
Nodes (6): homeMain(), homeStrings(), keys, Cookie, Localization, localizationMessages

### Community 52 - "2D Vector Math"
Cohesion: 0.24
Nodes (3): Alert, DrawPath, getStringSize()

### Community 58 - "Paint Canvas Positioning"
Cohesion: 0.22
Nodes (4): defaultSounds, projectSounds, uiSounds, Sound

### Community 69 - "JSZip Shim"
Cohesion: 0.29
Nodes (6): fontcolors, fontsizes, getshapes, loadassets, sendshapes, speeds

### Community 70 - "Mission Notification Bell"
Cohesion: 0.52
Nodes (3): apiFetch(), AssignmentNotice, authHeader()

### Community 73 - "PNG Render Cache"
Cohesion: 0.29
Nodes (3): Readable, Transform, Writable

## Knowledge Gaps
- **47 isolated node(s):** `loadassets`, `fontcolors`, `fontsizes`, `getshapes`, `sendshapes` (+42 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **43 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `gn()` connect `Execution Engine Core` to `Live Mirror Sync`, `Paint Action History`, `SVG Drawing Tools`, `iOS Platform Bridge`, `Editor Panel Wiring`, `Stage Engine`, `ScratchJr App Core`, `Page/Sprite Thumbnails`, `Asset Library UI`, `Block Primitives`, `Ghost Outline Tool`, `Block Connection Logic`, `Home Lobby Events`, `Block Rendering`, `Home Lobby Entry`, `Vector Path Editing`, `SVG Transform Matrix`, `Snap.svg Library (vendored)`, `Input Event Handling`, `Paint Layer Management`, `Block Spec Catalog`, `IO Persistence Layer`, `Player Mode Patches`, `Platform UI Wiring`, `Block Argument UI`, `Selection State`, `Argument Editing State`, `Path Dot Handles`, `Paint Color/Size Picker`, `App Boot Sequence`, `Mission Notification Bell`, `Paint Side Palette`, `Node Stream Shim`, `Path Data Serialization`?**
  _High betweenness centrality (0.242) - this node is a cross-community bridge._
- **Why does `Paint` connect `Paint Editor Core` to `Sample Projects List`, `Stage Engine`, `Sound Playback`, `Script Runtime Execution`, `Block Connection Logic`, `Paint Asset Import (XML)`, `SVG Image Element`, `SVG Transform Matrix`, `2D Matrix Math`, `Camera Capture`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **Why does `ScratchJr` connect `Editor Entry Boot` to `Media Key Generation`, `SVG Drawing Tools`, `Snap.svg Shim`, `Stage Engine`, `Lobby Error Handling`, `Scripts Pane Drop Handling`, `Paint Undo Buffer`, `SVG Path Drawing Util`, `Asset Library UI`, `Block Connection Logic`, `Mission Progress Badge`, `SVG Transform Matrix`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **What connects `loadassets`, `fontcolors`, `fontsizes` to the rest of the system?**
  _47 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Live Mirror Sync` be split into smaller, more focused modules?**
  _Cohesion score 0.06126126126126126 - nodes in this community are weakly interconnected._
- **Should `Paint Action History` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._
- **Should `Sprite Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.07175141242937853 - nodes in this community are weakly interconnected._