# Análise: Por que a Imagem Personalizada NÃO Aparece na Galeria

## Fluxo Completo de Salvar + Exibir Imagem Customizada

### 1️⃣ **SALVAR IMAGEM** (Paint.js → Database)

#### Função: `Paint.saveSprite()` 
```javascript
// Line 1280 em Paint.js
static saveSprite (fcn) {
    svgdata = SVGTools.saveShape(gn('layer1'), workspaceWidth, workspaceHeight);
    IO.setMedia(svgdata, 'svg', function (str) {
        Paint.addOrModifySprite(str, fcn);  // str = MD5 do SVG
    });
}
```

**Etapas:**
1. **`SVGTools.saveShape()`** — Converte desenho em SVG string
2. **`IO.setMedia()`** — Envia SVG para storage (cria MD5)
3. **`Paint.addOrModifySprite()`** — Verifica se já existe
4. **`Paint.addToLib()`** — **INSERE na tabela USERSHAPES**

#### Função: `Paint.addToLib()` (Line 1352)
```javascript
static addToLib (fcn) {
    var scale = '0.5';
    var cname = document.forms.spriteform.name.value;  // Nome input
    var box = SVGTools.getBox(gn('layer1')).rounded();
    box = box.expandBy(20);
    var w = box.width.toString();   // ⚠️ DIMENSÃO CRÍTICA
    var h = box.height.toString();  // ⚠️ DIMENSÃO CRÍTICA
    
    // Gera thumbnail PNG
    var dataurl = IO.getThumbnail(svgdata, w, h, 120, 90);
    var pngBase64 = dataurl.split(',')[1];
    
    iOS.setmedia(pngBase64, 'png', setCostumeRecord);
}

function setCostumeRecord (pngmd5) {
    var json = {
        stmt: 'insert into usershapes (scale, md5, altmd5, version, width, height, ext, name) 
               values (?,?,?,?,?,?,?,?)',
        values: [scale, saveMD5, pngmd5, ScratchJr.version, w, h, 'svg', cname]
    };
    iOS.stmt(json, fcn);
}
```

**O que é salvo no BANCO:**
```
USERSHAPES TABLE:
├─ ID (auto)
├─ CTIME (auto)
├─ MD5 (SVG MD5)           ← Armazenado em PROJECTFILES
├─ ALTMD5 (PNG MD5)        ← Thumbnail em base64
├─ VERSION                 ← ScratchJr.version
├─ SCALE (0.5)
├─ WIDTH                   ← Da bounding box
├─ HEIGHT                  ← Da bounding box
├─ EXT ('svg')
├─ NAME (nome do usuário)
├─ OWNER (null?)           ⚠️ CAMPO IMPORTANTE
└─ ext ('svg')
```

---

### 2️⃣ **BUSCAR NA BIBLIOTECA** (Library.js → Query)

#### Função: `Library.addThumbnails()` (Line 120 em Library.js)
```javascript
static addThumbnails () {
    var div = gn('scrollarea');
    
    // Busca imagens do BANCO
    var key = (type == 'costumes') ? 'usershapes' : 'userbkgs';
    var json = {
        cond: 'ext = ? AND version = ?',
        items: ['md5', 'altmd5', 'name', 'scale', 'width', 'height'],
        values: ['svg', ScratchJr.version],
        order: 'ctime desc'
    };
    
    IO.query(key, json, Library.displayAssets);  // ← AQUI BUSCA DADOS
}
```

**SQL GERADO:**
```sql
SELECT md5, altmd5, name, scale, width, height 
FROM usershapes 
WHERE ext = 'svg' AND version = 'X.X.X'
ORDER BY ctime DESC
```

#### Função: `Library.displayAssets()` (Line 155 em Library.js)
```javascript
static displayAssets (str) {
    nativeJr = true;
    var div = gn('scrollarea');
    var data = JSON.parse(str);  // ← Resultado da query
    
    if (data.length > 0) {
        for (var i = 0; i < data.length; i++) {
            // Cria thumbnail para CADA resultado
            Library.addAssetThumbChoose(div, data[i], 120 * scaleMultiplier, 
                                       90 * scaleMultiplier, Library.selectAsset);
        }
    }
    
    // Depois adiciona biblioteca padrão
    Library.addHR(div);
    Library.displayLibAssets(MediaLib.sprites);
}
```

