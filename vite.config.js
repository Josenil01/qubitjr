import { defineConfig } from 'vite'
import fs from 'fs'
import path from 'path'

/**
 * Processa template literals CSS em tempo de build.
 * ${css_vh(N)} → Nvh  |  ${css_vw(N)} → Nvw
 * ${N * scaleMultiplier} → Npx  |  ${scaleMultiplier} → 1
 */
function processTemplateLiteralCss(content) {
  // ${css_vh(N)}px? → Nvh  (consume trailing px if present)
  content = content.replace(/\$\{css_vh\(([^)]+)\)\}(px)?/g, (_, n) => parseFloat(n).toFixed(3) + 'vh')
  content = content.replace(/\$\{css_vw\(([^)]+)\)\}(px)?/g, (_, n) => parseFloat(n).toFixed(3) + 'vw')
  // ${N * scaleMultiplier}px? → Npx  (consume trailing px to avoid pxpx)
  content = content.replace(/\$\{([0-9.]+)\s*\*\s*scaleMultiplier\}(px)?/g, (_, n) => parseFloat(n).toFixed(3) + 'px')
  // -${scaleMultiplier}px → -1px  (handles negative prefix)
  content = content.replace(/-\$\{scaleMultiplier\}(px)?/g, '-1px')
  // ${-scaleMultiplier}px → -1px
  content = content.replace(/\$\{-scaleMultiplier\}(px)?/g, '-1px')
  // ${scaleMultiplier}px? → 1px
  content = content.replace(/\$\{scaleMultiplier\}(px)?/g, '1px')
  // Fallback para qualquer expressão restante
  content = content.replace(/\$\{[^}]+\}(px)?/g, '1px')
  return content
}


const rawCssPlugin = {
  name: 'raw-css-loader',
  resolveId(id) {
    if (id.endsWith('.css?raw')) {
      return id
    }
  },
  load(id) {
    if (id.endsWith('.css?raw')) {
      const cssPath = id.replace('?raw', '')
      const fullPath = path.resolve(process.cwd(), 'src/app', cssPath)
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf-8')
        return `export default ${JSON.stringify(content)}`
      }
    }
  }
}

// Middleware para servir CSS estaticamente sem PostCSS
const serveCssRawMiddleware = {
  name: 'serve-css-raw',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      // Se é requisição a .css na pasta css/
      if (req.url && req.url.match(/^\/css\/[\w\-]+\.css$/)) {
        // Resolver o caminho relativo ao diretório src/app (o root configurado)
        const appRoot = path.resolve(process.cwd(), 'src/app')
        const filePath = path.join(appRoot, req.url)
        
        if (fs.existsSync(filePath)) {
          try {
            const content = fs.readFileSync(filePath, 'utf-8')
            res.setHeader('Content-Type', 'text/css; charset=utf-8')
            res.end(content)
            return
          } catch (err) {
            console.error(`Erro ao ler ${filePath}:`, err)
            res.statusCode = 500
            res.end('Erro ao ler CSS')
            return
          }
        }
      }
      next()
    })
  }
}

// Plugin para interceptar CSS com template literals (${css_vw()}) antes do PostCSS
const handleTemplateLiteralCss = {
  name: 'handle-template-literal-css',
  enforce: 'pre',
  load(id) {
    if (id.endsWith('.css') && !id.includes('node_modules')) {
      try {
        let content = fs.readFileSync(id, 'utf-8')
        if (content.includes('${')) {
          content = processTemplateLiteralCss(content)
          return content
        }
      } catch (e) { /* ignore */ }
    }
  },
  writeBundle(options) {
    // Também copia os CSS processados para o dist/css/ para acesso direto
    const cssDir = path.resolve(process.cwd(), 'src/app/css')
    const outDir = path.resolve(options.dir || path.resolve(process.cwd(), 'dist'), 'css')
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
    fs.readdirSync(cssDir).forEach(file => {
      if (file.endsWith('.css')) {
        let content = fs.readFileSync(path.join(cssDir, file), 'utf-8')
        if (content.includes('${')) {
          content = processTemplateLiteralCss(content)
        }
        fs.writeFileSync(path.join(outDir, file), content)
      }
    })
  }
}

// Função auxiliar para copiar diretórios recursivamente
function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true })
  fs.readdirSync(src).forEach(file => {
    const srcFile = path.join(src, file)
    const destFile = path.join(dest, file)
    if (fs.statSync(srcFile).isDirectory()) {
      copyDirSync(srcFile, destFile)
    } else {
      fs.copyFileSync(srcFile, destFile)
    }
  })
}

// Plugin para copiar assets estáticos para o dist
const copyStaticAssetsPlugin = {
  name: 'copy-static-assets',
  writeBundle(options) {
    const appDir = path.resolve(process.cwd(), 'src/app')
    const outDir = path.resolve(process.cwd(), 'dist')
    const staticDirs = ['sounds', 'pnglibrary', 'svglibrary', 'localizations', 'samples', 'inapp', 'css', 'assets']
    staticDirs.forEach(dir => {
      const src = path.join(appDir, dir)
      if (fs.existsSync(src)) {
        copyDirSync(src, path.join(outDir, dir))
        console.log(`[copy-static] Copiado: ${dir}`)
      }
    })
  }
}

// Plugin para resolver imports sem extensão .js
const resolveJsExtensionPlugin = {
  name: 'resolve-js-extension',
  resolveId(id) {
    if (!id.startsWith('.') && !id.startsWith('/')) return null
    if (id.includes('node_modules')) return null
    if (id.endsWith('.js') || id.endsWith('.json')) return null
    
    const root = process.cwd()
    const fullPath = path.resolve(root, 'src/app', id)
    
    // Tentar arquivo.js
    if (fs.existsSync(fullPath + '.js')) {
      return fullPath + '.js'
    }
    return null
  }
}

export default defineConfig({
  root: './src/app',
  server: {
    port: 3000,
    cors: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      }
    }
  },
  css: {
    postcss: {
      plugins: []
    }
  },
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    minify: 'esbuild',
    copyPublicDir: true,
    rollupOptions: {
      input: {
        index: path.resolve(process.cwd(), 'src/app/index.html'),
        home: path.resolve(process.cwd(), 'src/app/home.html'),
        editor: path.resolve(process.cwd(), 'src/app/editor.html'),
        gettingstarted: path.resolve(process.cwd(), 'src/app/gettingstarted.html'),
        player: path.resolve(process.cwd(), 'src/app/player.html'),
      },
      // Separa o player em chunk próprio para não misturar com o bundle do editor
      output: {
        manualChunks(id) {
          if (id.includes('playerEntry-vite') || id.includes('entry/player')) {
            return 'player-runtime';
          }
        }
      }
    }
  },
  resolve: {
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
    alias: {
      '@': '/src',
      'jszip': '/src/shims/jszip.js',
      'snapsvg': '/src/shims/snapsvg.js',
      'stream': '/src/shims/stream.js'
    }
  },
  plugins: [serveCssRawMiddleware, handleTemplateLiteralCss, copyStaticAssetsPlugin, resolveJsExtensionPlugin]
})
