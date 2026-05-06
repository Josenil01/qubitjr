import ScratchAudio from '../utils/ScratchAudio.js';
import {gn, getUrlVars, isAndroid, isiOS} from '../utils/lib.js';
import iOS from '../iPad/iOS.js';
import UI from '../editor/ui/UI.js';
import Localization from '../utils/Localization.js';
import AppUsage from '../utils/AppUsage.js';

export function indexMain () { // eslint-disable-line import/prefer-default-export
    // Verificar se elementos existem antes de acessar (para SPA com múltiplas páginas no DOM)
    const gettingsEl = gn('gettings');
    if (gettingsEl) gettingsEl.onmousedown = indexGettingstarted;
    
    const startcodeEl = gn('startcode');
    if (startcodeEl) startcodeEl.onmousedown = indexGohome;
    
    ScratchAudio.init();
    var urlvars = getUrlVars();
    if (urlvars.back) {
        indexLoadOptions();
    } else {
        indexFirstTime();
    }

    if (window.Settings.edition == 'PBS') {
        const topbarMoreApps = gn('topbar-moreapps');
        if (topbarMoreApps) topbarMoreApps.textContent = Localization.localize('PBS_MORE_APPS');
        
        const startButton = gn('startButton');
        if (startButton) startButton.textContent = Localization.localize('PBS_START');
        
        if (gettingsEl) gettingsEl.textContent = Localization.localize('PBS_HOW_TO');
        
        if (startButton) startButton.onmousedown = indexGohome;
        
        const pbschars = gn('pbschars');
        if (pbschars) pbschars.onmousedown = indexGohome;

        if (topbarMoreApps) topbarMoreApps.onmousedown = indexMoreApps;
        if (topbarMoreApps) topbarMoreApps.onmousedown = indexGoSettings;
        const topbarInfo = gn('topbar-info');
        if (topbarInfo) topbarInfo.onmousedown = indexInfo;
    } else {
        const gearEl = gn('gear');
        if (gearEl) gearEl.onmousedown = indexGoSettings;
    }

    setTimeout(function () {
        const raysEl = gn('rays');
        if (raysEl) raysEl.className = 'rays spinme';
    }, 250);
}

function indexFirstTime () {
    // Verificações null para SPA com múltiplas páginas no DOM
    const authorsEl = gn('authors');
    if (authorsEl) authorsEl.className = 'credits show';
    
    const authorsTextEl = gn('authorsText');
    if (authorsTextEl) authorsTextEl.className = 'creditsText show';
    
    if (window.Settings.edition == 'PBS') {
        const pbscharsEl = gn('pbschars');
        if (pbscharsEl) pbscharsEl.className = 'characters hide';
        
        const startcodeEl = gn('startcode');
        if (startcodeEl) startcodeEl.className = 'catlogo show';
        
        const topbarEl = gn('topbar');
        if (topbarEl) topbarEl.className = 'topbar hide';
        
        const startButtonEl = gn('startButton');
        if (startButtonEl) startButtonEl.className = 'startButton hide';
    } else {
        const purpleguyEl = gn('purpleguy');
        if (purpleguyEl) purpleguyEl.className = 'purple show';
        
        const blueguyEl = gn('blueguy');
        if (blueguyEl) blueguyEl.className = 'blue show';
        
        const redguyEl = gn('redguy');
        if (redguyEl) redguyEl.className = 'red show';
    }
    iOS.askpermission(); // ask for sound recording
    
   
    setTimeout(function () {
        indexLoadOptions();
    }, /*SPLASH SCREEN LOAD DELAY*/3000);
    
}

function indexLoadOptions () {
    if (window.Settings.edition != 'PBS' && AppUsage.askForUsage()) {
        indexLoadUsage();
    } else {
        indexLoadStart();
    }
    
}

function indexLoadStart (afterUsage) {
    // Verificações null para SPA
    const authorsEl = gn('authors');
    if (authorsEl) authorsEl.className = 'credits hide';
    
    const authorsTextEl = gn('authorsText');
    if (authorsTextEl) authorsTextEl.className = 'creditsText hide';

    if (window.Settings.edition == 'PBS') {
        const pbscharsEl = gn('pbschars');
        if (pbscharsEl) pbscharsEl.className = 'characters show';
        
        const topbarEl = gn('topbar');
        if (topbarEl) topbarEl.className = 'topbar show';
        
        const startButtonEl = gn('startButton');
        if (startButtonEl) startButtonEl.className = 'startButton show';
    } else {
        const purpleguyEl = gn('purpleguy');
        if (purpleguyEl) purpleguyEl.className = 'purple hide';
        
        const blueguyEl = gn('blueguy');
        if (blueguyEl) blueguyEl.className = 'blue hide';
        
        const redguyEl = gn('redguy');
        if (redguyEl) redguyEl.className = 'red hide';
        
        const gearEl = gn('gear');
        if (gearEl) gearEl.className = 'gear show';
        
        if (afterUsage) {
            const catfaceEl = gn('catface');
            if (catfaceEl) catfaceEl.className = 'catface show';
            
            const jrlogoEl = gn('jrlogo');
            if (jrlogoEl) jrlogoEl.className = 'jrlogo show';
            
            const usageQuestionEl = gn('usageQuestion');
            if (usageQuestionEl) usageQuestionEl.className = 'usageQuestion hide';
            
            const usageSchoolEl = gn('usageSchool');
            if (usageSchoolEl) usageSchoolEl.className = 'usageSchool hide';
            
            const usageHomeEl = gn('usageHome');
            if (usageHomeEl) usageHomeEl.className = 'usageHome hide';
            
            const usageOtherEl = gn('usageOther');
            if (usageOtherEl) usageOtherEl.className = 'usageOther hide';
            
            const usageNoanswerEl = gn('usageNoanswer');
            if (usageNoanswerEl) usageNoanswerEl.className = 'usageNoanswer hide';
        }
    }
    
    const gettingsEl = gn('gettings');
    if (gettingsEl) gettingsEl.className = 'gettings show';
    
    const startcodeEl = gn('startcode');
    if (startcodeEl) startcodeEl.className = 'startcode show';
    document.onmousemove = function (e) {
        e.preventDefault();
    };
    if (isAndroid) {
        AndroidInterface.notifySplashDone();
    }
}