#### Função: `Library.addAssetThumbChoose()` (Line 175 em Library.js)
```javascript
static addAssetThumbChoose (parent, aa, w, h, fcn) {
    var data = Library.parseAssetData(aa);
    var tb = document.createElement('div');
    
    tb.md5 = data.md5;
    tb.scale = (!data.scale) ? 0.5 : data.scale;
    tb.fieldname = data.name;
    tb.w = Number(data.width);      // ⚠️ USA WIDTH DO BANCO
    tb.h = Number(data.height);     // ⚠️ USA HEIGHT DO BANCO
    
    // Carrega THUMBNAIL do banco
    var img = newHTML('img', undefined, tb);
    if (data.altmd5) {
        IO.getAsset(data.altmd5, function (dataurl) {
            img.src = dataurl;  // ← EXIBE PNG
        });
    }
    
    tb.onmousedown = function (evt) {
        fcn(evt, tb);
    };
}
```

---

## ⚠️ **PROBLEMAS IDENTIFIC​ADOS**

### Problema 1: HEIGHT/WIDTH não salvo corretamente
```javascript
// Em Paint.addToLib (line 1352):
var box = SVGTools.getBox(gn('layer1')).rounded();
box = box.expandBy(20);
var w = box.width.toString();    // ← PODE SER UNDEFINED
var h = box.height.toString();   // ← PODE SER UNDEFINED
```

**Solução:** Validar que `SVGTools.getBox()` retorna size válido:
```javascript
if (!box || !box.width || !box.height) {
    console.error('❌ Erro: SVGTools.getBox() retornou box inválido');
    w = workspaceWidth.toString();
    h = workspaceHeight.toString();
}
```

### Problema 2: OWNER field não está sendo salvo
```javascript
// No SQL de INSERT (line 1370), OWNER field NÃO aparece:
json.stmt = 'insert into usershapes (scale, md5, altmd5, version, width, height, ext, name) 
             values (?,?,?,?,?,?,?,?)';
             
// Schema define OWNER mas não está sendo preenchido:
CREATE TABLE USERSHAPES (
    ...
    OWNER TEXT,  ← Field criado mas não usado
    ...
);
```

**Solução:** Adicionar OWNER ao INSERT:
```javascript
static addToLib (fcn) {
    var ownerName = ScratchJr.owner || 'guest';  // Get current user
    
    function setCostumeRecord (pngmd5) {
        var json = {
            stmt: 'insert into usershapes (scale, md5, altmd5, version, width, height, ext, name, owner) 
                   values (?,?,?,?,?,?,?,?,?)',
            values: [scale, saveMD5, pngmd5, ScratchJr.version, w, h, 'svg', cname, ownerName]
        };
        iOS.stmt(json, fcn);
    }
}
```

### Problema 3: PNG thumbnail não está sendo gerado
```javascript
// Em Paint.addToLib (line 1360):
var dataurl = IO.getThumbnail(svgdata, w, h, 120, 90);
var pngBase64 = dataurl.split(',')[1];
iOS.setmedia(pngBase64, 'png', setCostumeRecord);  // ← Pode estar falhando
```

**Checklist:**
- [ ] `IO.getThumbnail()` está gerando PNG válido?
- [ ] `iOS.setmedia()` está salvando o PNG?
- [ ] `pngmd5` está sendo retornado corretamente?

**Debug:**
```javascript
iOS.setmedia(pngBase64, 'png', function(pngmd5) {
    console.log('[Paint.addToLib] PNG MD5:', pngmd5);
    if (!pngmd5) {
        console.error('❌ Erro: PNG não foi salvo, pngmd5 é null');
    }
    setCostumeRecord(pngmd5);
});
```

### Problema 4: IO.getAsset() não consegue carregar o PNG
```javascript
// Em Library.addAssetThumbChoose (line 197):
if (data.altmd5) {
    IO.getAsset(data.altmd5, function (dataurl) {
        img.src = dataurl;
    });
}
```

**Possíveis causas:**
- `altmd5` é null ou undefined
- Arquivo PNG não foi salvo corretamente
- `IO.getAsset()` está procurando no caminho errado

