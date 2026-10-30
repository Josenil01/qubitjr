# Graph Report - src\app\src  (2026-10-30)

## Corpus Check
- 91 files · ~141,535 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2050 nodes · 5188 edges · 93 communities (52 shown, 41 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 26 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c0b1a9a6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 86|Community 86]]

## God Nodes (most connected - your core abstractions)
1. `gn()` - 338 edges
2. `newHTML()` - 124 edges
3. `ScratchJr` - 118 edges
4. `Paint` - 118 edges
5. `SVG2Canvas` - 84 edges
6. `PaintAction` - 72 edges
7. `UI` - 69 edges
8. `iOS` - 68 edges
9. `setProps()` - 66 edges
10. `Sprite` - 63 edges

## Surprising Connections (you probably didn't know these)
- `teacherProject()` --calls--> `b()`  [INFERRED]
  editor/ui/hintAlignment.test.js → snap/snap.svg-min.js
- `_warnStudentCameOnline()` --calls--> `newHTML()`  [EXTRACTED]
  entry/teacher.js → utils/lib.js
- `applyStageState()` --calls--> `gn()`  [EXTRACTED]
  editor/LiveMirror.js → utils/lib.js
- `applyUiState()` --calls--> `gn()`  [EXTRACTED]
  editor/LiveMirror.js → utils/lib.js
- `_findHoverElement()` --calls--> `gn()`  [EXTRACTED]
  editor/LiveMirror.js → utils/lib.js

## Import Cycles
- 3-file cycle: `painteditor/Layer.js -> painteditor/Paint.js -> painteditor/PaintAction.js -> painteditor/Layer.js`
- 3-file cycle: `painteditor/Ghost.js -> painteditor/Layer.js -> painteditor/Path.js -> painteditor/Ghost.js`
- 3-file cycle: `editor/ScratchJr.js -> editor/ui/ScriptsPane.js -> editor/ui/Thumbs.js -> editor/ScratchJr.js`
- 3-file cycle: `editor/ui/Palette.js -> editor/ui/ScriptsPane.js -> editor/ui/Thumbs.js -> editor/ui/Palette.js`
- 3-file cycle: `editor/ui/ScriptsPane.js -> editor/ui/Thumbs.js -> editor/ui/UI.js -> editor/ui/ScriptsPane.js`
- 3-file cycle: `painteditor/Paint.js -> painteditor/PaintAction.js -> painteditor/SVGImage.js -> painteditor/Paint.js`
- 3-file cycle: `painteditor/Paint.js -> painteditor/Path.js -> painteditor/SVGImage.js -> painteditor/Paint.js`
- 3-file cycle: `editor/ScratchJr.js -> editor/ui/Palette.js -> editor/blocks/Block.js -> editor/ScratchJr.js`
- 3-file cycle: `editor/ui/Palette.js -> editor/ui/Undo.js -> editor/ui/Project.js -> editor/ui/Palette.js`
- 3-file cycle: `editor/ui/Project.js -> editor/ui/UI.js -> editor/ui/Undo.js -> editor/ui/Project.js`
- 3-file cycle: `editor/ui/Palette.js -> editor/ui/ScriptsPane.js -> editor/ui/Project.js -> editor/ui/Palette.js`
- 3-file cycle: `editor/ui/Project.js -> editor/ui/UI.js -> editor/ui/ScriptsPane.js -> editor/ui/Project.js`
- 3-file cycle: `editor/ScratchJr.js -> painteditor/Paint.js -> painteditor/PaintAction.js -> editor/ScratchJr.js`
- 3-file cycle: `painteditor/Camera.js -> painteditor/Paint.js -> painteditor/PaintAction.js -> painteditor/Camera.js`
- 3-file cycle: `editor/ScratchJr.js -> painteditor/Paint.js -> painteditor/PaintUndo.js -> editor/ScratchJr.js`
- 3-file cycle: `editor/ScratchJr.js -> painteditor/Paint.js -> painteditor/Path.js -> editor/ScratchJr.js`
- 3-file cycle: `painteditor/Ghost.js -> painteditor/Paint.js -> painteditor/Path.js -> painteditor/Ghost.js`
- 3-file cycle: `painteditor/Camera.js -> painteditor/Ghost.js -> painteditor/PaintAction.js -> painteditor/Camera.js`
- 3-file cycle: `painteditor/Ghost.js -> painteditor/PaintAction.js -> painteditor/Path.js -> painteditor/Ghost.js`
- 3-file cycle: `iPad/IO.js -> iPad/MediaLib.js -> utils/Localization.js -> iPad/IO.js`

## Communities (93 total, 41 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (69): applyHoverTarget(), applyPageList(), applyStageState(), applyUiState(), buildMirrorPayload(), fakeTouchEvent(), _findHoverElement(), hideLockOverlay() (+61 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (4): hopList, Prims, Runtime, Thread

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (3): UI, css_vh(), getViewportHeight()

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (5): evaluate(), proj(), teacherProject(), script(), Project

### Community 7 - "Community 7"
Cohesion: 0.08
Nodes (9): keys, AppUsage, Cookie, Localization, localizationMessages, defaultSounds, projectSounds, ScratchAudio (+1 more)

### Community 13 - "Community 13"
Cohesion: 0.09
Nodes (11): applyScratchJrPlayerPatches(), applyPagePlayerPatches(), applySpritePlayerPatches(), applyStagePlayerPatches(), EMOJIS, LABELS, playerMain(), _prefetchMedia() (+3 more)

### Community 15 - "Community 15"
Cohesion: 0.10
Nodes (10): gettingStartedMain(), homeMain(), homeStrings(), inappAbout(), inappBlocksGuide(), inappInterfaceGuide(), inappPaintEditorGuide(), setClassOfElementById() (+2 more)

