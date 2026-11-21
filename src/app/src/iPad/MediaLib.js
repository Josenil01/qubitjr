import IO from './IO.js';
import Localization from '../utils/Localization.js';

let path;
let samples;
let backgrounds;
let sprites;
let sounds;
let keys = {};

export default class MediaLib {
    static get path () {
        return path;
    }

    static get samples () {
        return samples;
    }

    static get sprites () {
        return sprites;
    }

    static get backgrounds () {
        return backgrounds;
    }

    static get sounds () {
        return sounds;
    }

    static get keys () {
        return keys;
    }

    static loadMediaLib (root, whenDone) {
        // Refresh the catalog on each page load, including after library updates.
        IO.requestFromServer(root + 'media.json?v=' + Date.now(), (result) => {
            let parsedResult = JSON.parse(result);
            path = parsedResult.path;
            samples = parsedResult.samples;
            sprites = parsedResult.sprites;
            backgrounds = parsedResult.backgrounds;
            sounds = parsedResult.sounds;

            MediaLib.localizeMediaNames();
            MediaLib.generateKeys();

            whenDone();
        });
    }

    static localizeMediaNames () {
        // Localize names of sprites
        for (let i = 0; i < sprites.length; i++) {
            const key = 'CHARACTER_' + sprites[i].md5;
            const name = Localization.localize(key);
            if (name && name !== key) sprites[i].name = name;
        }

        // Localize names of backgrounds
        for (let i = 0; i < backgrounds.length; i++) {
            const key = 'BACKGROUND_' + backgrounds[i].md5;
            const name = Localization.localize(key);
            if (name && name !== key) backgrounds[i].name = name;
        }
    }

    static generateKeys () {
        for (let i = 0; i < backgrounds.length; i++) {
            var bg = backgrounds[i];
            keys[bg.md5] = {width: bg.width, height: bg.height, name: bg.name};
        }

        for (let i = 0; i < sprites.length; i++) {
            var spr = sprites[i];
            keys[spr.md5] = {width: spr.width, height: spr.height, name: spr.name};
        }
    }
}
