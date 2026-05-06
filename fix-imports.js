#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      walkDir(fullPath);
    } else if (file.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const original = content;
      
      // Adicionar .js aos imports relativos que não o têm
      content = content.replace(/from\s+['\"](\.[^'\"]*)['\"](?!\.js)/g, "from '$1.js'");
      
      if (content !== original) {
        fs.writeFileSync(fullPath, content);
        console.log('✓ ' + path.basename(fullPath));
      }
    }
  });
}

const srcDir = path.join(__dirname, 'src', 'app', 'src');
walkDir(srcDir);
console.log('\n✅ Todos os imports foram corrigidos!');
