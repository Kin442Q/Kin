const fs = require('fs');
// Native bundles keep a generated local copy so Metro needs no external watch folders.
fs.mkdirSync('mobile/src/i18n', {recursive:true});
fs.copyFileSync('src/i18n/uiMessages.json','public/locales/ui.json');
fs.copyFileSync('src/i18n/uiMessages.json','mobile/src/i18n/messages.json');
fs.writeFileSync('mobile/src/i18n/uiText.ts',fs.readFileSync('src/i18n/uiText.ts','utf8').replace('./uiMessages.json','./messages.json'));
