function canvas(width, height) {
    var result = document.createElement('canvas');
    result.width = width;
    result.height = height;
    return result;
}

async function readyImage(image) {
    if (!image) throw new Error('Imagem do personagem indisponível.');
    if (!image.complete) {
        await new Promise((resolve, reject) => {
            var timer = setTimeout(() => finish(new Error('Tempo esgotado ao carregar imagem.')), 20000);
            function finish(error) {
                clearTimeout(timer);
                image.removeEventListener('load', loaded);
                image.removeEventListener('error', failed);
                if (error) reject(error); else resolve();
            }
            function loaded() { finish(); }
            function failed() { finish(new Error('Falha ao carregar imagem.')); }
            image.addEventListener('load', loaded, {once: true});
            image.addEventListener('error', failed, {once: true});
        });
    }
    if (image.decode) await image.decode();
    if (!image.naturalWidth) throw new Error('Imagem vazia.');
}

export async function captureActor(sprite) {
    var image = sprite.originalImg || sprite.img;
    await readyImage(image);
    var ratio = Math.min(1, 2048 / image.naturalWidth, 2048 / image.naturalHeight);
    var output = canvas(Math.max(1, Math.round(image.naturalWidth * ratio)),
        Math.max(1, Math.round(image.naturalHeight * ratio)));
    output.getContext('2d').drawImage(image, 0, 0, output.width, output.height);
    return output.toDataURL('image/png');
}

export async function waitForScene(page) {
    for (var image of page.div.querySelectorAll('img')) await readyImage(image);
    for (var element of page.div.children) {
        if (element.owner && element.owner.type === 'sprite') {
            await readyImage(element.owner.originalImg || element.owner.img);
        }
    }
}

export function scriptBounds(rects) {
    var visible = rects.filter(rect => rect.width > 0 && rect.height > 0);
    if (!visible.length) return {x: 0, y: 0, width: 480, height: 120, scale: 1};
    var x = Math.floor(Math.min(...visible.map(rect => rect.x))) - 16;
    var y = Math.floor(Math.min(...visible.map(rect => rect.y))) - 16;
    var width = Math.ceil(Math.max(...visible.map(rect => rect.x + rect.width))) - x + 16;
    var height = Math.ceil(Math.max(...visible.map(rect => rect.y + rect.height))) - y + 16;
    var scale = Math.min(1, 4096 / width, 16384 / height, Math.sqrt(32000000 / (width * height)));
    return {x, y, width, height, scale};
}

async function resourceDataURL(url) {
    if (url.startsWith('data:')) return url;
    var response = await fetch(url);
    if (!response.ok) throw new Error('Não foi possível carregar um recurso dos blocos.');
    var blob = await response.blob();
    return new Promise((resolve, reject) => {
        var reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

export async function captureScripts(source) {
    if (!source) throw new Error('Programação do ator não encontrada.');
    if (document.fonts) await document.fonts.ready;
    var resources = new Map();
    async function cloneNode(node) {
        if (node.nodeType === Node.TEXT_NODE) return node.cloneNode();
        if (node.nodeType !== Node.ELEMENT_NODE || (node.owner && node.owner.isCaret)) return null;
        var style = getComputedStyle(node);
        if (style.display === 'none' && node !== source) return null;
        var clone;
        if (node.tagName === 'CANVAS') {
            clone = document.createElement('img');
            clone.src = node.toDataURL('image/png');
        } else {
            clone = node.cloneNode(false);
        }
        clone.removeAttribute('id');
        for (var attribute of Array.from(clone.attributes)) {
            if (attribute.name.startsWith('on')) clone.removeAttribute(attribute.name);
        }
        for (var property of Array.from(style)) clone.style.setProperty(property, style.getPropertyValue(property));
        clone.style.visibility = 'visible';
        clone.style.animation = 'none';
        clone.style.transition = 'none';
        if (node.tagName === 'IMG') {
            await readyImage(node);
            var imageCanvas = canvas(node.naturalWidth, node.naturalHeight);
            imageCanvas.getContext('2d').drawImage(node, 0, 0);
            clone.src = imageCanvas.toDataURL('image/png');
        }
        var background = clone.style.backgroundImage;
        for (var match of background.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
            var url = match[1];
            if (!resources.has(url)) resources.set(url, resourceDataURL(url));
            background = background.replace(match[0], 'url("' + await resources.get(url) + '")');
        }
        clone.style.backgroundImage = background;
        if (node.tagName !== 'CANVAS') {
            for (var child of node.childNodes) {
                var copied = await cloneNode(child);
                if (copied) clone.appendChild(copied);
            }
        }
        return clone;
    }
    var clone = await cloneNode(source);
    // The script pane itself may be display:none while another actor is selected.
    if (!clone) {
        throw new Error('Painel de programação indisponível para captura.');
    }
    var host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none;z-index:-1;';
    clone.style.position = 'relative';
    clone.style.left = '0px';
    clone.style.top = '0px';
    clone.style.transform = 'none';
    clone.style.visibility = 'visible';
    clone.style.display = 'block';
    clone.style.overflow = 'visible';
    clone.style.background = 'transparent';
    host.appendChild(clone);
    document.body.appendChild(host);
    try {
        for (var img of clone.querySelectorAll('img')) await readyImage(img);
        var origin = clone.getBoundingClientRect();
        var rects = Array.from(clone.querySelectorAll('*')).map(element => {
            var rect = element.getBoundingClientRect();
            return {x: rect.left - origin.left, y: rect.top - origin.top, width: rect.width, height: rect.height};
        });
        var bounds = scriptBounds(rects);
        var output = canvas(Math.max(1, Math.floor(bounds.width * bounds.scale)),
            Math.max(1, Math.floor(bounds.height * bounds.scale)));
        if (!rects.some(rect => rect.width && rect.height)) {
            var context = output.getContext('2d');
            context.fillStyle = 'white';
            context.fillRect(0, 0, output.width, output.height);
            context.fillStyle = '#333';
            context.font = '20px Arial';
            context.fillText('Sem programação', 20, 60);
            return output.toDataURL('image/png');
        }
        clone.style.transform = 'translate(' + (-bounds.x) + 'px,' + (-bounds.y) + 'px)';
        var wrapper = document.createElement('div');
        wrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
        wrapper.style.cssText = 'width:' + bounds.width + 'px;height:' + bounds.height + 'px;background:white;overflow:hidden;';
        wrapper.appendChild(clone);
        var markup = new XMLSerializer().serializeToString(wrapper);
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + output.width + '" height="' + output.height +
            '" viewBox="0 0 ' + bounds.width + ' ' + bounds.height + '"><foreignObject width="' + bounds.width +
            '" height="' + bounds.height + '">' + markup + '</foreignObject></svg>';
        var rendered = new Image();
        rendered.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        await readyImage(rendered);
        output.getContext('2d').drawImage(rendered, 0, 0);
        return output.toDataURL('image/png');
    } finally {
        host.remove();
    }
}
