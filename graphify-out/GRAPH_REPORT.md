# Graph Report - .  (2026-09-01)

## Corpus Check
- 2 files · ~110,371 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1933 nodes · 4340 edges · 88 communities (42 shown, 46 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Live Mirror Sync|Live Mirror Sync]]
- [[_COMMUNITY_Paint Action History|Paint Action History]]
- [[_COMMUNITY_Sprite Engine|Sprite Engine]]
- [[_COMMUNITY_Editor UI Core|Editor UI Core]]
- [[_COMMUNITY_Web Interface Bridge|Web Interface Bridge]]
- [[_COMMUNITY_SVG Drawing Tools|SVG Drawing Tools]]
- [[_COMMUNITY_Lobby & Media Bridge|Lobby & Media Bridge]]
- [[_COMMUNITY_Mission Progress Badge|Mission Progress Badge]]
- [[_COMMUNITY_iOS Platform Bridge|iOS Platform Bridge]]
- [[_COMMUNITY_Project Lifecycle|Project Lifecycle]]
- [[_COMMUNITY_IO Persistence Layer|IO Persistence Layer]]
- [[_COMMUNITY_SVG to Canvas Rendering|SVG to Canvas Rendering]]
- [[_COMMUNITY_Scripts Pane & Stage UI|Scripts Pane & Stage UI]]
- [[_COMMUNITY_Onboarding & Paint Bridge|Onboarding & Paint Bridge]]
- [[_COMMUNITY_Asset Library UI|Asset Library UI]]
- [[_COMMUNITY_Block Palette|Block Palette]]
- [[_COMMUNITY_Block & Sprite Interaction Layer|Block & Sprite Interaction Layer]]
- [[_COMMUNITY_Stage Engine|Stage Engine]]
- [[_COMMUNITY_Scripts Pane Blocks|Scripts Pane Blocks]]
- [[_COMMUNITY_ScratchJr App Core|ScratchJr App Core]]
- [[_COMMUNITY_ScratchJr Core State|ScratchJr Core State]]
- [[_COMMUNITY_Execution Engine Core|Execution Engine Core]]
- [[_COMMUNITY_PageSprite Thumbnails|Page/Sprite Thumbnails]]
- [[_COMMUNITY_Block Connection Logic|Block Connection Logic]]
- [[_COMMUNITY_Ghost Outline Tool|Ghost Outline Tool]]
- [[_COMMUNITY_Home Lobby Events|Home Lobby Events]]
- [[_COMMUNITY_Paint Editor Core|Paint Editor Core]]
- [[_COMMUNITY_Vector Path Editing|Vector Path Editing]]
- [[_COMMUNITY_Page Engine|Page Engine]]
- [[_COMMUNITY_Stage & Scripts UI Layer|Stage & Scripts UI Layer]]
- [[_COMMUNITY_SVG Transform Matrix|SVG Transform Matrix]]
- [[_COMMUNITY_Snap.svg Library (vendored)|Snap.svg Library (vendored)]]
- [[_COMMUNITY_SoundVideo Recording UI|Sound/Video Recording UI]]
- [[_COMMUNITY_Input Event Handling|Input Event Handling]]
- [[_COMMUNITY_Paint Layer Management|Paint Layer Management]]
- [[_COMMUNITY_UndoRedo Stack|Undo/Redo Stack]]
- [[_COMMUNITY_Stage Grid Overlay|Stage Grid Overlay]]
- [[_COMMUNITY_Path Background Cropping|Path Background Cropping]]
- [[_COMMUNITY_Block & Alert Drawing Utils|Block & Alert Drawing Utils]]
- [[_COMMUNITY_Mission Authoring Button|Mission Authoring Button]]
- [[_COMMUNITY_Argument Editing State|Argument Editing State]]
- [[_COMMUNITY_Path Edit Mode|Path Edit Mode]]
- [[_COMMUNITY_Block Spec Catalog (Core)|Block Spec Catalog (Core)]]
- [[_COMMUNITY_Execution Engine Core|Execution Engine Core]]
- [[_COMMUNITY_Editor Entry Boot|Editor Entry Boot]]
- [[_COMMUNITY_Paint Page Navigation|Paint Page Navigation]]
- [[_COMMUNITY_Paint Canvas Positioning|Paint Canvas Positioning]]
- [[_COMMUNITY_Paint Grid Overlay|Paint Grid Overlay]]
- [[_COMMUNITY_SVG Image Element|SVG Image Element]]
- [[_COMMUNITY_2D Matrix Math|2D Matrix Math]]
- [[_COMMUNITY_Camera Capture|Camera Capture]]
- [[_COMMUNITY_Sample Projects List|Sample Projects List]]
- [[_COMMUNITY_Execution Engine Core|Execution Engine Core]]
- [[_COMMUNITY_JSZip Shim|JSZip Shim]]
- [[_COMMUNITY_Mission Notification Bell|Mission Notification Bell]]
- [[_COMMUNITY_Paint Side Palette|Paint Side Palette]]
- [[_COMMUNITY_PNG Render Cache|PNG Render Cache]]
- [[_COMMUNITY_Node Stream Shim|Node Stream Shim]]
- [[_COMMUNITY_Editor Entry Boot|Editor Entry Boot]]
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
- `homeMain()` --calls--> `gn()`  [EXTRACTED]
  src/app/src/entry/home.js → src/app/src/utils/lib.js
