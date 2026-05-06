// AppEntry - Entry point para ScratchJr Web
// Usa variáveis globais definidas em bootstrap.js

function loadSettings(settingsRoot, whenDone) {
	if (window.IO && window.IO.requestFromServer) {
		window.IO.requestFromServer(settingsRoot + 'settings.json', (result) => {
			try {
				window.Settings = JSON.parse(result);
			} catch (e) {
				console.warn('Erro ao parsear settings:', e);
			}
			whenDone();
		});
	} else {
		console.log('IO não disponível, usando settings padrão');
		whenDone();
	}
}

// App-wide entry-point
window.onload = () => {
	console.log('[AppEntry] Iniciando página:', window.scratchJrPage);
	loadPage(window.scratchJrPage);
};

function loadPage(page) {
	// Função que será executada após assets carregarem
	let entryFunction = () => {
		console.log('[AppEntry] Página iniciada:', page);
	};

	// Root directory para assets
	let root = './';
	
	// Carregar CSS baseado na página
	switch(page) {
	default:
	case 'index':
		// Página inicial (splash screen)
		if (window.preprocessAndLoadCss) {
			window.preprocessAndLoadCss('css', 'css/font.css');
			window.preprocessAndLoadCss('css', 'css/base.css');
			window.preprocessAndLoadCss('css', 'css/start.css');
			window.preprocessAndLoadCss('css', 'css/thumbs.css');
		}
		if (window.iOS && window.iOS.waitForInterface) {
			entryFunction = () => window.iOS.waitForInterface(window.indexMain || function() {});
		}
		break;
	case 'home':
		// Página de lobby
		if (window.preprocessAndLoadCss) {
			window.preprocessAndLoadCss('css', 'css/font.css');
			window.preprocessAndLoadCss('css', 'css/base.css');
			window.preprocessAndLoadCss('css', 'css/lobby.css');
		}
		if (window.iOS && window.iOS.waitForInterface) {
			entryFunction = () => window.iOS.waitForInterface(window.homeMain || function() {});
		}
		break;
	case 'editor':
		// Página do editor
		if (window.preprocessAndLoadCss) {
			window.preprocessAndLoadCss('css', 'css/font.css');
			window.preprocessAndLoadCss('css', 'css/base.css');
			window.preprocessAndLoadCss('css', 'css/editor.css');
		}
		if (window.iOS && window.iOS.waitForInterface) {
			entryFunction = () => window.iOS.waitForInterface(window.editorMain || function() {});
		}
		break;
	}

	// Sequência de inicialização
	loadSettings(root, () => {
		// Carregar localizações
		if (window.Localization && window.Localization.includeLocales) {
			window.Localization.includeLocales(root, () => {
				// Carregar Media Library
				if (window.MediaLib && window.MediaLib.loadMediaLib) {
					window.MediaLib.loadMediaLib(root, () => {
						entryFunction();
					});
				} else {
					entryFunction();
				}
			});
		} else {
			entryFunction();
		}

		// Inicializar AppUsage
		if (window.AppUsage && window.AppUsage.initUsage) {
			window.AppUsage.initUsage();
		}
	});
}
