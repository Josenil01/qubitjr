/**
 * PNGCache - Pré-carrega e cacheia PNGs para watermarks
 * Evita problemas de sincronização assíncrona ao renderizar sprites
 */

class PNGCache {
    constructor() {
        this.cache = {}; // {spriteName: canvasElement}
        this.loading = {}; // {spriteName: Promise}
    }

    /**
     * Carregar uma PNG e armazená-la como canvas
     * @param {string} spriteName - nome da sprite (ex: "Ruby", "Allan")
     * @returns {Promise<HTMLCanvasElement>}
     */
    async loadPNG(spriteName) {
        // Se já está em cache, retornar imediatamente
        if (this.cache[spriteName]) {
            return this.cache[spriteName];
        }

        // Se já está carregando, retornar a promise existente
        if (this.loading[spriteName]) {
            return this.loading[spriteName];
        }

        // Criar nova promise de carregamento
        this.loading[spriteName] = new Promise((resolve, reject) => {
            const img = new Image();

            img.onload = () => {
                // Criar canvas com a imagem
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                
                // Armazenar em cache
                this.cache[spriteName] = canvas;
                
                // Limpar da fila de loading
                delete this.loading[spriteName];
                
                resolve(canvas);
            };
            
            img.onerror = () => {
                console.warn(`[PNGCache.loadPNG] Erro: ${spriteName}`);
                delete this.loading[spriteName];
                reject(new Error(`Could not load PNG: ${spriteName}`));
            };
            
            // Tentar carregar de ./pnglibrary/
            const path = './pnglibrary/' + spriteName + '.png';
            img.src = path;
        });

        return this.loading[spriteName];
    }

    /**
     * Obter PNG do cache de forma síncrona
     * @param {string} spriteName - nome da sprite
     * @returns {HTMLCanvasElement|null} canvas ou null se não estiver cachado
     */
    get(spriteName) {
        return this.cache[spriteName] || null;
    }

    /**
     * Pré-carregar várias PNGs (chamado na inicialização)
     * @param {Array<string>} spriteNames - lista de nomes de sprites
     * @returns {Promise<void>}
     */
    async preload(spriteNames) {
        const promises = spriteNames.map(name =>
            this.loadPNG(name).catch(err => {
                // Não falhar se uma PNG não conseguir carregar
                console.warn('[PNGCache]', err.message);
            })
        );

        await Promise.all(promises);
    }

    /**
     * Limpar cache (para debug ou memória)
     */
    clear() {
        this.cache = {};
        this.loading = {};
    }
}

// Exportar instância global
export default new PNGCache();
