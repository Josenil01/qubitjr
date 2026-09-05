# Graph Report - .  (2026-09-05)

## Corpus Check
- 1 files · ~111,916 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1934 nodes · 4337 edges · 89 communities (43 shown, 46 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_IO Persistence Layer|IO Persistence Layer]]
- [[_COMMUNITY_Editor Bootstrap & Block Drag Utilities|Editor Bootstrap & Block Drag Utilities]]
- [[_COMMUNITY_Ghost Outline Tool|Ghost Outline Tool]]
- [[_COMMUNITY_Web Interface Bridge|Web Interface Bridge]]
- [[_COMMUNITY_Web Interface Bridge|Web Interface Bridge]]
- [[_COMMUNITY_Block Spec Catalog (Core)|Block Spec Catalog (Core)]]
- [[_COMMUNITY_ScratchJr Core State|ScratchJr Core State]]
- [[_COMMUNITY_ScratchJr Core State|ScratchJr Core State]]
- [[_COMMUNITY_ScratchJr Core State|ScratchJr Core State]]
- [[_COMMUNITY_Path Edit Mode|Path Edit Mode]]
- [[_COMMUNITY_SoundVideo Recording UI|Sound/Video Recording UI]]
- [[_COMMUNITY_Scripts Pane Blocks|Scripts Pane Blocks]]
- [[_COMMUNITY_Scripts Pane & Stage UI|Scripts Pane & Stage UI]]
- [[_COMMUNITY_Mission Authoring Button|Mission Authoring Button]]
- [[_COMMUNITY_UndoRedo Stack|Undo/Redo Stack]]
- [[_COMMUNITY_Editor Entry & Mission Flow|Editor Entry & Mission Flow]]
- [[_COMMUNITY_Page Engine|Page Engine]]
- [[_COMMUNITY_Asset Library UI|Asset Library UI]]
- [[_COMMUNITY_2D Matrix Math|2D Matrix Math]]
- [[_COMMUNITY_PageSprite Thumbnails|Page/Sprite Thumbnails]]
- [[_COMMUNITY_Argument Editing State|Argument Editing State]]
- [[_COMMUNITY_Block & Alert Drawing Utils|Block & Alert Drawing Utils]]
- [[_COMMUNITY_Media Library Catalog|Media Library Catalog]]
- [[_COMMUNITY_Sample Projects List|Sample Projects List]]
- [[_COMMUNITY_Camera Capture|Camera Capture]]
- [[_COMMUNITY_Home Lobby Events|Home Lobby Events]]
- [[_COMMUNITY_Paint Layer Management|Paint Layer Management]]
- [[_COMMUNITY_Paint Action History|Paint Action History]]
- [[_COMMUNITY_Paint Page Navigation|Paint Page Navigation]]
- [[_COMMUNITY_Vector Path Editing|Vector Path Editing]]
- [[_COMMUNITY_Paint Canvas Positioning|Paint Canvas Positioning]]
- [[_COMMUNITY_SVG Transform Matrix|SVG Transform Matrix]]
- [[_COMMUNITY_JSZip Shim|JSZip Shim]]
- [[_COMMUNITY_Stage Grid Overlay|Stage Grid Overlay]]
- [[_COMMUNITY_Node Stream Shim|Node Stream Shim]]
- [[_COMMUNITY_Snap.svg Library (vendored)|Snap.svg Library (vendored)]]
- [[_COMMUNITY_SVG Path Drawing Util|SVG Path Drawing Util]]
- [[_COMMUNITY_SVG to Canvas Rendering|SVG to Canvas Rendering]]
- [[_COMMUNITY_ColorCanvas Draw Helpers|Color/Canvas Draw Helpers]]
- [[_COMMUNITY_Onboarding & Paint Bridge|Onboarding & Paint Bridge]]
- [[_COMMUNITY_Camera Capture|Camera Capture]]
- [[_COMMUNITY_Stage Engine|Stage Engine]]
- [[_COMMUNITY_Scripts Pane & Stage UI|Scripts Pane & Stage UI]]
- [[_COMMUNITY_Execution Engine Core|Execution Engine Core]]
- [[_COMMUNITY_Editor UI Core|Editor UI Core]]
- [[_COMMUNITY_Onboarding & Paint Bridge|Onboarding & Paint Bridge]]
- [[_COMMUNITY_iOS Platform Bridge|iOS Platform Bridge]]
- [[_COMMUNITY_Input Event Handling|Input Event Handling]]
- [[_COMMUNITY_Live Mirror Sync|Live Mirror Sync]]
- [[_COMMUNITY_Stage & Scripts UI Layer|Stage & Scripts UI Layer]]
- [[_COMMUNITY_Time Tracking|Time Tracking]]
- [[_COMMUNITY_Mission Progress Badge|Mission Progress Badge]]
- [[_COMMUNITY_ScratchJr App Core|ScratchJr App Core]]
- [[_COMMUNITY_Sprite Engine|Sprite Engine]]
- [[_COMMUNITY_Block Palette|Block Palette]]
- [[_COMMUNITY_Block & Sprite Interaction Layer|Block & Sprite Interaction Layer]]
- [[_COMMUNITY_Project Lifecycle|Project Lifecycle]]
- [[_COMMUNITY_IO Persistence Layer|IO Persistence Layer]]
- [[_COMMUNITY_PNG Render Cache|PNG Render Cache]]
- [[_COMMUNITY_Block Connection Logic|Block Connection Logic]]
- [[_COMMUNITY_Lobby & Media Bridge|Lobby & Media Bridge]]
- [[_COMMUNITY_Paint Editor Core|Paint Editor Core]]
- [[_COMMUNITY_SVG Drawing Tools|SVG Drawing Tools]]
- [[_COMMUNITY_Mission Notification Bell|Mission Notification Bell]]
- [[_COMMUNITY_Editor Entry & Mission Flow|Editor Entry & Mission Flow]]

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
- 3-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ui/UI.js -> src/app/src/editor/ui/ScriptsPane.js`
- 4-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 4-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 4-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 5-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 5-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 5-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`

