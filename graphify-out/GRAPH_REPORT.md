# Graph Report - .  (2026-08-24)

## Corpus Check
- 1 files · ~108,033 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1923 nodes · 4311 edges · 85 communities (44 shown, 41 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Live Mirror Sync|Live Mirror Sync]]
- [[_COMMUNITY_Paint Action History|Paint Action History]]
- [[_COMMUNITY_Execution Engine Core|Execution Engine Core]]
- [[_COMMUNITY_Sprite Engine|Sprite Engine]]
- [[_COMMUNITY_Editor UI Core|Editor UI Core]]
- [[_COMMUNITY_Web Interface Bridge|Web Interface Bridge]]
- [[_COMMUNITY_SVG Drawing Tools|SVG Drawing Tools]]
- [[_COMMUNITY_iOS Platform Bridge|iOS Platform Bridge]]
- [[_COMMUNITY_Block Rendering|Block Rendering]]
- [[_COMMUNITY_Stage Engine|Stage Engine]]
- [[_COMMUNITY_Project Lifecycle|Project Lifecycle]]
- [[_COMMUNITY_SVG to Canvas Rendering|SVG to Canvas Rendering]]
- [[_COMMUNITY_Mission Progress Badge|Mission Progress Badge]]
- [[_COMMUNITY_PageSprite Thumbnails|Page/Sprite Thumbnails]]
- [[_COMMUNITY_Asset Library UI|Asset Library UI]]
- [[_COMMUNITY_Block Palette|Block Palette]]
- [[_COMMUNITY_Scripts Pane Blocks|Scripts Pane Blocks]]
- [[_COMMUNITY_ScratchJr Core State|ScratchJr Core State]]
- [[_COMMUNITY_Vector Path Editing|Vector Path Editing]]
- [[_COMMUNITY_Paint Editor Core|Paint Editor Core]]
- [[_COMMUNITY_Ghost Outline Tool|Ghost Outline Tool]]
- [[_COMMUNITY_Player Mode Patches|Player Mode Patches]]
- [[_COMMUNITY_Home Lobby Events|Home Lobby Events]]
- [[_COMMUNITY_Block Connection Logic|Block Connection Logic]]
- [[_COMMUNITY_ScratchJr App Core|ScratchJr App Core]]
- [[_COMMUNITY_Page Engine|Page Engine]]
- [[_COMMUNITY_Block Spec Catalog|Block Spec Catalog]]
- [[_COMMUNITY_Palette Drag-and-Drop|Palette Drag-and-Drop]]
- [[_COMMUNITY_Block Argument Menus|Block Argument Menus]]
- [[_COMMUNITY_SVG Transform Matrix|SVG Transform Matrix]]
- [[_COMMUNITY_Snap.svg Library (vendored)|Snap.svg Library (vendored)]]
- [[_COMMUNITY_SoundVideo Recording UI|Sound/Video Recording UI]]
- [[_COMMUNITY_Input Event Handling|Input Event Handling]]
- [[_COMMUNITY_Editor Entry Boot|Editor Entry Boot]]
- [[_COMMUNITY_Paint Layer Management|Paint Layer Management]]
- [[_COMMUNITY_In-App Help Guides|In-App Help Guides]]
- [[_COMMUNITY_IO Persistence Layer|IO Persistence Layer]]
- [[_COMMUNITY_UndoRedo Stack|Undo/Redo Stack]]
- [[_COMMUNITY_Lobby-Viewport Wiring|Lobby-Viewport Wiring]]
- [[_COMMUNITY_Snap.svg Shim|Snap.svg Shim]]
- [[_COMMUNITY_Stage Grid Overlay|Stage Grid Overlay]]
- [[_COMMUNITY_SVG Image Element|SVG Image Element]]
- [[_COMMUNITY_ScrollPan Control|Scroll/Pan Control]]
- [[_COMMUNITY_Rectangle Geometry|Rectangle Geometry]]
- [[_COMMUNITY_Mission Authoring Button|Mission Authoring Button]]
- [[_COMMUNITY_Block Spec Catalog (Core)|Block Spec Catalog (Core)]]
- [[_COMMUNITY_2D Vector Math|2D Vector Math]]
- [[_COMMUNITY_Paint Undo Buffer|Paint Undo Buffer]]
- [[_COMMUNITY_2D Matrix Math|2D Matrix Math]]
- [[_COMMUNITY_Camera Capture|Camera Capture]]
- [[_COMMUNITY_Media Key Generation|Media Key Generation]]
- [[_COMMUNITY_Audio Playback Engine|Audio Playback Engine]]
- [[_COMMUNITY_Sample Projects List|Sample Projects List]]
- [[_COMMUNITY_Time Tracking|Time Tracking]]
- [[_COMMUNITY_JSZip Shim|JSZip Shim]]
- [[_COMMUNITY_Color Conversion Helpers|Color Conversion Helpers]]
- [[_COMMUNITY_Mission Notification Bell|Mission Notification Bell]]
- [[_COMMUNITY_PNG Render Cache|PNG Render Cache]]
- [[_COMMUNITY_Node Stream Shim|Node Stream Shim]]
- [[_COMMUNITY_SVG Path Drawing Util|SVG Path Drawing Util]]
- [[_COMMUNITY_ColorCanvas Draw Helpers|Color/Canvas Draw Helpers]]

