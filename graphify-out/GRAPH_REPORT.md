# Graph Report - .  (2026-06-23)

## Corpus Check
- 68 files · ~87,753 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1766 nodes · 4459 edges · 84 communities (38 shown, 46 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Paint Editor Actions|Paint Editor Actions]]
- [[_COMMUNITY_Sprite Model|Sprite Model]]
- [[_COMMUNITY_UI Layout|UI Layout]]
- [[_COMMUNITY_Web Interface  Bridge|Web Interface / Bridge]]
- [[_COMMUNITY_SVG Tools|SVG Tools]]
- [[_COMMUNITY_Runtime & Interpreter|Runtime & Interpreter]]
- [[_COMMUNITY_Block Specs & Rendering|Block Specs & Rendering]]
- [[_COMMUNITY_Stage|Stage]]
- [[_COMMUNITY_iOS Native Bridge|iOS Native Bridge]]
- [[_COMMUNITY_Project Management|Project Management]]
- [[_COMMUNITY_Thumbnails  Pages UI|Thumbnails / Pages UI]]
- [[_COMMUNITY_SVG-to-Canvas|SVG-to-Canvas]]
- [[_COMMUNITY_Home  IO  MediaLib|Home / IO / MediaLib]]
- [[_COMMUNITY_Scripts (block layout)|Scripts (block layout)]]
- [[_COMMUNITY_ScratchJr Core|ScratchJr Core]]
- [[_COMMUNITY_Primitive Commands|Primitive Commands]]
- [[_COMMUNITY_Paint Controller|Paint Controller]]
- [[_COMMUNITY_Path Geometry|Path Geometry]]
- [[_COMMUNITY_Block Connection|Block Connection]]
- [[_COMMUNITY_Block Arguments|Block Arguments]]
- [[_COMMUNITY_Asset Library|Asset Library]]
- [[_COMMUNITY_Ghost Layer|Ghost Layer]]
- [[_COMMUNITY_Block Palette|Block Palette]]
- [[_COMMUNITY_BlockArg  Menu|BlockArg / Menu]]
- [[_COMMUNITY_Page Model|Page Model]]
- [[_COMMUNITY_In-app Guides|In-app Guides]]
- [[_COMMUNITY_Transform Matrix|Transform Matrix]]
- [[_COMMUNITY_Snap.svg Library|Snap.svg Library]]
- [[_COMMUNITY_Sound Recording|Sound Recording]]
- [[_COMMUNITY_Home  Events|Home / Events]]
- [[_COMMUNITY_Drag & Drop Events|Drag & Drop Events]]
- [[_COMMUNITY_Paint Layers|Paint Layers]]
- [[_COMMUNITY_Getting Started  Index|Getting Started / Index]]
- [[_COMMUNITY_IO Asset Loading|IO Asset Loading]]
- [[_COMMUNITY_Editor Frame Helpers|Editor Frame Helpers]]
- [[_COMMUNITY_Undo|Undo]]
- [[_COMMUNITY_snapsvg.js|snapsvg.js]]
- [[_COMMUNITY_BlockArg|BlockArg]]
- [[_COMMUNITY_ScriptsPane|ScriptsPane]]
- [[_COMMUNITY_ScratchJr_player.js|ScratchJr_player.js]]
- [[_COMMUNITY_Scroll|Scroll]]
- [[_COMMUNITY_Rectangle|Rectangle]]
- [[_COMMUNITY_addSidePalette|addSidePalette]]
- [[_COMMUNITY_BlockSpecs|BlockSpecs]]
- [[_COMMUNITY_Runtime|Runtime]]
- [[_COMMUNITY_PaintUndo|PaintUndo]]
- [[_COMMUNITY_SVGImage|SVGImage]]
- [[_COMMUNITY_Matrix.js|Matrix.js]]
- [[_COMMUNITY_Camera|Camera]]
- [[_COMMUNITY_dropBlockFromPalette|dropBlockFromPalette]]
- [[_COMMUNITY_ScratchAudio|ScratchAudio]]
- [[_COMMUNITY_Samples|Samples]]
- [[_COMMUNITY_Thread|Thread]]
- [[_COMMUNITY_jszip.js|jszip.js]]
- [[_COMMUNITY_PNGCache.js|PNGCache.js]]
- [[_COMMUNITY_stream.js|stream.js]]
- [[_COMMUNITY_Sound|Sound]]
- [[_COMMUNITY_DrawPath|DrawPath]]

