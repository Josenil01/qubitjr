import { defineConfig } from 'vite'
import fs from 'fs'
import path from 'path'

// Plugin para servir CSS raw (sem PostCSS) para arquivos com template literals
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
        const content = fs.readFileSync(id, 'utf-8')
        if (content.includes('${')) {
          // Retorna CSS vazio para evitar erro no PostCSS
          // O app carrega estes arquivos dinamicamente via preprocessAndLoadCss
          return '/* template literal CSS - loaded dynamically */'
        }
      } catch (e) { /* ignore */ }
    }
  },
  writeBundle(options) {
    // Copia os CSS originais com template literals para o dist
    const cssDir = path.resolve(process.cwd(), 'src/app/css')
    const outDir = path.resolve(options.dir || path.resolve(process.cwd(), 'dist'), 'css')
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
    fs.readdirSync(cssDir).forEach(file => {
      if (file.endsWith('.css')) {
        const content = fs.readFileSync(path.join(cssDir, file), 'utf-8')
        if (content.includes('${')) {
          fs.writeFileSync(path.join(outDir, file), content)
        }
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
    minify: 'esbuild'
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
  plugins: [serveCssRawMiddleware, handleTemplateLiteralCss, resolveJsExtensionPlugin]
})
