# Graph Report - .  (2026-07-29)

## Corpus Check
- 1 files · ~87,990 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1769 nodes · 4392 edges · 82 communities (36 shown, 46 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Paint Editor Actions|Paint Editor Actions]]
- [[_COMMUNITY_UI Layout|UI Layout]]
- [[_COMMUNITY_Web Interface  Bridge|Web Interface / Bridge]]
- [[_COMMUNITY_SVG Tools|SVG Tools]]
- [[_COMMUNITY_Block Specs & Rendering|Block Specs & Rendering]]
- [[_COMMUNITY_Stage|Stage]]
- [[_COMMUNITY_iOS Native Bridge|iOS Native Bridge]]
- [[_COMMUNITY_Player Runtime & IO|Player Runtime & IO]]
- [[_COMMUNITY_Project Management|Project Management]]
- [[_COMMUNITY_Block Connection|Block Connection]]
- [[_COMMUNITY_Editor Core Modules|Editor Core Modules]]
- [[_COMMUNITY_Thumbnails  Pages UI|Thumbnails / Pages UI]]
- [[_COMMUNITY_Home  IO  MediaLib|Home / IO / MediaLib]]
- [[_COMMUNITY_SVG-to-Canvas|SVG-to-Canvas]]
- [[_COMMUNITY_Primitive Commands|Primitive Commands]]
- [[_COMMUNITY_Path Geometry|Path Geometry]]
- [[_COMMUNITY_Paint Editor Core|Paint Editor Core]]
- [[_COMMUNITY_Asset Library|Asset Library]]
- [[_COMMUNITY_Paint Controller|Paint Controller]]
- [[_COMMUNITY_Sprite & Page UI Actions|Sprite & Page UI Actions]]
- [[_COMMUNITY_BlockArg  Menu|BlockArg / Menu]]
- [[_COMMUNITY_Home  Events|Home / Events]]
- [[_COMMUNITY_Block Palette|Block Palette]]
- [[_COMMUNITY_Scripts (block layout)|Scripts (block layout)]]
- [[_COMMUNITY_Block Arguments|Block Arguments]]
- [[_COMMUNITY_Ghost Layer|Ghost Layer]]
- [[_COMMUNITY_In-app Guides|In-app Guides]]
- [[_COMMUNITY_Transform Matrix|Transform Matrix]]
- [[_COMMUNITY_Snap.svg Library|Snap.svg Library]]
- [[_COMMUNITY_Drag & Drop Events|Drag & Drop Events]]
- [[_COMMUNITY_Paint Layers|Paint Layers]]
- [[_COMMUNITY_Page Model|Page Model]]
- [[_COMMUNITY_Runtime & Grid|Runtime & Grid]]
- [[_COMMUNITY_IO Asset Loading|IO Asset Loading]]
- [[_COMMUNITY_Undo|Undo]]
- [[_COMMUNITY_snapsvg.js|snapsvg.js]]
- [[_COMMUNITY_atEdge|atEdge]]
- [[_COMMUNITY_BlockArg|BlockArg]]
- [[_COMMUNITY_ScriptsPane|ScriptsPane]]
- [[_COMMUNITY_Block Rendering & Scroll|Block Rendering & Scroll]]
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
- [[_COMMUNITY_Samples|Samples]]
- [[_COMMUNITY_Block & Page Drag|Block & Page Drag]]
- [[_COMMUNITY_Thread|Thread]]
- [[_COMMUNITY_Block Specs Assets|Block Specs Assets]]
- [[_COMMUNITY_addPoints|addPoints]]
- [[_COMMUNITY_breakRelationship|breakRelationship]]
- [[_COMMUNITY_PNGCache.js|PNGCache.js]]
- [[_COMMUNITY_Project Naming & Sharing|Project Naming & Sharing]]
- [[_COMMUNITY_DrawPath|DrawPath]]

