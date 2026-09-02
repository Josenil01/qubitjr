# Graph Report - .  (2026-09-02)

## Corpus Check
- 2 files · ~111,448 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1934 nodes · 4338 edges · 86 communities (42 shown, 44 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Live Mirror Sync|Live Mirror Sync]]
- [[_COMMUNITY_Paint Action History|Paint Action History]]
- [[_COMMUNITY_ScratchJr Core State|ScratchJr Core State]]
- [[_COMMUNITY_Sprite Engine|Sprite Engine]]
- [[_COMMUNITY_SVG Drawing Tools|SVG Drawing Tools]]
- [[_COMMUNITY_Editor UI Core|Editor UI Core]]
- [[_COMMUNITY_Lobby & Media Bridge|Lobby & Media Bridge]]
- [[_COMMUNITY_iOS Platform Bridge|iOS Platform Bridge]]
- [[_COMMUNITY_Mission Progress Badge|Mission Progress Badge]]
- [[_COMMUNITY_Stage Engine|Stage Engine]]
- [[_COMMUNITY_Project Lifecycle|Project Lifecycle]]
- [[_COMMUNITY_SVG to Canvas Rendering|SVG to Canvas Rendering]]
- [[_COMMUNITY_Web Interface Bridge|Web Interface Bridge]]
- [[_COMMUNITY_Block Palette|Block Palette]]
- [[_COMMUNITY_Block & Sprite Interaction Layer|Block & Sprite Interaction Layer]]
- [[_COMMUNITY_ScratchJr App Core|ScratchJr App Core]]
- [[_COMMUNITY_Onboarding & Paint Bridge|Onboarding & Paint Bridge]]
- [[_COMMUNITY_Scripts Pane Blocks|Scripts Pane Blocks]]
- [[_COMMUNITY_Execution Engine Core|Execution Engine Core]]
- [[_COMMUNITY_Vector Path Editing|Vector Path Editing]]
- [[_COMMUNITY_Block Connection Logic|Block Connection Logic]]
- [[_COMMUNITY_Asset Library UI|Asset Library UI]]
- [[_COMMUNITY_Paint Editor Core|Paint Editor Core]]
- [[_COMMUNITY_IO Persistence Layer|IO Persistence Layer]]
- [[_COMMUNITY_Home Lobby Events|Home Lobby Events]]
- [[_COMMUNITY_Ghost Outline Tool|Ghost Outline Tool]]
- [[_COMMUNITY_Stage & Scripts UI Layer|Stage & Scripts UI Layer]]
- [[_COMMUNITY_PageSprite Thumbnails|Page/Sprite Thumbnails]]
- [[_COMMUNITY_SVG Transform Matrix|SVG Transform Matrix]]
- [[_COMMUNITY_Snap.svg Library (vendored)|Snap.svg Library (vendored)]]
- [[_COMMUNITY_SoundVideo Recording UI|Sound/Video Recording UI]]
- [[_COMMUNITY_Scripts Pane & Stage UI|Scripts Pane & Stage UI]]
- [[_COMMUNITY_Input Event Handling|Input Event Handling]]
- [[_COMMUNITY_Paint Layer Management|Paint Layer Management]]
- [[_COMMUNITY_IO Persistence Layer|IO Persistence Layer]]
- [[_COMMUNITY_UndoRedo Stack|Undo/Redo Stack]]
- [[_COMMUNITY_Scripts Pane & Stage UI|Scripts Pane & Stage UI]]
- [[_COMMUNITY_Editor Entry & Mission Flow|Editor Entry & Mission Flow]]
- [[_COMMUNITY_Stage Grid Overlay|Stage Grid Overlay]]
- [[_COMMUNITY_Editor Entry & Mission Flow|Editor Entry & Mission Flow]]
- [[_COMMUNITY_Path Edit Mode|Path Edit Mode]]
- [[_COMMUNITY_Web Interface Bridge|Web Interface Bridge]]
- [[_COMMUNITY_Page Engine|Page Engine]]
- [[_COMMUNITY_Mission Authoring Button|Mission Authoring Button]]
- [[_COMMUNITY_Argument Editing State|Argument Editing State]]
- [[_COMMUNITY_Block Spec Catalog (Core)|Block Spec Catalog (Core)]]
- [[_COMMUNITY_Paint Canvas Positioning|Paint Canvas Positioning]]
- [[_COMMUNITY_Block & Alert Drawing Utils|Block & Alert Drawing Utils]]
- [[_COMMUNITY_Paint Page Navigation|Paint Page Navigation]]
- [[_COMMUNITY_2D Matrix Math|2D Matrix Math]]
- [[_COMMUNITY_Media Library Catalog|Media Library Catalog]]
- [[_COMMUNITY_Camera Capture|Camera Capture]]
- [[_COMMUNITY_Camera Capture|Camera Capture]]
- [[_COMMUNITY_Sample Projects List|Sample Projects List]]
- [[_COMMUNITY_Time Tracking|Time Tracking]]
- [[_COMMUNITY_JSZip Shim|JSZip Shim]]
- [[_COMMUNITY_Mission Notification Bell|Mission Notification Bell]]
- [[_COMMUNITY_PNG Render Cache|PNG Render Cache]]
- [[_COMMUNITY_Node Stream Shim|Node Stream Shim]]
- [[_COMMUNITY_SVG Path Drawing Util|SVG Path Drawing Util]]
- [[_COMMUNITY_Player Mode Patches|Player Mode Patches]]
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
- 5-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 5-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 5-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`

## Communities (86 total, 44 thin omitted)

### Community 0 - "Live Mirror Sync"
Cohesion: 0.06
Nodes (66): applyHoverTarget(), applyPageList(), applyStageState(), applyUiState(), buildMirrorPayload(), fakeTouchEvent(), _findHoverElement(), hideLockOverlay() (+58 more)

### Community 2 - "ScratchJr Core State"
Cohesion: 0.06
Nodes (4): hopList, Prims, Runtime, Thread

### Community 8 - "Mission Progress Badge"
Cohesion: 0.08
Nodes (16): apiFetch(), AssignmentBadge, authHeader(), dismissedHintIds, CARET_TYPES, compareManifests(), computeProjectManifest(), DATA_REPRESENTATION_TYPES (+8 more)

### Community 12 - "Web Interface Bridge"
Cohesion: 0.12
Nodes (15): fontcolors, fontsizes, getshapes, loadassets, sendshapes, speeds, Menu, Alert (+7 more)

### Community 16 - "Onboarding & Paint Bridge"
Cohesion: 0.09
Nodes (25): buffer, css_vh(), css_vw(), CSSTransition(), drawScaled(), drawThumbnail(), ensureEditorFrames(), fitInRect() (+17 more)

### Community 21 - "Asset Library UI"
Cohesion: 0.13
Nodes (8): homeMain(), homeStrings(), inappAbout(), inappBlocksGuide(), inappInterfaceGuide(), inappPaintEditorGuide(), Lobby, gn()

### Community 23 - "IO Persistence Layer"
Cohesion: 0.12
Nodes (19): onBackButtonCallback, applyScratchJrPlayerPatches(), workingCanvas, workingCanvas2, applyPagePlayerPatches(), applySpritePlayerPatches(), applyStagePlayerPatches(), EMOJIS (+11 more)

### Community 27 - "Page/Sprite Thumbnails"
Cohesion: 0.16
Nodes (16): maskCanvas, maskData, offscreen, targetOffscreen, cmdForClick, cmdForMouseDown, cmdForMouseMove, cmdForMouseUp (+8 more)

### Community 29 - "Snap.svg Library (vendored)"
Cohesion: 0.32
Nodes (26): a(), b(), c(), d(), e(), f(), g(), h() (+18 more)

### Community 31 - "Scripts Pane & Stage UI"
Cohesion: 0.13
Nodes (4): ScriptsPane, hit3DRect(), localx(), localy()

### Community 36 - "Scripts Pane & Stage UI"
Cohesion: 0.17
Nodes (6): pinchcenter, getDocumentHeight(), getDocumentWidth(), newHTML(), newImage(), newTextInput()

### Community 37 - "Editor Entry & Mission Flow"
Cohesion: 0.12
Nodes (10): gettingStartedMain(), indexFirstTime(), indexLoadOptions(), indexLoadStart(), indexLoadUsage(), indexMain(), indexSetUsage(), setClassOfElementById() (+2 more)

### Community 38 - "Stage Grid Overlay"
Cohesion: 0.09
Nodes (3): SnapElement, SnapPaper, SnapShim

### Community 39 - "Editor Entry & Mission Flow"
Cohesion: 0.19
Nodes (7): apiFetch(), AssignmentAuthorBar, authHeader(), decodeJwtPayloadUnsafe(), getAuthorId(), HINT_WHEN_LABELS, isAllowedReturnUrl()

### Community 41 - "Path Edit Mode"
Cohesion: 0.20
Nodes (3): Grid, newDiv(), newP()

### Community 43 - "Page Engine"
Cohesion: 0.20
Nodes (4): keys, Cookie, Localization, localizationMessages

### Community 70 - "Mission Notification Bell"
Cohesion: 0.52
Nodes (3): apiFetch(), AssignmentNotice, authHeader()

### Community 74 - "Node Stream Shim"
Cohesion: 0.29
Nodes (3): Readable, Transform, Writable

## Knowledge Gaps
- **50 isolated node(s):** `loadassets`, `fontcolors`, `fontsizes`, `getshapes`, `sendshapes` (+45 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **44 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `gn()` connect `Asset Library UI` to `Live Mirror Sync`, `Paint Action History`, `ScratchJr Core State`, `Editor UI Core`, `iOS Platform Bridge`, `Stage Engine`, `Web Interface Bridge`, `Onboarding & Paint Bridge`, `Execution Engine Core`, `Vector Path Editing`, `Paint Editor Core`, `IO Persistence Layer`, `Home Lobby Events`, `Page/Sprite Thumbnails`, `SVG Transform Matrix`, `Sound/Video Recording UI`, `Scripts Pane & Stage UI`, `Input Event Handling`, `Paint Layer Management`, `Undo/Redo Stack`, `Scripts Pane & Stage UI`, `Editor Entry & Mission Flow`, `Snap.svg Shim`, `Path Edit Mode`, `Page Engine`, `Rectangle Geometry`, `Paint Canvas Positioning`, `Paint Page Navigation`, `Bezier Curve Drawing`, `Camera Capture`, `Sample Projects List`, `Mission Notification Bell`, `Path Point Manipulation`, `Paint Side Palette`, `Vector Path Editing`?**
  _High betweenness centrality (0.244) - this node is a cross-community bridge._
- **Why does `ScratchJr` connect `ScratchJr App Core` to `App Boot Sequence`, `ScratchJr Core State`, `Scripts Pane & Stage UI`, `Path Edit Mode`, `Web Interface Bridge`, `Scroll/Pan Control`, `Selection State`, `Fullscreen Control`, `Numeric Keypad Input`, `Onboarding & Paint Bridge`, `IO Persistence Layer`, `Page/Sprite Thumbnails`, `Scripts Pane & Stage UI`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **Why does `newHTML()` connect `Scripts Pane & Stage UI` to `Live Mirror Sync`, `Editor UI Core`, `Mission Progress Badge`, `Web Interface Bridge`, `Onboarding & Paint Bridge`, `Execution Engine Core`, `Asset Library UI`, `Paint Editor Core`, `IO Persistence Layer`, `Page/Sprite Thumbnails`, `Sound/Video Recording UI`, `Scripts Pane & Stage UI`, `Undo/Redo Stack`, `Editor Entry & Mission Flow`, `Path Edit Mode`, `Web Interface Bridge`, `Page Engine`, `Mission Authoring Button`, `Paint Page Navigation`, `Sample Projects List`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **What connects `loadassets`, `fontcolors`, `fontsizes` to the rest of the system?**
  _50 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Live Mirror Sync` be split into smaller, more focused modules?**
  _Cohesion score 0.06126126126126126 - nodes in this community are weakly interconnected._
- **Should `Paint Action History` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._
- **Should `ScratchJr Core State` be split into smaller, more focused modules?**
  _Cohesion score 0.05764145954521417 - nodes in this community are weakly interconnected._