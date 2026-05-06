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
            console.log(`[PNGCache.loadPNG] "${spriteName}" já está em cache`);
            return this.cache[spriteName];
        }

        // Se já está carregando, retornar a promise existente
        if (this.loading[spriteName]) {
            console.log(`[PNGCache.loadPNG] "${spriteName}" já está carregando...`);
            return this.loading[spriteName];
        }

        // Criar nova promise de carregamento
        console.log(`[PNGCache.loadPNG] Iniciando carregamento de "${spriteName}"`);
        this.loading[spriteName] = new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => {
                console.log(`[PNGCache.loadPNG] Sucesso: "${spriteName}" (${img.width}x${img.height})`);
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
            console.log(`[PNGCache.loadPNG] Buscando: ${path}`);
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
        const cached = this.cache[spriteName];
        console.log(`[PNGCache.get] Buscando: "${spriteName}"`, cached ? '✅ ENCONTRADO' : '❌ NÃO ENCONTRADO', 'Cache:', Object.keys(this.cache));
        return cached || null;
    }

    /**
     * Pré-carregar várias PNGs (chamado na inicialização)
     * @param {Array<string>} spriteNames - lista de nomes de sprites
     * @returns {Promise<void>}
     */
    async preload(spriteNames) {
        console.log('[PNGCache.preload] Iniciando pré-carregamento de', spriteNames.length, 'PNGs:', spriteNames);
        
        const promises = spriteNames.map(name => 
            this.loadPNG(name).catch(err => {
                // Não falhar se uma PNG não conseguir carregar
                console.warn('[PNGCache]', err.message);
            })
        );
        
        await Promise.all(promises);
        console.log('[PNGCache.preload] ✅ Pré-carregamento concluído. Cache:', Object.keys(this.cache));
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
