/**
 * Shim para JSZip
 * Permite que IO.js carregue sem erros de módulo
 * 
 * Para uso real de ZIP, seria necessário usar uma biblioteca
 * compatível com browser como `fflate` ou `pako`
 */

class JSZipShim {
    constructor() {
        this.files = {};
    }
    
    file(name, data) {
        this.files[name] = data;
        return this;
    }
    
    async(method) {
        // Mock para manter compatibilidade
        return this;
    }
    
    generateAsync(options) {
        // Retorna uma Promise com um Blob vazio
        return Promise.resolve(new Blob([''], { type: 'application/zip' }));
    }
    
    async folder(name) {
        return this;
    }
    
    async loadAsync(data) {
        // Mock para carregamento
        return this;
    }
}

export default JSZipShim;
