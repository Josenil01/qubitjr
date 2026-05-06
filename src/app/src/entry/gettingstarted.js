import {gn, isiOS, getUrlVars} from '../utils/lib.js';

let place;

export function gettingStartedMain () { // eslint-disable-line import/prefer-default-export
    gn('closeHelp').onclick = gettingStartedCloseMe;
    gn('closeHelp').onmousedown = gettingStartedCloseMe;
    var videoObj = gn('myVideo');
    if (isiOS) {
        // On iOS we can load from server
        videoObj.src = 'assets/lobby/intro.mp4';
    } else {
        // On Android we need to copy to a temporary directory first:
        setTimeout(function () {
            videoObj.type = 'video/mp4';
            videoObj.src = AndroidInterface.scratchjr_getgettingstartedvideopath();
        }, 1000);
    }
    videoObj.poster = 'assets/lobby/poster.png';

    // Verificar se há um lugar definido globalmente (pelo Router)
    var urlvars = getUrlVars();
    place = window.currentStartingPlace || urlvars.place;
    // Limpar a variável global após usar
    window.currentStartingPlace = null;
    document.onmousemove = function (e){
        e.preventDefault();
    };
}


function gettingStartedCloseMe () {
    // Use SPA Router para navegar de volta ao lobby
    window.currentLobbyPlace = place; // Preservar o lugar de início
    window.ScratchJrRouter.navigateTo('lobby');
}