## Communities (89 total, 46 thin omitted)

### Community 43 - "IO Persistence Layer"
Cohesion: 0.18
Nodes (11): applyScratchJrPlayerPatches(), applyPagePlayerPatches(), applySpritePlayerPatches(), applyStagePlayerPatches(), buffer, EMOJIS, LABELS, playerMain() (+3 more)

### Community 33 - "Editor Bootstrap & Block Drag Utilities"
Cohesion: 0.13
Nodes (13): loadassets, fontcolors, fontsizes, getshapes, sendshapes, speeds, hit3DRect(), localx() (+5 more)

### Community 11 - "Ghost Outline Tool"
Cohesion: 0.10
Nodes (4): Block, setProps(), CSSTransition(), newForm()

### Community 42 - "Web Interface Bridge"
Cohesion: 0.20
Nodes (6): Menu, Alert, globalx(), globaly(), drawThumbnail(), getStringSize()

### Community 37 - "Path Edit Mode"
Cohesion: 0.19
Nodes (4): Grid, newDiv(), newCanvas(), newP()

### Community 19 - "Scripts Pane & Stage UI"
Cohesion: 0.14
Nodes (13): pinchcenter, newImage(), newHTML(), hitRect(), setCanvasSize(), setCanvasSizeScaledToWindowDocumentHeight(), getDocumentHeight(), getDocumentWidth() (+5 more)

### Community 34 - "Editor Entry & Mission Flow"
Cohesion: 0.12
Nodes (10): gettingStartedMain(), indexMain(), indexFirstTime(), indexLoadOptions(), indexLoadStart(), indexLoadUsage(), setClassOfElementById(), indexSetUsage() (+2 more)

### Community 40 - "Page Engine"
Cohesion: 0.16
Nodes (6): homeMain(), homeStrings(), keys, Cookie, localizationMessages, Localization

### Community 25 - "Asset Library UI"
Cohesion: 0.16
Nodes (6): inappAbout(), inappInterfaceGuide(), inappPaintEditorGuide(), inappBlocksGuide(), Lobby, gn()

### Community 24 - "Page/Sprite Thumbnails"
Cohesion: 0.16
Nodes (16): maskCanvas, maskData, targetOffscreen, offscreen, dragGroup, cmdForMouseDown, cmdForMouseMove, cmdForMouseUp (+8 more)

### Community 35 - "Stage Grid Overlay"
Cohesion: 0.09
Nodes (3): SnapShim, SnapPaper, SnapElement

### Community 78 - "Node Stream Shim"
Cohesion: 0.29
Nodes (3): Readable, Writable, Transform

### Community 27 - "Snap.svg Library (vendored)"
Cohesion: 0.32
Nodes (26): c(), d(), e(), f(), h(), i(), j(), k() (+18 more)

### Community 54 - "Onboarding & Paint Bridge"
Cohesion: 0.18
Nodes (4): uiSounds, defaultSounds, projectSounds, Sound