- `homeStrings()` --calls--> `gn()`  [EXTRACTED]
  src/app/src/entry/home.js → src/app/src/utils/lib.js
- `inappAbout()` --calls--> `gn()`  [EXTRACTED]
  src/app/src/entry/inapp.js → src/app/src/utils/lib.js
- `inappInterfaceGuide()` --calls--> `gn()`  [EXTRACTED]
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

## Communities (88 total, 46 thin omitted)

### Community 0 - "Live Mirror Sync"
Cohesion: 0.06
Nodes (66): applyHoverTarget(), applyPageList(), applyStageState(), applyUiState(), buildMirrorPayload(), fakeTouchEvent(), _findHoverElement(), hideLockOverlay() (+58 more)

### Community 3 - "Editor UI Core"
Cohesion: 0.06
Nodes (3): UI, newHTML(), newTextInput()

### Community 4 - "Web Interface Bridge"
Cohesion: 0.09
Nodes (12): BlockArg, Menu, Alert, getStringSize(), globalx(), globaly(), newCanvas(), newDiv() (+4 more)

### Community 7 - "Mission Progress Badge"
Cohesion: 0.08
Nodes (16): apiFetch(), AssignmentBadge, authHeader(), dismissedHintIds, CARET_TYPES, compareManifests(), computeProjectManifest(), DATA_REPRESENTATION_TYPES (+8 more)

### Community 10 - "IO Persistence Layer"
Cohesion: 0.08
Nodes (11): applyScratchJrPlayerPatches(), applyPagePlayerPatches(), applySpritePlayerPatches(), applyStagePlayerPatches(), EMOJIS, LABELS, playerMain(), _prefetchMedia() (+3 more)

### Community 12 - "Scripts Pane & Stage UI"
Cohesion: 0.10
Nodes (7): ScriptsPane, pinchcenter, getDocumentHeight(), getDocumentWidth(), hit3DRect(), localx(), localy()

### Community 13 - "Onboarding & Paint Bridge"
Cohesion: 0.08
Nodes (27): buffer, css_vh(), css_vw(), CSSTransition(), drawScaled(), drawThumbnail(), ensureEditorFrames(), fitInRect() (+19 more)

### Community 14 - "Asset Library UI"
Cohesion: 0.10
Nodes (10): gettingStartedMain(), inappAbout(), inappBlocksGuide(), inappInterfaceGuide(), inappPaintEditorGuide(), Lobby, getIdFor(), getUrlVars() (+2 more)

### Community 22 - "Page/Sprite Thumbnails"
Cohesion: 0.12
Nodes (22): onBackButtonCallback, workingCanvas, workingCanvas2, maskCanvas, maskData, offscreen, targetOffscreen, deltaPoint (+14 more)