**Debug:**
```javascript
static addAssetThumbChoose (parent, aa, w, h, fcn) {
    var data = Library.parseAssetData(aa);
    console.log('[Library] Asset data:', data);
    
    if (!data.altmd5) {
        console.error('❌ Erro: altmd5 é null/undefined para:', data.md5);
    }
    
    var img = newHTML('img', undefined, tb);
    if (data.altmd5) {
        IO.getAsset(data.altmd5, function (dataurl) {
            if (!dataurl) {
                console.error('❌ Erro: IO.getAsset() retornou null para:', data.altmd5);
                img.src = 'data:image/svg+xml,' + data.md5;  // Fallback
            } else {
                img.src = dataurl;
            }
        });
    }
}
```

---

## ✅ **CHECKLIST PARA RESOLVER**

### 1. Verify Paint Save Process
```
☐ Abrir Paint editor e desenhar
☐ Sair e clicar "Yes" para salvar
☐ Verificar console para erros
☐ Confirmar que INSERT aconteceu no USERSHAPES
```

### 2. Verify Database State
```
☐ Executar query: SELECT * FROM USERSHAPES;
☐ Verificar se registro foi inserido
☐ Confirmar que width/height não são NULL
☐ Confirmar que altmd5 (PNG MD5) não é NULL
```

### 3. Verify Thumbnail Loading
```
☐ Verificar query: SELECT altmd5 FROM USERSHAPES WHERE md5 = 'XXX';
☐ Confirmar que file existe em PROJECTFILES com esse MD5
☐ Verificar console em Library.addAssetThumbChoose()
```

### 4. Add Debug Logging
```javascript
// No Paint.js addToLib():
console.log('[Paint.addToLib] SVG MD5:', saveMD5);
console.log('[Paint.addToLib] PNG MD5:', pngmd5);
console.log('[Paint.addToLib] Width/Height:', w, h);
console.log('[Paint.addToLib] Costume name:', cname);

// No Library.js displayAssets():
console.log('[Library.displayAssets] Query result:', data);
console.log('[Library.displayAssets] Found', data.length, 'custom assets');

// No Library.js addAssetThumbChoose():
console.log('[Library] Loading asset:', data.md5, data.altmd5);
```

### 5. Test Flow Completo
```
1. Criar sprite novo
2. Desenhar algo
3. Salvar com nome
4. Sair do paint
5. Abrir biblioteca de costumes
6. Verificar se aparece na galeria
7. Clicar e usar em outro sprite
```

---

## 📋 Tabla USERSHAPES Schema

```sql
CREATE TABLE USERSHAPES (
    ID INTEGER PRIMARY KEY AUTOINCREMENT,
    CTIME DATETIME DEFAULT CURRENT_TIMESTAMP,
    MD5 TEXT,           ← SVG content (stored in PROJECTFILES)
    ALTMD5 TEXT,        ← PNG thumbnail (stored in PROJECTFILES)
    WIDTH TEXT,         ← Bounding box width
    HEIGHT TEXT,        ← Bounding box height
    EXT TEXT,           ← File type ('svg')
    NAME TEXT,          ← User-friendly name
    OWNER TEXT,         ← User who created (NOT FILLED!)
    SCALE TEXT,         ← 0.5 (default)
    VERSION TEXT        ← App version
);
```

---

## 🔍 Complete Salva Flow Diagram

```
1. Paint Editor
   └─> user draws + saves
       └─> Paint.saveSprite()
           ├─> SVGTools.saveShape()         [Convert to SVG string]
           ├─> IO.setMedia('svg')           [Save SVG → MD5]
           └─> Paint.addToLib()             [INSERT to DB]
               ├─> SVGTools.getBox()        [Get dimensions]
               ├─> IO.getThumbnail()        [Create PNG]
               ├─> iOS.setmedia('png')      [Save PNG → MD5]
               └─> iOS.stmt(INSERT)         [Insert to USERSHAPES]

2. Library Gallery
   └─> User opens "Choose Costume"
       └─> Library.open('costumes')
           ├─> Library.addThumbnails()
           │   └─> IO.query(usershapes)    [SELECT custom shapes]
           └─> Library.displayAssets()
               └─> Library.addAssetThumbChoose()
                   └─> IO.getAsset(altmd5) [Load PNG thumbnail]
                       └─> Display in gallery
```
