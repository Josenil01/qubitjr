import Cookie from './Cookie.js';
import IO from '../iPad/IO.js';

let currentLocale;
let localizationMessages = {};

// Configuration
const sampleKeyPrefix = 'key_';

export default class Localization {
    static get currentLocale () {
        return currentLocale;
    }

    // Take the browser's reported locale from navigator.language
    // Normalize this value and find a match in supportedLocales
    // If we support a similar language but not the specific one, it's returned.
    // E.g., if we support 'en-US' but not 'en-GB', the user gets 'en-US'
    // The match in supported locales (or the default locale) is returned.
    static determineLocaleFromBrowser () {
        let defaultLocale = window.Settings.defaultLocale;
        let supportedLocales = window.Settings.supportedLocales;

        var localizationLanguage = window.navigator.userLanguage || window.navigator.language || 'en-us';

        var localizationLanguageParts = localizationLanguage.split('-');
        // Capitalize last part of localization for includes
        localizationLanguageParts[localizationLanguageParts.length - 1] = (
            localizationLanguageParts[localizationLanguageParts.length - 1].toUpperCase()
        );

        var desiredLocale = localizationLanguageParts.join('-');
        if (desiredLocale in Object.keys(supportedLocales)) {
            return desiredLocale;
        }

        // We're not supporting this locale yet - do we support an ancestor?
        for (var localeKey in supportedLocales) {
            var supportedLocale = supportedLocales[localeKey];
            var parts = supportedLocale.split('-');
            if (parts[0] == localizationLanguageParts[0]) {
                return supportedLocale; // Top-level is the same
            }
        }

        return defaultLocale;
    }

    // Include locale support files and load the messages
    // Call this when the app is initialized
    static includeLocales (localizationRoot, whenDone) {
        var localizationCookie = Cookie.get('localization');

        if (localizationCookie === null) {
            currentLocale = this.determineLocaleFromBrowser();
        } else {
            currentLocale = localizationCookie;
        }
        var topLevel = currentLocale.split('-')[0];
        if (topLevel === 'zh') {
            // need to handle locale in addition to language code for Chinese,
            // ensure it's lower case to match filename
            topLevel = currentLocale.toLowerCase();
        }
        
        // Get messages - usar fetch diretamente
        const localeFilePath = localizationRoot + 'localizations/' + topLevel + '.json';
        fetch(localeFilePath, {cache: 'no-cache'})
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro ao carregar localização: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                localizationMessages = data;
                whenDone();
            })
            .catch(error => {
                console.error('Erro ao carregar localização:', localeFilePath, error);
                // Fallback para inglês se houver erro
                localizationMessages = {};
                whenDone();
            });
    }

    // Translate a particular message given the message key and info
    // `formatting` is an optional object of placeholder -> value pairs; any
    // `{PLACEHOLDER}` token found in the localized string is substituted with
    // the matching value (e.g. {CHARACTER_NAME: spr.name} replaces
    // "{CHARACTER_NAME}" in the message with the sprite's actual name).
    static localize (key, formatting) {
        var message = (key in localizationMessages) ? localizationMessages[key] : key;

        if (formatting && typeof message === 'string') {
            Object.keys(formatting).forEach(function (placeholder) {
                var value = formatting[placeholder];
                var replacement = (value === null || typeof value === 'undefined') ? '' : value;
                // Matches both the simple "{NAME}" placeholders used by the block
                // descriptions and the ICU-style "{NAME, number}" placeholders used
                // by the interface/paint guides and grid labels.
                message = message.replace(
                    new RegExp('\\{' + placeholder + '(,[^}]*)?\\}', 'g'),
                    replacement
                );
            });
        }

        return message;
    }

    // For sample projects, some fields (sprite names, text on stage, and text in say blocks)
    // may have a special prefix to indicate that it should be replaced with a localized value.
    // E.g., we might have some text on the stage that says "Touch me" in English. This gets translated.
    static isSampleLocalizedKey (str) {
        return str.slice(0, sampleKeyPrefix.length) == sampleKeyPrefix;
    }
}