function indexLoadUsage() {
    // Verificações null para SPA
    const authorsEl = gn('authors');
    if (authorsEl) authorsEl.className = 'credits show';
    
    const authorsTextEl = gn('authorsText');
    if (authorsTextEl) authorsTextEl.className = 'creditsText hide';
    
    const purpleguyEl = gn('purpleguy');
    if (purpleguyEl) purpleguyEl.className = 'purple hide';
    
    const blueguyEl = gn('blueguy');
    if (blueguyEl) blueguyEl.className = 'blue hide';
    
    const redguyEl = gn('redguy');
    if (redguyEl) redguyEl.className = 'red hide';
    
    const catfaceEl = gn('catface');
    if (catfaceEl) catfaceEl.className = 'catface hide';
    
    const jrlogoEl = gn('jrlogo');
    if (jrlogoEl) jrlogoEl.className = 'jrlogo hide';
    
    
    const usageQuestionEl = gn('usageQuestion');
    if (usageQuestionEl) usageQuestionEl.textContent = Localization.localize('USAGE_QUESTION');
    
    const useSchoolTextEl = gn('useSchoolText');
    if (useSchoolTextEl) useSchoolTextEl.textContent = Localization.localize('USAGE_SCHOOL');
    gn('useHomeText').textContent = Localization.localize('USAGE_HOME');
    gn('useOtherText').textContent = Localization.localize('USAGE_OTHER');
    gn('usageNoanswerText').textContent = Localization.localize('USAGE_NONE');
    
    gn('usageQuestion').className = 'usageQuestion show';
    gn('usageSchool').className = 'usageSchool show';
    gn('usageHome').className = 'usageHome show';
    gn('usageOther').className = 'usageOther show';
    gn('usageNoanswer').className = 'usageNoanswer show';
    gn('usageSchool').onmousedown = indexSetUsage;
    gn('usageHome').onmousedown = indexSetUsage;
    gn('usageOther').onmousedown = indexSetUsage;
    gn('usageNoanswer').onmousedown = indexSetUsage;

}

function setClassOfElementById(id, className) { // eslint-disable-line no-unused-vars
	let element = gn(id);
		
	if (!element) {
		return;
	}
	
	element.className = className;
	
}

function indexGohome () {
    iOS.setfile('homescroll.sjr', 0, function () {
        doNext();
    });
    function doNext () {
        // Use SPA Router para navegar sem reload
        window.ScratchJrRouter.navigateTo('lobby');
    }
}

function indexGoSettings () {
    // Switch to the settings selection page
    // Triggered by tapping the gear icon in the top right
    ScratchAudio.sndFX('tap.wav');
    // Use SPA Router para navegar e marcar que devemos iniciar na aba gear
    window.currentLobbyPlace = 'gear';
    window.ScratchJrRouter.navigateTo('lobby');
}

function indexGettingstarted () {
    ScratchAudio.sndFX('tap.wav');
    // Use SPA Router para navegar para página Getting Started
    window.ScratchJrRouter.navigateTo('starting');
}

function indexSetUsage (e) {
    var usageText = '';

    switch (e.target.parentElement.id) {
    case 'usageSchool':
        usageText = 'school';
        break;
    case 'usageHome':
        usageText = 'home';
        break;
    case 'usageOther':
        usageText = 'other';
        break;
    case 'usageNoanswer':
        usageText = 'noanswer';
        break;
    }
    // Send one-time analytics event about usage
    iOS.analyticsEvent('lobby', 'scratchjr_usage', usageText);
    AppUsage.setUsage(usageText);
    ScratchAudio.sndFX('tap.wav');
    indexLoadStart(true);
}
// For PBS KIDS edition only
function indexInfo () {
    ScratchAudio.sndFX('tap.wav');
    // Use SPA Router para navegar e marcar que devemos iniciar na aba book
    window.currentLobbyPlace = 'book';
    window.ScratchJrRouter.navigateTo('lobby');
}

function indexMoreApps () {
    ScratchAudio.sndFX('tap.wav');

    UI.parentalGate(null, function () {
        if (isiOS) {
            window.location.href = 'https://itunes.apple.com/us/developer/pbs-kids/id324323339?mt=8';
        } else {
            window.location.href = 'http://to.pbs.org/ScJr_GPlay';
        }
    });
}
