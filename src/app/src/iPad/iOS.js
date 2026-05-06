import {isiOS, gn} from '../utils/lib.js';
import IO from './IO.js';
import Lobby from '../lobby/Lobby.js';
import Alert from '../editor/ui/Alert.js';
import ScratchAudio from '../utils/ScratchAudio.js';
import AppUsage from '../utils/AppUsage.js';

//////////////////////////////////////////////////
//  Tablet interface functions
//////////////////////////////////////////////////

// This file and object are named "iOS" for legacy reasons.
// But, it is also used for the AndroidInterface. All function calls here
// are mapped to Android/iOS native calls.

let path;
let camera;
let database = 'projects';
let mediacounter = 0;
// Usar a interface global definida por WebInterface.js
const getTabletInterface = () => window.tabletInterface || null;

export default class iOS {
    // Getters/setters for properties used in other classes
    static get path () {
        return path;
    }

    static set path (newPath) {
        path = newPath;
    }

    static get camera () {
        return camera;
    }

    static get database () {
        return database;
    }

    // Wait for the tablet interface to be injected into the webview
    static waitForInterface (fcn) {
        // Already loaded the interface (check window.tabletInterface)
        if (window.tabletInterface != null) {
            fcn();
            return;
        }

        // Android device
        if (typeof AndroidInterface !== 'undefined') {
            window.tabletInterface = AndroidInterface;
            if (fcn) {
                fcn();
            }
            return;
        }

        // iOS device - might not be loaded yet
        if (typeof (window.tablet) != 'object') {
            // Come back in 100ms
            setTimeout(function () {
                iOS.waitForInterface(fcn);
            }, 100);
        } else {
            // All set to run commands
            window.tabletInterface = window.tablet;
            if (fcn) {
                fcn();
            }
        }
    }

    // Database functions
    static stmt (json, fcn) {
        // database_stmt é async, precisa fazer await (corrigido window.window para window)
        const stmtPromise = window.tabletInterface.database_stmt(JSON.stringify(json));
        
        // Lidar com a Promise
        if (stmtPromise && typeof stmtPromise.then === 'function') {
            stmtPromise.then(result => {
                if (typeof (fcn) !== 'undefined') {
                    fcn(result);
                }
            }).catch(error => {
                console.error('[iOS] stmt error:', error);
                if (typeof (fcn) !== 'undefined') {
                    fcn({ success: false, changes: 0 });
                }
            });
        } else {
            // Se não for Promise, é resultado síncrono
            var result = stmtPromise;
            if (typeof (fcn) !== 'undefined') {
                fcn(result);
            }
        }
    }

    static query (json, fcn) {
        // database_query é async, precisa fazer await
        const queryPromise = window.tabletInterface.database_query(JSON.stringify(json));
        
        // Lidar com a Promise
        if (queryPromise && typeof queryPromise.then === 'function') {
            queryPromise.then(result => {
                if (typeof (fcn) !== 'undefined') {
                    // A callback espera uma string JSON, não um array
                    let stringResult = Array.isArray(result) ? JSON.stringify(result) : JSON.stringify(result && result.data ? result.data : []);
                    fcn(stringResult);
                }
            }).catch(error => {
                console.error('[iOS] query error:', error);
                if (typeof (fcn) !== 'undefined') {
                    fcn(null); // Retornar null em erro
                }
            });
        } else {
            // Se não for Promise, é resultado síncrono
            var result = queryPromise;
            if (typeof (fcn) !== 'undefined') {
                let stringResult = Array.isArray(result) ? JSON.stringify(result) : JSON.stringify(result && result.data ? result.data : []);
                fcn(stringResult);
            }
        }
    }

    static setfield (db, id, fieldname, val, fcn) {
        var json = {};
        var keylist = [fieldname + ' = ?', 'mtime = ?'];
        json.values = [val, (new Date()).getTime().toString()];
        json.stmt = 'update ' + db + ' set ' + keylist.toString() + ' where id = ' + id;
        iOS.stmt(json, fcn);
    }

    // IO functions

    static cleanassets (ft, fcn) {
        window.tabletInterface.io_cleanassets(ft); fcn();
    }

    static getmedia (file, fcn) {
        mediacounter++;
        var nextStep = function (file, key, whenDone) {
            var result = window.tabletInterface.io_getmedialen(file, key);
            iOS.processdata(key, 0, result, '', whenDone);
        };
        nextStep(file, mediacounter, fcn);
    }

    static getmediadata (key, offset, len, fcn) {
        var result = window.tabletInterface.io_getmediadata(key, offset, len);
        if (fcn) {
            fcn(result);
        }
    }

    static processdata (key, off, len, oldstr, fcn) {
        if (len == 0) {
            iOS.getmediadone(key);
            fcn(oldstr);
            return;
        }
        var newlen = (len < 100000) ? len : 100000;
        iOS.getmediadata(key, off, newlen, function (str) {
            iOS.processdata(key, off + newlen, len - newlen, oldstr + str, fcn);
        });
    }

    static getsettings (fcn) {
        var result = window.tabletInterface.io_getsettings();
        if (fcn) {
            fcn(result);
        }
    }

	
    static getmediadone (file, fcn) {
        var result = window.tabletInterface.io_getmediadone(file);
        if (fcn) {
            fcn(result);
        }
    }

	

    static setmedia (str, ext, fcn) {
        var result = window.tabletInterface.io_setmedia(str, ext);
        if (fcn) {
            fcn(result);
        }
    }

    static setmedianame (str, name, ext, fcn) {
        var result = window.tabletInterface.io_setmedianame(str, name, ext);
        if (fcn) {
            fcn(result);
        }
    }