## God Nodes (most connected - your core abstractions)
1. `gn()` - 231 edges
2. `Paint` - 117 edges
3. `ScratchJr` - 104 edges
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
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 3-file cycle: `src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ui/UI.js -> src/app/src/editor/ui/ScriptsPane.js`
- 4-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 4-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 4-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 5-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 5-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 5-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`

## Communities (85 total, 41 thin omitted)

### Community 0 - "Live Mirror Sync"
Cohesion: 0.06
Nodes (66): applyHoverTarget(), applyPageList(), applyStageState(), applyUiState(), buildMirrorPayload(), fakeTouchEvent(), _findHoverElement(), hideLockOverlay() (+58 more)

### Community 2 - "Execution Engine Core"
Cohesion: 0.06
Nodes (4): hopList, Prims, Runtime, Thread

### Community 8 - "Block Rendering"
Cohesion: 0.10
Nodes (11): BlockArg, Alert, CSSTransition(), getStringSize(), newCanvas(), newForm(), newImage(), newTextInput() (+3 more)

### Community 12 - "Mission Progress Badge"
Cohesion: 0.10
Nodes (16): apiFetch(), AssignmentBadge, authHeader(), dismissedHintIds, CARET_TYPES, compareManifests(), computeProjectManifest(), DATA_REPRESENTATION_TYPES (+8 more)

### Community 19 - "Paint Editor Core"
Cohesion: 0.09
Nodes (10): fontcolors, fontsizes, getshapes, loadassets, sendshapes, speeds, ScriptsPane, hit3DRect() (+2 more)

### Community 22 - "Home Lobby Events"
Cohesion: 0.10
Nodes (15): applyScratchJrPlayerPatches(), applyPagePlayerPatches(), applySpritePlayerPatches(), applyStagePlayerPatches(), EMOJIS, LABELS, playerMain(), _prefetchMedia() (+7 more)

### Community 25 - "Page Engine"
Cohesion: 0.15
Nodes (17): onBackButtonCallback, workingCanvas, workingCanvas2, maskCanvas, maskData, offscreen, targetOffscreen, deltaPoint (+9 more)

### Community 27 - "Palette Drag-and-Drop"
Cohesion: 0.19
Nodes (9): Menu, pinchcenter, drawThumbnail(), getDocumentHeight(), getDocumentWidth(), globalx(), globaly(), newHTML() (+1 more)

### Community 29 - "SVG Transform Matrix"
Cohesion: 0.32
Nodes (26): a(), b(), c(), d(), e(), f(), g(), h() (+18 more)

### Community 32 - "Input Event Handling"
Cohesion: 0.11
Nodes (10): gettingStartedMain(), indexFirstTime(), indexLoadOptions(), indexLoadStart(), indexLoadUsage(), indexMain(), indexSetUsage(), setClassOfElementById() (+2 more)

### Community 34 - "Paint Layer Management"
Cohesion: 0.18
Nodes (6): inappAbout(), inappBlocksGuide(), inappInterfaceGuide(), inappPaintEditorGuide(), Lobby, gn()

### Community 37 - "Undo/Redo Stack"
Cohesion: 0.13
Nodes (17): css_vh(), css_vw(), drawScaled(), ensureEditorFrames(), fitInRect(), getFit(), getHex(), getViewportHeight() (+9 more)

### Community 38 - "Lobby-Viewport Wiring"
Cohesion: 0.09
Nodes (3): SnapElement, SnapPaper, SnapShim

### Community 39 - "Snap.svg Shim"
Cohesion: 0.16
Nodes (6): homeMain(), homeStrings(), keys, Cookie, Localization, localizationMessages

### Community 40 - "Stage Grid Overlay"
Cohesion: 0.19
Nodes (3): Grid, newDiv(), newP()

### Community 42 - "SVG Image Element"
Cohesion: 0.19
Nodes (3): SVGImage, getIdFor(), getIdForCamera()

### Community 48 - "Mission Authoring Button"
Cohesion: 0.25
Nodes (8): apiFetch(), AssignmentAuthorBar, authHeader(), decodeJwtPayloadUnsafe(), getAuthorId(), HINT_WHEN_LABELS, hintWhenLabel(), isAllowedReturnUrl()

### Community 68 - "Color Conversion Helpers"
Cohesion: 0.25
Nodes (7): getRGB(), rgb2hsb(), curveoptions, dispatchAbsouluteCmd, dispatchDrawCmd, qcurveoptions, strokevalues

### Community 69 - "Mission Notification Bell"
Cohesion: 0.52
Nodes (3): apiFetch(), AssignmentNotice, authHeader()

### Community 74 - "Node Stream Shim"
Cohesion: 0.29
Nodes (3): Readable, Transform, Writable

## Knowledge Gaps
- **50 isolated node(s):** `loadassets`, `fontcolors`, `fontsizes`, `getshapes`, `sendshapes` (+45 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **41 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `gn()` connect `Paint Layer Management` to `Live Mirror Sync`, `Paint Action History`, `Execution Engine Core`, `Editor UI Core`, `iOS Platform Bridge`, `Block Rendering`, `Stage Engine`, `Page/Sprite Thumbnails`, `Vector Path Editing`, `Paint Editor Core`, `Player Mode Patches`, `Home Lobby Events`, `Block Connection Logic`, `Page Engine`, `Palette Drag-and-Drop`, `Block Argument Menus`, `Snap.svg Library (vendored)`, `Sound/Video Recording UI`, `Input Event Handling`, `Editor Entry Boot`, `IO Persistence Layer`, `Undo/Redo Stack`, `Snap.svg Shim`, `Stage Grid Overlay`, `Path Background Cropping`, `SVG Image Element`, `Bezier Curve Drawing`, `Paint Undo Buffer`, `Path Edit Mode`, `Camera Capture`, `Sample Projects List`, `Mission Notification Bell`, `Path Point Manipulation`, `Path Intersection Detection`, `Path Dot Handles`?**
  _High betweenness centrality (0.244) - this node is a cross-community bridge._
- **Why does `ScratchJr` connect `ScratchJr Core State` to `App Boot Sequence`, `Execution Engine Core`, `Block Rendering`, `Stage Grid Overlay`, `Selection State`, `Argument Editing State`, `Fullscreen Control`, `Numeric Keypad Input`, `Paint Editor Core`, `Home Lobby Events`, `Page Engine`, `Palette Drag-and-Drop`?**
  _High betweenness centrality (0.102) - this node is a cross-community bridge._
- **Why does `Paint` connect `Ghost Outline Tool` to `Paint Side Palette`, `Paint Gesture Detection`, `Paint Asset Import (XML)`, `Home Lobby Events`, `Paint Color/Size Picker`, `Paint Canvas Positioning`, `Page Engine`, `Palette Drag-and-Drop`, `Paint Page Navigation`, `Paint Grid Overlay`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **What connects `loadassets`, `fontcolors`, `fontsizes` to the rest of the system?**
  _50 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Live Mirror Sync` be split into smaller, more focused modules?**
  _Cohesion score 0.06126126126126126 - nodes in this community are weakly interconnected._
- **Should `Paint Action History` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._
- **Should `Execution Engine Core` be split into smaller, more focused modules?**
  _Cohesion score 0.05764145954521417 - nodes in this community are weakly interconnected._