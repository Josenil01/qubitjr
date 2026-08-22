# Graph Report - .  (2026-08-22)

## Corpus Check
- 5 files · ~102,084 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1885 nodes · 4452 edges · 81 communities (34 shown, 47 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Live Session Observation|Live Session Observation]]
- [[_COMMUNITY_Paint Editor Actions|Paint Editor Actions]]
- [[_COMMUNITY_UI Layout|UI Layout]]
- [[_COMMUNITY_SVG Tools|SVG Tools]]
- [[_COMMUNITY_iOS Native Bridge|iOS Native Bridge]]
- [[_COMMUNITY_App Entry & Assignment UI BarBadge|App Entry & Assignment UI Bar/Badge]]
- [[_COMMUNITY_Core Utils & App State|Core Utils & App State]]
- [[_COMMUNITY_Stage|Stage]]
- [[_COMMUNITY_Asset Library|Asset Library]]
- [[_COMMUNITY_Core Editor Engine & iPad Bridge|Core Editor Engine & iPad Bridge]]
- [[_COMMUNITY_Player Runtime & IO|Player Runtime & IO]]
- [[_COMMUNITY_Block Connection|Block Connection]]
- [[_COMMUNITY_Project UI (Pages & Thumbnails)|Project UI (Pages & Thumbnails)]]
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
- [[_COMMUNITY_iPad IO Bridge (IO.js)|iPad IO Bridge (IO.js)]]
- [[_COMMUNITY_Getting Started  Index|Getting Started / Index]]
- [[_COMMUNITY_Block Argument Editing|Block Argument Editing]]
- [[_COMMUNITY_ScriptsPane|ScriptsPane]]
- [[_COMMUNITY_IO Asset Loading|IO Asset Loading]]
- [[_COMMUNITY_Scroll|Scroll]]
- [[_COMMUNITY_closeNumberEdit|closeNumberEdit]]
- [[_COMMUNITY_chopSection|chopSection]]
- [[_COMMUNITY_Runtime|Runtime]]
- [[_COMMUNITY_addToBkgLib|addToBkgLib]]
- [[_COMMUNITY_Vector Math|Vector Math]]
- [[_COMMUNITY_PaintUndo|PaintUndo]]
- [[_COMMUNITY_closePath|closePath]]
- [[_COMMUNITY_adjustPos|adjustPos]]
- [[_COMMUNITY_SVGImage|SVGImage]]
- [[_COMMUNITY_Camera|Camera]]
- [[_COMMUNITY_Audio Playback|Audio Playback]]
- [[_COMMUNITY_appinit|appinit]]
- [[_COMMUNITY_iOS Native Bridge|iOS Native Bridge]]
- [[_COMMUNITY_Block & Page Drag|Block & Page Drag]]
- [[_COMMUNITY_adjustShapePosition|adjustShapePosition]]
- [[_COMMUNITY_addImageUrl|addImageUrl]]
- [[_COMMUNITY_Block Specs Assets|Block Specs Assets]]
- [[_COMMUNITY_addPoints|addPoints]]
- [[_COMMUNITY_Project Naming & Sharing|Project Naming & Sharing]]

## God Nodes (most connected - your core abstractions)
1. `gn()` - 287 edges
2. `Paint` - 115 edges
3. `ScratchJr` - 100 edges
4. `newHTML()` - 90 edges
5. `SVG2Canvas` - 81 edges
6. `PaintAction` - 72 edges
7. `UI` - 66 edges
8. `Sprite` - 62 edges
9. `iOS` - 61 edges
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
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js`
- 3-file cycle: `src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js`
- 3-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 3-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 3-file cycle: `src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Layer.js`
- 3-file cycle: `src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ui/UI.js -> src/app/src/editor/ui/ScriptsPane.js`
- 3-file cycle: `src/app/src/editor/ui/Palette.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ui/Palette.js`
- 4-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js -> src/app/src/editor/ScratchJr.js`
- 4-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Layer.js -> src/app/src/editor/ScratchJr.js`
- 4-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/editor/ScratchJr.js`
- 4-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Path.js -> src/app/src/editor/ScratchJr.js`
- 4-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/painteditor/Path.js -> src/app/src/editor/ScratchJr.js`
- 4-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js -> src/app/src/editor/ScratchJr.js`
- 4-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`

## Communities (81 total, 47 thin omitted)

### Community 0 - "Live Session Observation"
Cohesion: 0.07
Nodes (65): applyHoverTarget(), applyPageList(), applyStageState(), applyUiState(), buildMirrorPayload(), fakeTouchEvent(), _findHoverElement(), hideLockOverlay() (+57 more)

### Community 5 - "App Entry & Assignment UI Bar/Badge"
Cohesion: 0.07
Nodes (17): gettingStartedMain(), indexFirstTime(), indexLoadOptions(), indexLoadStart(), indexLoadUsage(), indexMain(), indexSetUsage(), setClassOfElementById() (+9 more)