### Community 28 - "Page Engine"
Cohesion: 0.11
Nodes (12): fontcolors, fontsizes, getshapes, loadassets, sendshapes, speeds, homeMain(), homeStrings() (+4 more)

### Community 31 - "Snap.svg Library (vendored)"
Cohesion: 0.32
Nodes (26): a(), b(), c(), d(), e(), f(), g(), h() (+18 more)

### Community 36 - "Stage Grid Overlay"
Cohesion: 0.09
Nodes (3): SnapElement, SnapPaper, SnapShim

### Community 38 - "Path Background Cropping"
Cohesion: 0.21
Nodes (8): apiFetch(), AssignmentAuthorBar, authHeader(), decodeJwtPayloadUnsafe(), getAuthorId(), HINT_WHEN_LABELS, hintWhenLabel(), isAllowedReturnUrl()

### Community 49 - "Editor Entry Boot"
Cohesion: 0.23
Nodes (7): indexFirstTime(), indexLoadOptions(), indexLoadStart(), indexLoadUsage(), indexMain(), indexSetUsage(), setClassOfElementById()

### Community 70 - "Paint Side Palette"
Cohesion: 0.52
Nodes (3): apiFetch(), AssignmentNotice, authHeader()

### Community 73 - "Node Stream Shim"
Cohesion: 0.29
Nodes (3): Readable, Transform, Writable

## Knowledge Gaps
- **50 isolated node(s):** `loadassets`, `fontcolors`, `fontsizes`, `getshapes`, `sendshapes` (+45 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **46 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `gn()` connect `Asset Library UI` to `Live Mirror Sync`, `Paint Action History`, `Editor UI Core`, `Web Interface Bridge`, `iOS Platform Bridge`, `Scripts Pane & Stage UI`, `Onboarding & Paint Bridge`, `Stage Engine`, `ScratchJr Core State`, `Execution Engine Core`, `Page/Sprite Thumbnails`, `Home Lobby Events`, `Vector Path Editing`, `Page Engine`, `SVG Transform Matrix`, `Sound/Video Recording UI`, `Input Event Handling`, `Paint Layer Management`, `Undo/Redo Stack`, `Snap.svg Shim`, `Block & Alert Drawing Utils`, `Rectangle Geometry`, `Bezier Curve Drawing`, `Path Edit Mode`, `Editor Entry Boot`, `Paint Page Navigation`, `Paint Side Palette`, `Paint Canvas Positioning`, `2D Matrix Math`, `Sample Projects List`, `Paint Side Palette`, `Path Point Manipulation`?**
  _High betweenness centrality (0.244) - this node is a cross-community bridge._
- **Why does `ScratchJr` connect `ScratchJr App Core` to `App Boot Sequence`, `Web Interface Bridge`, `Block & Alert Drawing Utils`, `Scroll/Pan Control`, `IO Persistence Layer`, `Selection State`, `Scripts Pane & Stage UI`, `Onboarding & Paint Bridge`, `Fullscreen Control`, `Numeric Keypad Input`, `Page/Sprite Thumbnails`, `Page Engine`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **Why does `Paint` connect `Block Connection Logic` to `Time Tracking`, `Web Interface Bridge`, `IO Persistence Layer`, `Scripts Pane & Stage UI`, `Paint Gesture Detection`, `2D Vector Math`, `Paint Undo Buffer`, `Page/Sprite Thumbnails`, `Canvas Drawing Primitives`, `Canvas Draw Commands`, `Home Lobby Entry`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **What connects `loadassets`, `fontcolors`, `fontsizes` to the rest of the system?**
  _50 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Live Mirror Sync` be split into smaller, more focused modules?**
  _Cohesion score 0.06126126126126126 - nodes in this community are weakly interconnected._
- **Should `Paint Action History` be split into smaller, more focused modules?**
  _Cohesion score 0.05970149253731343 - nodes in this community are weakly interconnected._
- **Should `Sprite Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.07175141242937853 - nodes in this community are weakly interconnected._