# Graph Report - .  (2026-08-19)

## Corpus Check
- 9 files · ~99,926 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1860 nodes · 4440 edges · 84 communities (40 shown, 44 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Live Session Observation|Live Session Observation]]
- [[_COMMUNITY_Paint Editor Actions|Paint Editor Actions]]
- [[_COMMUNITY_UI Layout|UI Layout]]
- [[_COMMUNITY_SVG Tools|SVG Tools]]
- [[_COMMUNITY_iOS Native Bridge|iOS Native Bridge]]
- [[_COMMUNITY_Web Interface  Bridge|Web Interface / Bridge]]
- [[_COMMUNITY_Core Utils & App State|Core Utils & App State]]
- [[_COMMUNITY_Stage|Stage]]
- [[_COMMUNITY_Asset Library|Asset Library]]
- [[_COMMUNITY_UI Layout & Drag Helpers|UI Layout & Drag Helpers]]
- [[_COMMUNITY_Player Runtime & IO|Player Runtime & IO]]
- [[_COMMUNITY_Block Connection|Block Connection]]
- [[_COMMUNITY_Thumbnails  Pages UI|Thumbnails / Pages UI]]
- [[_COMMUNITY_Editor Core Modules|Editor Core Modules]]
- [[_COMMUNITY_Path Geometry|Path Geometry]]
- [[_COMMUNITY_Home  IO  MediaLib|Home / IO / MediaLib]]
- [[_COMMUNITY_Paint Editor Core|Paint Editor Core]]
- [[_COMMUNITY_SVG-to-Canvas|SVG-to-Canvas]]
- [[_COMMUNITY_Sprite & Page UI Actions|Sprite & Page UI Actions]]
- [[_COMMUNITY_Paint Controller|Paint Controller]]
- [[_COMMUNITY_Ghost Layer|Ghost Layer]]
- [[_COMMUNITY_Scripts (block layout)|Scripts (block layout)]]
- [[_COMMUNITY_BlockArg  Menu|BlockArg / Menu]]
- [[_COMMUNITY_Primitive Commands|Primitive Commands]]
- [[_COMMUNITY_Block Palette|Block Palette]]
- [[_COMMUNITY_Transform Matrix|Transform Matrix]]
- [[_COMMUNITY_Snap.svg Library|Snap.svg Library]]
- [[_COMMUNITY_Drag & Drop Events|Drag & Drop Events]]
- [[_COMMUNITY_Paint Layers|Paint Layers]]
- [[_COMMUNITY_Home  Events|Home / Events]]
- [[_COMMUNITY_Page Model|Page Model]]
- [[_COMMUNITY_Runtime & Grid|Runtime & Grid]]
- [[_COMMUNITY_Undo|Undo]]
- [[_COMMUNITY_Alert Balloon & Menus|Alert Balloon & Menus]]
- [[_COMMUNITY_atEdge|atEdge]]
- [[_COMMUNITY_snapsvg.js|snapsvg.js]]
- [[_COMMUNITY_Block Argument Editing|Block Argument Editing]]
- [[_COMMUNITY_ScriptsPane|ScriptsPane]]
- [[_COMMUNITY_IO Asset Loading|IO Asset Loading]]
- [[_COMMUNITY_In-app Guides|In-app Guides]]
- [[_COMMUNITY_Scroll|Scroll]]
- [[_COMMUNITY_closeNumberEdit|closeNumberEdit]]
- [[_COMMUNITY_chopSection|chopSection]]
- [[_COMMUNITY_Runtime|Runtime]]
- [[_COMMUNITY_addToBkgLib|addToBkgLib]]
- [[_COMMUNITY_PaintUndo|PaintUndo]]
- [[_COMMUNITY_clearWorkspace|clearWorkspace]]
- [[_COMMUNITY_SVGImage|SVGImage]]
- [[_COMMUNITY_Matrix.js|Matrix.js]]
- [[_COMMUNITY_ScratchJr App State Control|ScratchJr App State Control]]
- [[_COMMUNITY_Audio Playback|Audio Playback]]
- [[_COMMUNITY_iOS Native Bridge|iOS Native Bridge]]
- [[_COMMUNITY_Block & Page Drag|Block & Page Drag]]
- [[_COMMUNITY_Thread|Thread]]
- [[_COMMUNITY_Block Specs Assets|Block Specs Assets]]
- [[_COMMUNITY_addPoints|addPoints]]
- [[_COMMUNITY_Project Naming & Sharing|Project Naming & Sharing]]
- [[_COMMUNITY_PNGCache.js|PNGCache.js]]
- [[_COMMUNITY_IO Asset Loading|IO Asset Loading]]

