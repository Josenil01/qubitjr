# Graph Report - .  (2026-08-03)

## Corpus Check
- 17 files · ~91,395 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1815 nodes · 4421 edges · 85 communities (42 shown, 43 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_iOS Native Bridge|iOS Native Bridge]]
- [[_COMMUNITY_UI Layout|UI Layout]]
- [[_COMMUNITY_Paint Editor Actions|Paint Editor Actions]]
- [[_COMMUNITY_SVG Tools|SVG Tools]]
- [[_COMMUNITY_Web Interface  Bridge|Web Interface / Bridge]]
- [[_COMMUNITY_Core Utils & App State|Core Utils & App State]]
- [[_COMMUNITY_Stage|Stage]]
- [[_COMMUNITY_Editor Core Modules|Editor Core Modules]]
- [[_COMMUNITY_Player Runtime & IO|Player Runtime & IO]]
- [[_COMMUNITY_Live Session Observation|Live Session Observation]]
- [[_COMMUNITY_Block Connection|Block Connection]]
- [[_COMMUNITY_Thumbnails  Pages UI|Thumbnails / Pages UI]]
- [[_COMMUNITY_Paint Editor Core|Paint Editor Core]]
- [[_COMMUNITY_SVG-to-Canvas|SVG-to-Canvas]]
- [[_COMMUNITY_Sprite & Page UI Actions|Sprite & Page UI Actions]]
- [[_COMMUNITY_Home  IO  MediaLib|Home / IO / MediaLib]]
- [[_COMMUNITY_BlockArg  Menu|BlockArg / Menu]]
- [[_COMMUNITY_Path Geometry|Path Geometry]]
- [[_COMMUNITY_Asset Library|Asset Library]]
- [[_COMMUNITY_Paint Controller|Paint Controller]]
- [[_COMMUNITY_Scripts (block layout)|Scripts (block layout)]]
- [[_COMMUNITY_Ghost Layer|Ghost Layer]]
- [[_COMMUNITY_Home  Events|Home / Events]]
- [[_COMMUNITY_Primitive Commands|Primitive Commands]]
- [[_COMMUNITY_Block Palette|Block Palette]]
- [[_COMMUNITY_Transform Matrix|Transform Matrix]]
- [[_COMMUNITY_Snap.svg Library|Snap.svg Library]]
- [[_COMMUNITY_Drag & Drop Events|Drag & Drop Events]]
- [[_COMMUNITY_Paint Layers|Paint Layers]]
- [[_COMMUNITY_Page Model|Page Model]]
- [[_COMMUNITY_Runtime & Grid|Runtime & Grid]]
- [[_COMMUNITY_Undo|Undo]]
- [[_COMMUNITY_IO Asset Loading|IO Asset Loading]]
- [[_COMMUNITY_atEdge|atEdge]]
- [[_COMMUNITY_snapsvg.js|snapsvg.js]]
- [[_COMMUNITY_Block Argument Editing|Block Argument Editing]]
- [[_COMMUNITY_ScriptsPane|ScriptsPane]]
- [[_COMMUNITY_UI Layout & Drag Helpers|UI Layout & Drag Helpers]]
- [[_COMMUNITY_Block Rendering & Scroll|Block Rendering & Scroll]]
- [[_COMMUNITY_In-app Guides|In-app Guides]]
- [[_COMMUNITY_Scroll|Scroll]]
- [[_COMMUNITY_closeNumberEdit|closeNumberEdit]]
- [[_COMMUNITY_chopSection|chopSection]]
- [[_COMMUNITY_Alert Balloon & Menus|Alert Balloon & Menus]]
- [[_COMMUNITY_Runtime|Runtime]]
- [[_COMMUNITY_addToBkgLib|addToBkgLib]]
- [[_COMMUNITY_Camera & Form Controls|Camera & Form Controls]]
- [[_COMMUNITY_clearWorkspace|clearWorkspace]]
- [[_COMMUNITY_SVGImage|SVGImage]]
- [[_COMMUNITY_Matrix.js|Matrix.js]]
- [[_COMMUNITY_ScratchJr App State Control|ScratchJr App State Control]]
- [[_COMMUNITY_Audio Playback|Audio Playback]]
- [[_COMMUNITY_PaintUndo|PaintUndo]]
- [[_COMMUNITY_Block & Page Drag|Block & Page Drag]]
- [[_COMMUNITY_Thread|Thread]]
- [[_COMMUNITY_Block Specs Assets|Block Specs Assets]]
- [[_COMMUNITY_addPoints|addPoints]]
- [[_COMMUNITY_Project Naming & Sharing|Project Naming & Sharing]]
- [[_COMMUNITY_PNGCache.js|PNGCache.js]]