### Community 36 - "Onboarding & Paint Bridge"
Cohesion: 0.14
Nodes (17): libInit(), ensureEditorFrames(), preprocess(), preprocessAndLoad(), preprocessAndLoadCss(), fitInRect(), getFit(), rgb2hsb() (+9 more)

### Community 0 - "Live Mirror Sync"
Cohesion: 0.06
Nodes (66): _lastSpriteIds, resetMirrorState(), showLockOverlay(), hideLockOverlay(), isLockOverlayShown(), reserveFrameTopSpace(), reloadProjectFromBackend(), _shallowCopyStageData() (+58 more)

### Community 7 - "Mission Progress Badge"
Cohesion: 0.08
Nodes (16): TRIGGER_TYPES, CARET_TYPES, DATA_REPRESENTATION_TYPES, SYNC_TIER2_TYPES, emptyManifest(), walkScript(), computeProjectManifest(), compareManifests() (+8 more)

### Community 74 - "Mission Notification Bell"
Cohesion: 0.52
Nodes (3): authHeader(), apiFetch(), AssignmentNotice

### Community 39 - "Editor Entry & Mission Flow"
Cohesion: 0.19
Nodes (7): isAllowedReturnUrl(), decodeJwtPayloadUnsafe(), getAuthorId(), authHeader(), apiFetch(), HINT_WHEN_LABELS, AssignmentAuthorBar

## Knowledge Gaps
- **50 isolated node(s):** `loadassets`, `fontcolors`, `fontsizes`, `getshapes`, `sendshapes` (+45 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **46 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `gn()` connect `Asset Library UI` to `Live Mirror Sync`, `Paint Action History`, `Editor UI Core`, `iOS Platform Bridge`, `Stage Engine`, `Execution Engine Core`, `ScratchJr Core State`, `Vector Path Editing`, `Scripts Pane & Stage UI`, `Paint Editor Core`, `Home Lobby Events`, `Page/Sprite Thumbnails`, `SVG Transform Matrix`, `Sound/Video Recording UI`, `Input Event Handling`, `Paint Layer Management`, `Undo/Redo Stack`, `Editor Bootstrap & Block Drag Utilities`, `Editor Entry & Mission Flow`, `Onboarding & Paint Bridge`, `Path Edit Mode`, `Page Engine`, `Snap.svg Shim`, `Web Interface Bridge`, `IO Persistence Layer`, `Scripts Pane & Stage UI`, `Rectangle Geometry`, `Paint Canvas Positioning`, `Onboarding & Paint Bridge`, `Paint Page Navigation`, `Bezier Curve Drawing`, `ScratchJr Core State`, `Camera Capture`, `Sample Projects List`, `Mission Notification Bell`, `Path Point Manipulation`, `Paint Side Palette`, `Vector Path Editing`?**
  _High betweenness centrality (0.244) - this node is a cross-community bridge._
- **Why does `ScratchJr` connect `ScratchJr App Core` to `Editor Bootstrap & Block Drag Utilities`, `Path Edit Mode`, `App Boot Sequence`, `Web Interface Bridge`, `IO Persistence Layer`, `Scroll/Pan Control`, `Selection State`, `Fullscreen Control`, `Numeric Keypad Input`, `Scripts Pane & Stage UI`, `Page/Sprite Thumbnails`, `ScratchJr Core State`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **Why does `newHTML()` connect `Scripts Pane & Stage UI` to `Live Mirror Sync`, `Editor UI Core`, `Mission Progress Badge`, `Execution Engine Core`, `Paint Editor Core`, `Page/Sprite Thumbnails`, `Asset Library UI`, `Sound/Video Recording UI`, `Undo/Redo Stack`, `Editor Bootstrap & Block Drag Utilities`, `Onboarding & Paint Bridge`, `Path Edit Mode`, `Web Interface Bridge`, `Editor Entry & Mission Flow`, `Page Engine`, `Web Interface Bridge`, `IO Persistence Layer`, `Mission Authoring Button`, `Paint Page Navigation`, `Sample Projects List`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **What connects `loadassets`, `fontcolors`, `fontsizes` to the rest of the system?**
  _50 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Editor Bootstrap & Block Drag Utilities` be split into smaller, more focused modules?**
  _Cohesion score 0.12648221343873517 - nodes in this community are weakly interconnected._
- **Should `Ghost Outline Tool` be split into smaller, more focused modules?**
  _Cohesion score 0.09716599190283401 - nodes in this community are weakly interconnected._
- **Should `ScratchJr Core State` be split into smaller, more focused modules?**
  _Cohesion score 0.10793650793650794 - nodes in this community are weakly interconnected._