### Community 18 - "Community 18"
Cohesion: 0.09
Nodes (3): Palette, drawScaled(), hitRect()

### Community 19 - "Community 19"
Cohesion: 0.16
Nodes (9): Menu, Alert, getStringSize(), globalx(), globaly(), newCanvas(), setCanvasSize(), setProps() (+1 more)

### Community 20 - "Community 20"
Cohesion: 0.14
Nodes (21): maskCanvas, maskData, offscreen, targetOffscreen, deltaPoint, initialPoint, pensizes, cmdForClick (+13 more)

### Community 21 - "Community 21"
Cohesion: 0.11
Nodes (13): apiFetch(), authHeader(), closeOverlay(), GenerateActivityModal, gotoEditor(), guessDefaultLevel(), apiFetch(), AssignmentAuthorBar (+5 more)

### Community 24 - "Community 24"
Cohesion: 0.16
Nodes (15): fontcolors, fontsizes, getshapes, loadassets, sendshapes, speeds, onBackButtonCallback, workingCanvas (+7 more)

### Community 30 - "Community 30"
Cohesion: 0.13
Nodes (20): actorLabelFor(), ALWAYS_PENDING_WHEN_TYPES, BLOCK_LABELS, blockMatch(), candidatesFor(), ENCODE_SKIPPED_TYPES, expectedCache, findSceneAndCharacter() (+12 more)

### Community 31 - "Community 31"
Cohesion: 0.11
Nodes (19): cachedHints, HINT_WHEN_LABELS, css_vw(), CSSTransition(), drawThumbnail(), ensureEditorFrames(), fitInRect(), getFit() (+11 more)

### Community 33 - "Community 33"
Cohesion: 0.32
Nodes (26): a(), b(), c(), d(), e(), f(), g(), h() (+18 more)

### Community 38 - "Community 38"
Cohesion: 0.09
Nodes (3): SnapElement, SnapPaper, SnapShim

### Community 41 - "Community 41"
Cohesion: 0.16
Nodes (15): decide(), detailedFor(), intro, alignmentInfo(), decideHintAction(), expectedResultOf(), expectedResultsFor(), nextProactiveHint() (+7 more)

### Community 42 - "Community 42"
Cohesion: 0.14
Nodes (11): apiFetch(), authHeader(), blockBlinkEls, dismissedHintIds, recordHintEvent(), wrongValueAlerted, registerGalleryRestrictionProvider(), registerZeroBlockDefaultsProvider() (+3 more)

### Community 43 - "Community 43"
Cohesion: 0.16
Nodes (4): getDocumentHeight(), getDocumentWidth(), newHTML(), newTextInput()

### Community 44 - "Community 44"
Cohesion: 0.24
Nodes (3): Grid, newDiv(), newP()

### Community 47 - "Community 47"
Cohesion: 0.13
Nodes (9): alertText(), blockLabel(), spokenValue(), ALL_PROJECTS, CARETS, FIXTURE_DIR, fixtures, SYNTHETIC (+1 more)

### Community 67 - "Community 67"
Cohesion: 0.29
Nodes (6): allCharactersAtLimit(), getGalleryRestriction(), isCharacterAtLimit(), showAssignmentToast(), useZeroBlockDefaults(), newImage()

### Community 70 - "Community 70"
Cohesion: 0.25
Nodes (3): freshAlignmentTarget(), nthEncodedBlock(), resolveLiveBlock()

### Community 74 - "Community 74"
Cohesion: 0.52
Nodes (3): apiFetch(), AssignmentNotice, authHeader()

### Community 78 - "Community 78"
Cohesion: 0.29
Nodes (3): Readable, Transform, Writable

### Community 79 - "Community 79"
Cohesion: 0.40
Nodes (6): indexFirstTime(), indexLoadOptions(), indexLoadStart(), indexLoadUsage(), indexMain(), indexSetUsage()

## Knowledge Gaps
- **65 isolated node(s):** `_lastSpriteIds`, `workingCanvas`, `workingCanvas2`, `onBackButtonCallback`, `loadassets` (+60 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **41 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `gn()` connect `Community 15` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 6`, `Community 7`, `Community 8`, `Community 9`, `Community 10`, `Community 11`, `Community 14`, `Community 17`, `Community 18`, `Community 19`, `Community 20`, `Community 22`, `Community 24`, `Community 25`, `Community 26`, `Community 27`, `Community 29`, `Community 31`, `Community 32`, `Community 34`, `Community 35`, `Community 36`, `Community 37`, `Community 39`, `Community 42`, `Community 43`, `Community 44`, `Community 45`, `Community 46`, `Community 50`, `Community 51`, `Community 53`, `Community 54`, `Community 56`, `Community 58`, `Community 59`, `Community 60`, `Community 61`, `Community 66`, `Community 67`, `Community 69`, `Community 70`, `Community 72`, `Community 74`, `Community 75`, `Community 76`, `Community 79`, `Community 81`, `Community 84`, `Community 85`?**
  _High betweenness centrality (0.300) - this node is a cross-community bridge._
- **Why does `ScratchJr` connect `Community 10` to `Community 0`, `Community 2`, `Community 68`, `Community 7`, `Community 71`, `Community 42`, `Community 44`, `Community 13`, `Community 46`, `Community 19`, `Community 84`, `Community 85`, `Community 20`, `Community 24`, `Community 62`, `Community 31`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **Why does `Project` connect `Community 6` to `Community 0`, `Community 2`, `Community 7`, `Community 41`, `Community 42`, `Community 13`, `Community 24`, `Community 31`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **What connects `_lastSpriteIds`, `workingCanvas`, `workingCanvas2` to the rest of the system?**
  _65 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06426906426906427 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05901639344262295 - nodes in this community are weakly interconnected._