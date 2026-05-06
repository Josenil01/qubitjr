/**
 * Shim para Snap.SVG
 * Permite que Ghost.js (editor de pintura) carregue sem erros
 * 
 * Snap.SVG é usado para hit testing no editor de pintura
 * Para versão web inicial, isso não é crítico
 */

class SnapShim {
    constructor(element) {
        this.element = element;
        this.paper = new SnapPaper(element);
    }
    
    static select(element) {
        return new SnapShim(element);
    }
    
    circle(cx, cy, r) {
        return new SnapElement('circle');
    }
    
    ellipse(cx, cy, rx, ry) {
        return new SnapElement('ellipse');
    }
    
    rect(x, y, w, h, rx, ry) {
        return new SnapElement('rect');
    }
    
    path(d) {
        return new SnapElement('path');
    }
    
    text(x, y, text) {
        return new SnapElement('text');
    }
    
    g(...args) {
        return new SnapElement('g');
    }
    
    forEach(callback) {
        return this;
    }
}

class SnapPaper {
    constructor(element) {
        this.element = element;
    }
}

class SnapElement {
    constructor(tag) {
        this.tag = tag;
        this.attrs = {};
    }
    
    attr(name, value) {
        if (typeof name === 'object') {
            Object.assign(this.attrs, name);
        } else {
            this.attrs[name] = value;
        }
        return this;
    }
    
    click(callback) {
        return this;
    }
    
    drag(onmove, onstart, onend) {
        return this;
    }
    
    getBBox() {
        return { x: 0, y: 0, w: 0, h: 0, width: 0, height: 0 };
    }
    
    remove() {
        return this;
    }
    
    append(child) {
        return this;
    }
    
    parent() {
        return new SnapElement('g');
    }
}

// Exportar como default
export default SnapShim;