## God Nodes (most connected - your core abstractions)
1. `gn()` - 328 edges
2. `Paint` - 116 edges
3. `newHTML()` - 105 edges
4. `ScratchJr` - 101 edges
5. `SVG2Canvas` - 82 edges
6. `PaintAction` - 72 edges
7. `UI` - 69 edges
8. `iOS` - 67 edges
9. `setProps()` - 66 edges
10. `Sprite` - 63 edges

## Surprising Connections (you probably didn't know these)
- `setClassOfElementById()` --calls--> `gn()`  [EXTRACTED]
  src/app/src/entry/index.js → src/app/src/utils/lib.js
- `_updatePreview()` --calls--> `gn()`  [EXTRACTED]
  src/app/src/entry/teacher.js → src/app/src/utils/lib.js
- `gettingStartedMain()` --calls--> `gn()`  [EXTRACTED]
  src/app/src/entry/gettingstarted.js → src/app/src/utils/lib.js
- `inappAbout()` --calls--> `gn()`  [EXTRACTED]
  src/app/src/entry/inapp.js → src/app/src/utils/lib.js
- `inappInterfaceGuide()` --calls--> `gn()`  [EXTRACTED]
  src/app/src/entry/inapp.js → src/app/src/utils/lib.js

## Import Cycles
- 3-file cycle: `src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js`
- 3-file cycle: `src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js`
- 3-file cycle: `src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Layer.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ui/UI.js -> src/app/src/editor/ui/ScriptsPane.js`
- 3-file cycle: `src/app/src/editor/ui/Palette.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ui/Palette.js`
- 4-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 4-file cycle: `src/app/src/painteditor/Layer.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Layer.js`
- 4-file cycle: `src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js`
- 4-file cycle: `src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js`
- 4-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Layer.js -> src/app/src/editor/ScratchJr.js`
- 4-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 4-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`

## Communities (85 total, 43 thin omitted)

### Community 0 - "iOS Native Bridge"
Cohesion: 0.05
Nodes (4): Samples, UI, getDocumentHeight(), newHTML()

### Community 5 - "Core Utils & App State"
Cohesion: 0.08
Nodes (33): fontcolors, fontsizes, getshapes, loadassets, sendshapes, speeds, Menu, onBackButtonCallback (+25 more)

### Community 9 - "Live Session Observation"
Cohesion: 0.09
Nodes (31): apiPost(), authHeader(), endLocalSession(), grantControlToStudent(), hideBanner(), initLiveWatch(), joinSession(), PREVIEW_SIZE (+23 more)

### Community 14 - "Sprite & Page UI Actions"
Cohesion: 0.09
Nodes (3): Palette, drawScaled(), hitRect()

### Community 18 - "Asset Library"
Cohesion: 0.15
Nodes (20): maskCanvas, maskData, offscreen, targetOffscreen, deltaPoint, initialPoint, pensizes, cmdForClick (+12 more)

### Community 22 - "Home / Events"
Cohesion: 0.14
Nodes (8): homeMain(), homeStrings(), inappAbout(), inappBlocksGuide(), inappInterfaceGuide(), inappPaintEditorGuide(), Lobby, gn()

### Community 26 - "Snap.svg Library"
Cohesion: 0.32
Nodes (26): a(), b(), c(), d(), e(), f(), g(), h() (+18 more)

### Community 32 - "IO Asset Loading"
Cohesion: 0.12
Nodes (10): gettingStartedMain(), indexFirstTime(), indexLoadOptions(), indexLoadStart(), indexLoadUsage(), indexMain(), indexSetUsage(), setClassOfElementById() (+2 more)