## God Nodes (most connected - your core abstractions)
1. `gn()` - 320 edges
2. `Paint` - 118 edges
3. `ScratchJr` - 110 edges
4. `newHTML()` - 98 edges
5. `SVG2Canvas` - 84 edges
6. `PaintAction` - 72 edges
7. `UI` - 69 edges
8. `iOS` - 67 edges
9. `setProps()` - 66 edges
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
- 3-file cycle: `src/app/src/editor/ui/Project.js -> src/app/src/editor/ui/UI.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Project.js`
- 3-file cycle: `src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ui/UI.js -> src/app/src/editor/ui/ScriptsPane.js`
- 3-file cycle: `src/app/src/editor/ui/Project.js -> src/app/src/editor/ui/UI.js -> src/app/src/editor/ui/Undo.js -> src/app/src/editor/ui/Project.js`
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
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/editor/ui/Palette.js -> src/app/src/editor/blocks/Block.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/editor/ScratchJr.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ScratchJr.js`
- 3-file cycle: `src/app/src/editor/ui/Palette.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Project.js -> src/app/src/editor/ui/Palette.js`
- 3-file cycle: `src/app/src/editor/ui/Palette.js -> src/app/src/editor/ui/ScriptsPane.js -> src/app/src/editor/ui/Thumbs.js -> src/app/src/editor/ui/Palette.js`
- 3-file cycle: `src/app/src/editor/ui/Palette.js -> src/app/src/editor/ui/Undo.js -> src/app/src/editor/ui/Project.js -> src/app/src/editor/ui/Palette.js`
- 3-file cycle: `src/app/src/iPad/IO.js -> src/app/src/iPad/MediaLib.js -> src/app/src/utils/Localization.js -> src/app/src/iPad/IO.js`

## Communities (84 total, 46 thin omitted)

### Community 5 - "Runtime & Interpreter"
Cohesion: 0.10
Nodes (20): Vector, maskCanvas, maskData, offscreen, targetOffscreen, deltaPoint, initialPoint, pensizes (+12 more)

### Community 13 - "Scripts (block layout)"
Cohesion: 0.10
Nodes (8): keys, MediaLib, Cookie, Localization, localizationMessages, defaultSounds, projectSounds, uiSounds

### Community 14 - "ScratchJr Core"
Cohesion: 0.18
Nodes (17): fontcolors, fontsizes, getshapes, loadassets, sendshapes, speeds, buffer, pinchcenter (+9 more)

### Community 19 - "Block Arguments"
Cohesion: 0.13
Nodes (8): homeMain(), homeStrings(), inappAbout(), inappBlocksGuide(), inappInterfaceGuide(), inappPaintEditorGuide(), Lobby, gn()

### Community 24 - "Page Model"
Cohesion: 0.15
Nodes (9): Menu, Alert, drawThumbnail(), getDocumentHeight(), getStringSize(), globalx(), globaly(), newCanvas() (+1 more)

### Community 26 - "Transform Matrix"
Cohesion: 0.32
Nodes (26): a(), b(), c(), d(), e(), f(), g(), h() (+18 more)

### Community 28 - "Sound Recording"
Cohesion: 0.14
Nodes (6): onBackButtonCallback, workingCanvas, workingCanvas2, hopList, Grid, newP()

### Community 32 - "Getting Started / Index"
Cohesion: 0.12
Nodes (17): colorToRGBA(), drawScaled(), ensureEditorFrames(), fitInRect(), getFit(), getHex(), getRGB(), hitRect() (+9 more)

### Community 33 - "IO Asset Loading"
Cohesion: 0.12
Nodes (10): gettingStartedMain(), indexFirstTime(), indexLoadOptions(), indexLoadStart(), indexLoadUsage(), indexMain(), indexSetUsage(), setClassOfElementById() (+2 more)

### Community 36 - "snapsvg.js"
Cohesion: 0.09
Nodes (3): SnapElement, SnapPaper, SnapShim

### Community 40 - "ScratchJr_player.js"
Cohesion: 0.22
Nodes (10): applyScratchJrPlayerPatches(), applyPagePlayerPatches(), applySpritePlayerPatches(), applyStagePlayerPatches(), EMOJIS, LABELS, playerMain(), _prefetchMedia() (+2 more)

### Community 70 - "stream.js"
Cohesion: 0.29
Nodes (3): Readable, Transform, Writable

## Knowledge Gaps
- **38 isolated node(s):** `workingCanvas`, `workingCanvas2`, `onBackButtonCallback`, `loadassets`, `fontcolors` (+33 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **46 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `gn()` connect `Block Arguments` to `Paint Editor Actions`, `Sprite Model`, `UI Layout`, `SVG Tools`, `Runtime & Interpreter`, `Block Specs & Rendering`, `Stage`, `iOS Native Bridge`, `Thumbnails / Pages UI`, `SVG-to-Canvas`, `Home / IO / MediaLib`, `Scripts (block layout)`, `ScratchJr Core`, `Primitive Commands`, `Path Geometry`, `Block Connection`, `Asset Library`, `Ghost Layer`, `Block Palette`, `BlockArg / Menu`, `Page Model`, `In-app Guides`, `Snap.svg Library`, `Sound Recording`, `Home / Events`, `Drag & Drop Events`, `Paint Layers`, `Getting Started / Index`, `IO Asset Loading`, `Undo`, `atEdge`, `ScriptsPane`, `blur`, `closeNumberEdit`, `addSidePalette`, `chopSection`, `addToBkgLib`, `PaintUndo`, `deleteDot`, `SVGImage`, `adjustPos`, `adjustShapePosition`, `clearWorkspace`, `Camera`, `dropBlockFromPalette`, `Samples`, `addImageUrl`, `addPoints`, `breakRelationship`, `addDot`, `displayStatus`, `clickOnPage`?**
  _High betweenness centrality (0.299) - this node is a cross-community bridge._
- **Why does `Path` connect `Primitive Commands` to `addPoints`, `breakRelationship`, `atEdge`, `Runtime & Interpreter`, `addDot`, `chopSection`, `deleteDot`, `Block Arguments`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Why does `ScratchJr` connect `SVG-to-Canvas` to `Runtime & Interpreter`, `ScratchJr_player.js`, `blur`, `closeNumberEdit`, `displayStatus`, `isNumberPadKeyCode`, `ScratchJr Core`, `Scripts (block layout)`, `Page Model`, `Sound Recording`, `appinit`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **What connects `workingCanvas`, `workingCanvas2`, `onBackButtonCallback` to the rest of the system?**
  _38 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Paint Editor Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._
- **Should `Sprite Model` be split into smaller, more focused modules?**
  _Cohesion score 0.053551912568306013 - nodes in this community are weakly interconnected._
- **Should `UI Layout` be split into smaller, more focused modules?**
  _Cohesion score 0.07188778492109878 - nodes in this community are weakly interconnected._