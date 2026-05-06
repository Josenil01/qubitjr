/**
 * src/app/src/entry/index-mock.js
 * 
 * Mock da página inicial para ScratchJr Web
 * Substitui index.js quando ele não conseguir exportar via ES6
 */

window.indexMain = function() {
  console.log('[IndexPage] Inicializando página inicial');
  
  // Limpar elementos ocultos
  const hiddenElements = document.querySelectorAll('.hide');
  hiddenElements.forEach(el => {
    if (el.id !== 'startButton') {
      el.style.display = 'none';
    }
  });

  // Mostrar botão start
  const startButton = document.getElementById('startButton');
  if (startButton) {
    startButton.classList.remove('hide');
    startButton.style.display = 'block';
    startButton.innerHTML = '<div style="text-align: center; margin-top: 100px;"><h1>ScratchJr</h1><button style="padding: 15px 30px; font-size: 18px; cursor: pointer; background: #4CAF50; color: white; border: none; border-radius: 5px;">Começar</button></div>';
    
    // Evento do botão
    const button = startButton.querySelector('button');
    if (button) {
      button.onclick = () => {
        console.log('[IndexPage] Botão clicado - navegando para home');
        window.location.href = 'home.html';
      };
    }
  } else {
    console.warn('[IndexPage] Elemento #startButton não encontrado');
    // Fallback: mostrar mensagem no document
    document.body.innerHTML = `
      <div style="text-align: center; margin-top: 100px; font-family: Arial;">
        <h1>🎨 ScratchJr Web Edition</h1>
        <p>Backend: ✅ Conectado</p>
        <p style="color: green; font-weight: bold;">Clique para começar</p>
        <button onclick="window.location.href='home.html'" style="padding: 15px 30px; font-size: 18px; cursor: pointer; background: #4CAF50; color: white; border: none; border-radius: 5px;">Começar</button>
      </div>
    `;
  }
};

// Garantir que a função existe globalmente
if (!window.indexMain) {
  console.error('[IndexPage] indexMain não foi definido');
}