### Community 33 - "atEdge"
Cohesion: 0.09
Nodes (3): SnapElement, SnapPaper, SnapShim

### Community 34 - "snapsvg.js"
Cohesion: 0.14
Nodes (7): keys, Cookie, Localization, localizationMessages, defaultSounds, projectSounds, uiSounds

### Community 37 - "ScriptsPane"
Cohesion: 0.24
Nodes (4): Grid, newCanvas(), newDiv(), newP()

### Community 38 - "UI Layout & Drag Helpers"
Cohesion: 0.30
Nodes (4): getDocumentWidth(), localx(), localy(), setCanvasSizeScaledToWindowDocumentHeight()

### Community 41 - "Scroll"
Cohesion: 0.22
Nodes (10): applyScratchJrPlayerPatches(), applyPagePlayerPatches(), applySpritePlayerPatches(), applyStagePlayerPatches(), EMOJIS, LABELS, playerMain(), _prefetchMedia() (+2 more)

### Community 48 - "Alert Balloon & Menus"
Cohesion: 0.24
Nodes (3): Alert, globalx(), globaly()

### Community 53 - "Camera & Form Controls"
Cohesion: 0.17
Nodes (4): CSSTransition(), newForm(), newTextInput(), setProps()

### Community 73 - "addPoints"
Cohesion: 0.29
Nodes (3): Readable, Transform, Writable

## Knowledge Gaps
- **41 isolated node(s):** `workingCanvas`, `workingCanvas2`, `onBackButtonCallback`, `loadassets`, `fontcolors` (+36 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **43 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `gn()` connect `Home / Events` to `iOS Native Bridge`, `UI Layout`, `Paint Editor Actions`, `Web Interface / Bridge`, `Core Utils & App State`, `Stage`, `Editor Core Modules`, `Player Runtime & IO`, `Live Session Observation`, `Block Connection`, `Paint Editor Core`, `SVG-to-Canvas`, `Sprite & Page UI Actions`, `Home / IO / MediaLib`, `Path Geometry`, `Asset Library`, `Paint Controller`, `Scripts (block layout)`, `Ghost Layer`, `Primitive Commands`, `Block Palette`, `Transform Matrix`, `Drag & Drop Events`, `Paint Layers`, `Page Model`, `Undo`, `IO Asset Loading`, `snapsvg.js`, `Getting Started / Index`, `ScriptsPane`, `UI Layout & Drag Helpers`, `Block Rendering & Scroll`, `In-app Guides`, `arrayToString`, `Rectangle`, `Editor & Paint Panel Layout`, `BlockSpecs`, `Alert Balloon & Menus`, `Vector Math`, `Camera & Form Controls`, `Text Color & Size Menu`, `closePath`, `adjustPos`, `jszip.js`, `clearWorkspace`, `Matrix.js`, `Paint Shape Drawing Actions`, `PaintUndo`, `adjustShapePosition`, `Paint Editor Panels`, `addImageUrl`, `Sound`, `addDot`?**
  _High betweenness centrality (0.319) - this node is a cross-community bridge._
- **Why does `ScratchJr` connect `Paint Editor Core` to `appinit`, `Core Utils & App State`, `ScriptsPane`, `Block Rendering & Scroll`, `Scroll`, `arrayToString`, `Rectangle`, `addDot`, `Editor Frame Sizing`, `Asset Library`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Why does `Prims` connect `SVG-to-Canvas` to `Core Utils & App State`, `Block Rendering & Scroll`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **What connects `workingCanvas`, `workingCanvas2`, `onBackButtonCallback` to the rest of the system?**
  _41 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `iOS Native Bridge` be split into smaller, more focused modules?**
  _Cohesion score 0.05098934550989345 - nodes in this community are weakly interconnected._
- **Should `UI Layout` be split into smaller, more focused modules?**
  _Cohesion score 0.07175141242937853 - nodes in this community are weakly interconnected._
- **Should `Paint Editor Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.06829573934837092 - nodes in this community are weakly interconnected._