## God Nodes (most connected - your core abstractions)
1. `gn()` - 304 edges
2. `Paint` - 117 edges
3. `ScratchJr` - 109 edges
4. `newHTML()` - 88 edges
5. `SVG2Canvas` - 83 edges
6. `PaintAction` - 72 edges
7. `UI` - 69 edges
8. `setProps()` - 65 edges
9. `iOS` - 64 edges
10. `Sprite` - 63 edges

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
- 3-file cycle: `src/app/src/editor/ui/Palette.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Project.js -> src/app/src/editor/ui/Palette.js`
- 3-file cycle: `src/app/src/editor/ui/Palette.js -> src/app/src/editor/ui/Undo.js -> src/app/src/editor/ui/Project.js -> src/app/src/editor/ui/Palette.js`
- 3-file cycle: `src/app/src/editor/ui/Project.js -> src/app/src/editor/ui/UI.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Project.js`
- 3-file cycle: `src/app/src/editor/ui/Project.js -> src/app/src/editor/ui/UI.js -> src/app/src/editor/ui/Undo.js -> src/app/src/editor/ui/Project.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/editor/ui/Palette.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ui/Palette.js`
- 3-file cycle: `src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ui/UI.js -> src/app/src/editor/ui/ScriptsPane.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/Ghost.js`
- 3-file cycle: `src/app/src/painteditor/Paint.js -> src/app/src/painteditor/Path.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 3-file cycle: `src/app/src/painteditor/Layer.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Layer.js`
- 3-file cycle: `src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/SVGImage.js -> src/app/src/painteditor/Paint.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/painteditor/Paint.js -> src/app/src/painteditor/PaintUndo.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/painteditor/Camera.js -> src/app/src/painteditor/Ghost.js -> src/app/src/painteditor/PaintAction.js -> src/app/src/painteditor/Camera.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/editor/ui/Palette.js -> src/app/src/editor/blocks/Block.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/iPad/iOS.js -> src/app/src/utils/ScratchAudio.js -> src/app/src/utils/Sound.js -> src/app/src/iPad/iOS.js`

## Communities (82 total, 46 thin omitted)

### Community 4 - "Block Specs & Rendering"
Cohesion: 0.09
Nodes (10): BlockArg, Menu, Alert, getStringSize(), globalx(), globaly(), newCanvas(), setCanvasSize() (+2 more)

### Community 8 - "Project Management"
Cohesion: 0.15
Nodes (11): onBackButtonCallback, workingCanvas, workingCanvas2, keys, buffer, pinchcenter, setCanvasSizeScaledToWindowDocumentHeight(), defaultSounds (+3 more)

### Community 17 - "Asset Library"
Cohesion: 0.14
Nodes (21): maskCanvas, maskData, offscreen, targetOffscreen, deltaPoint, initialPoint, pensizes, cmdForClick (+13 more)

### Community 21 - "Home / Events"
Cohesion: 0.13
Nodes (11): homeMain(), homeStrings(), inappAbout(), inappBlocksGuide(), inappInterfaceGuide(), inappPaintEditorGuide(), Lobby, gn() (+3 more)

### Community 26 - "In-app Guides"
Cohesion: 0.12
Nodes (5): ScriptsPane, hit3DRect(), hitRect(), localx(), localy()

### Community 28 - "Snap.svg Library"
Cohesion: 0.32
Nodes (26): a(), b(), c(), d(), e(), f(), g(), h() (+18 more)

### Community 33 - "IO Asset Loading"
Cohesion: 0.12
Nodes (10): gettingStartedMain(), indexFirstTime(), indexLoadOptions(), indexLoadStart(), indexLoadUsage(), indexMain(), indexSetUsage(), setClassOfElementById() (+2 more)

### Community 35 - "snapsvg.js"
Cohesion: 0.13
Nodes (9): fontcolors, fontsizes, getshapes, loadassets, sendshapes, speeds, Cookie, Localization (+1 more)

### Community 36 - "atEdge"
Cohesion: 0.09
Nodes (3): SnapElement, SnapPaper, SnapShim

### Community 38 - "BlockArg"
Cohesion: 0.14
Nodes (13): CSSTransition(), drawThumbnail(), ensureEditorFrames(), fitInRect(), getFit(), getHex(), libInit(), newForm() (+5 more)

### Community 40 - "ScriptsPane"
Cohesion: 0.22
Nodes (3): Grid, newDiv(), newP()

### Community 42 - "Scroll"
Cohesion: 0.22
Nodes (10): applyScratchJrPlayerPatches(), applyPagePlayerPatches(), applySpritePlayerPatches(), applyStagePlayerPatches(), EMOJIS, LABELS, playerMain(), _prefetchMedia() (+2 more)

### Community 69 - "addPoints"
Cohesion: 0.29
Nodes (3): Readable, Transform, Writable

## Knowledge Gaps
- **38 isolated node(s):** `workingCanvas`, `workingCanvas2`, `onBackButtonCallback`, `loadassets`, `fontcolors` (+33 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **46 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `gn()` connect `Home / Events` to `Paint Editor Actions`, `UI Layout`, `Web Interface / Bridge`, `Block Specs & Rendering`, `Stage`, `iOS Native Bridge`, `Player Runtime & IO`, `Project Management`, `Block Connection`, `Editor Core Modules`, `SVG-to-Canvas`, `Primitive Commands`, `Paint Editor Core`, `Asset Library`, `Paint Controller`, `Sprite & Page UI Actions`, `Block Palette`, `Scripts (block layout)`, `Block Arguments`, `Ghost Layer`, `In-app Guides`, `Transform Matrix`, `Drag & Drop Events`, `Paint Layers`, `Page Model`, `IO Asset Loading`, `Undo`, `snapsvg.js`, `Getting Started / Index`, `BlockArg`, `Editor & Paint Panel Layout`, `ScriptsPane`, `Block Rendering & Scroll`, `Rectangle`, `BlockSpecs`, `adjustShapePosition`, `Vector Math`, `PaintUndo`, `closePath`, `adjustPos`, `clearWorkspace`, `Matrix.js`, `Samples`, `Text Color & Size Menu`, `addImageUrl`, `jszip.js`, `breakRelationship`, `stream.js`, `addDot`?**
  _High betweenness centrality (0.293) - this node is a cross-community bridge._
- **Why does `ScratchJr` connect `Paint Editor Core` to `Block Specs & Rendering`, `Project Management`, `stream.js`, `Scroll`, `addDot`, `Rectangle`, `Editor Frame Sizing`, `Block Rendering & Scroll`, `ScriptsPane`, `Asset Library`, `Block Arguments`, `In-app Guides`, `arrayToString`, `appinit`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Why does `SVGTools` connect `Web Interface / Bridge` to `Project Management`, `Asset Library`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **What connects `workingCanvas`, `workingCanvas2`, `onBackButtonCallback` to the rest of the system?**
  _38 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Paint Editor Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._
- **Should `UI Layout` be split into smaller, more focused modules?**
  _Cohesion score 0.07175141242937853 - nodes in this community are weakly interconnected._
- **Should `Web Interface / Bridge` be split into smaller, more focused modules?**
  _Cohesion score 0.06848357791754019 - nodes in this community are weakly interconnected._