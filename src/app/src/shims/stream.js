/**
 * Shim para Node.js 'stream' module
 * Não existe em browser, mas algumas bibliotecas tentam usar
 */

export class Readable {
    constructor() {}
}

export class Writable {
    constructor() {}
}

export class Transform {
    constructor() {}
}

export default {
    Readable,
    Writable,
    Transform
};