### Community 7 - "Stage"
Cohesion: 0.06
Nodes (3): UI, css_vh(), getViewportHeight()

### Community 9 - "Core Editor Engine & iPad Bridge"
Cohesion: 0.07
Nodes (27): fontcolors, fontsizes, getshapes, loadassets, sendshapes, speeds, onBackButtonCallback, applyScratchJrPlayerPatches() (+19 more)

### Community 10 - "Player Runtime & IO"
Cohesion: 0.10
Nodes (20): Vector, maskCanvas, maskData, offscreen, targetOffscreen, deltaPoint, initialPoint, pensizes (+12 more)

### Community 14 - "Path Geometry"
Cohesion: 0.10
Nodes (24): pinchcenter, colorToRGBA(), css_vw(), CSSTransition(), ensureEditorFrames(), getDocumentHeight(), getDocumentWidth(), getHex() (+16 more)

### Community 27 - "Drag & Drop Events"
Cohesion: 0.17
Nodes (8): Menu, Alert, drawScaled(), getStringSize(), globalx(), globaly(), newCanvas(), writeText()

### Community 29 - "Home / Events"
Cohesion: 0.32
Nodes (26): a(), b(), c(), d(), e(), f(), g(), h() (+18 more)

### Community 34 - "atEdge"
Cohesion: 0.18
Nodes (6): inappAbout(), inappBlocksGuide(), inappInterfaceGuide(), inappPaintEditorGuide(), Lobby, gn()

### Community 37 - "Block Argument Editing"
Cohesion: 0.19
Nodes (5): hopList, Grid, newDiv(), newP(), setProps()

### Community 38 - "ScriptsPane"
Cohesion: 0.09
Nodes (3): SnapElement, SnapPaper, SnapShim

### Community 39 - "IO Asset Loading"
Cohesion: 0.16
Nodes (6): homeMain(), homeStrings(), keys, Cookie, Localization, localizationMessages

### Community 70 - "Block Specs Assets"
Cohesion: 0.29
Nodes (3): Readable, Transform, Writable

## Knowledge Gaps
- **43 isolated node(s):** `workingCanvas`, `workingCanvas2`, `onBackButtonCallback`, `loadassets`, `fontcolors` (+38 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **47 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `gn()` connect `atEdge` to `Live Session Observation`, `Paint Editor Actions`, `UI Layout`, `App Entry & Assignment UI Bar/Badge`, `Core Utils & App State`, `Stage`, `Asset Library`, `Core Editor Engine & iPad Bridge`, `Player Runtime & IO`, `Block Connection`, `Path Geometry`, `SVG-to-Canvas`, `Sprite & Page UI Actions`, `Paint Controller`, `Ghost Layer`, `Scripts (block layout)`, `Primitive Commands`, `Transform Matrix`, `Drag & Drop Events`, `Paint Layers`, `Page Model`, `Runtime & Grid`, `Undo`, `Alert Balloon & Menus`, `Getting Started / Index`, `Block Argument Editing`, `IO Asset Loading`, `In-app Guides`, `Scroll`, `arrayToString`, `Rectangle`, `Editor & Paint Panel Layout`, `BlockSpecs`, `Vector Math`, `PaintUndo`, `deleteDot`, `Text Color & Size Menu`, `adjustPos`, `Matrix.js`, `Audio Playback`, `adjustShapePosition`, `Thread`, `Paint Editor Panels`, `Sound`?**
  _High betweenness centrality (0.300) - this node is a cross-community bridge._
- **Why does `newHTML()` connect `Undo` to `Live Session Observation`, `App Entry & Assignment UI Bar/Badge`, `Stage`, `Core Editor Engine & iPad Bridge`, `Player Runtime & IO`, `Block Connection`, `Path Geometry`, `SVG-to-Canvas`, `Ghost Layer`, `Scripts (block layout)`, `Transform Matrix`, `Snap.svg Library`, `Drag & Drop Events`, `Page Model`, `atEdge`, `Getting Started / Index`, `IO Asset Loading`, `closeNumberEdit`, `PaintUndo`, `Matrix.js`, `Audio Playback`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **Why does `Path` connect `Primitive Commands` to `Paint Editor Panels`, `In-app Guides`, `PNGCache.js`, `Player Runtime & IO`, `Editor & Paint Panel Layout`, `BlockSpecs`, `Text Color & Size Menu`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **What connects `workingCanvas`, `workingCanvas2`, `onBackButtonCallback` to the rest of the system?**
  _43 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Live Session Observation` be split into smaller, more focused modules?**
  _Cohesion score 0.07039573820395738 - nodes in this community are weakly interconnected._
- **Should `Paint Editor Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.05271629778672032 - nodes in this community are weakly interconnected._
- **Should `UI Layout` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._