## God Nodes (most connected - your core abstractions)
1. `gn()` - 297 edges
2. `Paint` - 116 edges
3. `ScratchJr` - 101 edges
4. `newHTML()` - 90 edges
5. `SVG2Canvas` - 82 edges
6. `PaintAction` - 72 edges
7. `UI` - 67 edges
8. `Sprite` - 63 edges
9. `iOS` - 62 edges
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
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/editor/ui/Palette.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ui/Palette.js`
- 3-file cycle: `src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ui/UI.js -> src/app/src/editor/ui/ScriptsPane.js`
- 4-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/editor/ui/Project.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/editor/ScratchJr.js`
- 4-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js -> src/app/src/editor/ScratchJr.js`
- 4-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 4-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 4-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 4-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Layer.js -> src/app/src/editor/ScratchJr.js`
- 4-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`

## Communities (84 total, 44 thin omitted)

### Community 0 - "Live Session Observation"
Cohesion: 0.06
Nodes (67): applyHoverTarget(), applyPageList(), applyStageState(), applyUiState(), buildMirrorPayload(), fakeTouchEvent(), _findHoverElement(), hideLockOverlay() (+59 more)

### Community 4 - "iOS Native Bridge"
Cohesion: 0.06
Nodes (3): UI, css_vh(), getViewportHeight()

### Community 6 - "Core Utils & App State"
Cohesion: 0.07
Nodes (32): fontcolors, fontsizes, getshapes, loadassets, sendshapes, speeds, onBackButtonCallback, workingCanvas (+24 more)

### Community 8 - "Asset Library"
Cohesion: 0.10
Nodes (20): Vector, maskCanvas, maskData, offscreen, targetOffscreen, deltaPoint, initialPoint, pensizes (+12 more)

### Community 9 - "UI Layout & Drag Helpers"
Cohesion: 0.11
Nodes (13): pinchcenter, CSSTransition(), getDocumentHeight(), getDocumentWidth(), hit3DRect(), localx(), localy(), newForm() (+5 more)

### Community 18 - "Sprite & Page UI Actions"
Cohesion: 0.09
Nodes (3): Palette, drawScaled(), hitRect()

### Community 26 - "Snap.svg Library"
Cohesion: 0.32
Nodes (26): a(), b(), c(), d(), e(), f(), g(), h() (+18 more)

### Community 29 - "Home / Events"
Cohesion: 0.18
Nodes (6): inappAbout(), inappBlocksGuide(), inappInterfaceGuide(), inappPaintEditorGuide(), Lobby, gn()

### Community 33 - "Alert Balloon & Menus"
Cohesion: 0.19
Nodes (7): Menu, Alert, getStringSize(), globalx(), globaly(), newCanvas(), writeText()

### Community 34 - "atEdge"
Cohesion: 0.09
Nodes (3): SnapElement, SnapPaper, SnapShim

### Community 35 - "snapsvg.js"
Cohesion: 0.16
Nodes (6): homeMain(), homeStrings(), keys, Cookie, Localization, localizationMessages

### Community 38 - "ScriptsPane"
Cohesion: 0.21
Nodes (4): Grid, newDiv(), newP(), setCanvasSizeScaledToWindowDocumentHeight()

### Community 39 - "IO Asset Loading"
Cohesion: 0.15
Nodes (8): indexFirstTime(), indexLoadOptions(), indexLoadStart(), indexLoadUsage(), indexMain(), indexSetUsage(), setClassOfElementById(), AppUsage

### Community 41 - "Scroll"
Cohesion: 0.22
Nodes (10): applyScratchJrPlayerPatches(), applyPagePlayerPatches(), applySpritePlayerPatches(), applyStagePlayerPatches(), EMOJIS, LABELS, playerMain(), _prefetchMedia() (+2 more)

### Community 71 - "addPoints"
Cohesion: 0.29
Nodes (3): Readable, Transform, Writable

## Knowledge Gaps
- **43 isolated node(s):** `workingCanvas`, `workingCanvas2`, `onBackButtonCallback`, `loadassets`, `fontcolors` (+38 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **44 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `gn()` connect `Home / Events` to `Live Session Observation`, `Paint Editor Actions`, `iOS Native Bridge`, `Web Interface / Bridge`, `Core Utils & App State`, `Stage`, `Asset Library`, `UI Layout & Drag Helpers`, `Player Runtime & IO`, `Block Connection`, `Editor Core Modules`, `Paint Editor Core`, `SVG-to-Canvas`, `Sprite & Page UI Actions`, `Paint Controller`, `Ghost Layer`, `Scripts (block layout)`, `Primitive Commands`, `Transform Matrix`, `Drag & Drop Events`, `Paint Layers`, `Page Model`, `Undo`, `Alert Balloon & Menus`, `snapsvg.js`, `Getting Started / Index`, `ScriptsPane`, `IO Asset Loading`, `In-app Guides`, `arrayToString`, `Rectangle`, `Editor & Paint Panel Layout`, `BlockSpecs`, `Vector Math`, `PaintUndo`, `clearWorkspace`, `Text Color & Size Menu`, `closePath`, `adjustPos`, `jszip.js`, `Matrix.js`, `iOS Native Bridge`, `adjustShapePosition`, `Paint Editor Panels`, `addImageUrl`, `Sound`, `addDot`, `IO Asset Loading`?**
  _High betweenness centrality (0.301) - this node is a cross-community bridge._
- **Why does `ScratchJr` connect `Paint Editor Core` to `Alert Balloon & Menus`, `Core Utils & App State`, `Asset Library`, `Scroll`, `arrayToString`, `Rectangle`, `addDot`, `Editor Frame Sizing`, `appinit`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Why does `Sprite` connect `UI Layout` to `Scroll`, `ScriptsPane`, `Core Utils & App State`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **What connects `workingCanvas`, `workingCanvas2`, `onBackButtonCallback` to the rest of the system?**
  _43 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Live Session Observation` be split into smaller, more focused modules?**
  _Cohesion score 0.05880665519219736 - nodes in this community are weakly interconnected._
- **Should `Paint Editor Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.060153776571687016 - nodes in this community are weakly interconnected._
- **Should `UI Layout` be split into smaller, more focused modules?**
  _Cohesion score 0.07175141242937853 - nodes in this community are weakly interconnected._