    static getmd5 (str, fcn) {
        var result = window.tabletInterface.io_getmd5(str);
        if (fcn) {
            fcn(result);
        }
    }

    static remove (str, fcn) {
        var result = window.tabletInterface.io_remove(str);
        if (fcn) {
            fcn(result);
        }
    }

    static getfile (str, fcn) {
        var result = window.tabletInterface.io_getfile(str);
        if (fcn) {
            fcn(result);
        }
    }

		
	static gettextresource (filename, fcn) {
        // Em web, io_gettextresource é async, sempre use callback
        window.tabletInterface.io_gettextresource(filename, fcn);
    }

    static setfile (name, str, fcn) {
        // Em web, io_setfile é async, sempre use callback
        window.tabletInterface.io_setfile(name, btoa(str), fcn);
    }

    // Sound functions

    static registerSound (dir, name, fcn) {
        var result = window.tabletInterface.io_registersound(dir, name);
        if (fcn) {
            fcn(result);
        }
    }

    static playSound (name, fcn) {
        var result = window.tabletInterface.io_playsound(name);
        if (fcn) {
            fcn(result);
        }
    }

    static stopSound (name, fcn) {
        var result = window.tabletInterface.io_stopsound(name);
        if (fcn) {
            fcn(result);
        }
    }

    // Web Wiew delegate call backs

    static soundDone (name) {
        ScratchAudio.soundDone(name);
    }

    static sndrecord (fcn) {
        var result = window.tabletInterface.recordsound_recordstart();
        if (fcn) {
            fcn(result);
        }
    }

    static recordstop (fcn) {
        var result = window.tabletInterface.recordsound_recordstop();
        if (fcn) {
            fcn(result);
        }
    }

    static volume (fcn) {
        var result = window.tabletInterface.recordsound_volume();
        if (fcn) {
            fcn(result);
        }
    }

    static startplay (fcn) {
        var result = window.tabletInterface.recordsound_startplay();
        if (fcn) {
            fcn(result);
        }
    }

    static stopplay (fcn) {
        var result = window.tabletInterface.recordsound_stopplay();
        if (fcn) {
            fcn(result);
        }
    }

    static recorddisappear (b, fcn) {
        var result = window.tabletInterface.recordsound_recordclose(b);
        if (fcn) {
            fcn(result);
        }
    }

    // Record state
    static askpermission () {
        if (isiOS) {
            window.tabletInterface.askForPermission();
        }
    }

    // camera functions

    static hascamera () {
        camera = window.tabletInterface.scratchjr_cameracheck();
    }

    static startfeed (data, fcn) {
        var str = JSON.stringify(data);
        var result = window.tabletInterface.scratchjr_startfeed(str);
        if (fcn) {
            fcn(result);
        }
    }

    static stopfeed (fcn) {
        var result = window.tabletInterface.scratchjr_stopfeed();
        if (fcn) {
            fcn(result);
        }
    }

    static choosecamera (mode, fcn) {
        var result = window.tabletInterface.scratchjr_choosecamera(mode);
        if (fcn) {
            fcn(result);
        }
    }

    static captureimage (fcn) {
        window.tabletInterface.scratchjr_captureimage(fcn);
    }

    static hidesplash (fcn) {
        if (isiOS) {
            window.tabletInterface.hideSplash();
        }
        if (fcn) {
            fcn();
        }
    }

    static trace (str) {
        console.log(str); // eslint-disable-line no-console
    }

    static parse (str) {
        console.log(JSON.parse(str)); // eslint-disable-line no-console
    }

    static tracemedia (str) {
        console.log(atob(str)); // eslint-disable-line no-console
    }

    ignore () {
    }

    ///////////////
    // Sharing
    ///////////////


    // Called on the JS side to trigger native UI for project sharing.
    // fileName: name for the file to share
    // emailSubject: subject text to use for an email
    // emailBody: body HTML to use for an email
    // shareType: 0 for Email; 1 for Airdrop
    // b64data: base-64 encoded .SJR file to share

    static sendSjrToShareDialog (fileName, emailSubject, emailBody, shareType, b64data) {
        window.tabletInterface.sendSjrUsingShareDialog(fileName, emailSubject, emailBody, shareType, b64data);
    }

    // Called on the Objective-C side.  The argument is a base64-encoded .SJR file,
    // to be unzipped, processed, and stored.
    static loadProjectFromSjr (b64data) {
        try {
            IO.loadProjectFromSjr(b64data);
        } catch (err) {
            var errorMessage = 'Couldn\'t load share -- project data corrupted. ' + err.message;
            Alert.open(gn('frame'), gn('frame'), errorMessage, '#ff0000');
            console.log(err); // eslint-disable-line no-console
            return 0;
        }
        return 1;
    }

    // Name of the device/iPad to display on the sharing dialog page
    // fcn is called with the device name as an arg
    static deviceName (fcn) {
        fcn(window.tabletInterface.deviceName());
    }

    static analyticsEvent (category, action, label, value) {
        if (!value) {
            value = 1;
        }
        let usageLabel = label ? AppUsage.currentUsage + label : AppUsage.currentUsage;
        window.tabletInterface.analyticsEvent(category, action, usageLabel, value);
    }

    // Web Wiew delegate call backs

    static pageError (desc) {
        console.log('XCODE ERROR:', desc); // eslint-disable-line no-console
        if (window.location.href.indexOf('home.html') > -1) {
            if (Lobby.errorTimer) {
                Lobby.errorLoading(desc);
            }
        }
    }
}

// Expose iOS methods for ScratchJr tablet sharing callbacks
window.iOS = iOS;
