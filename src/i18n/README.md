Interface languages: Russian (`ru`), English (`en`), Tajik (`tg`).

- `ru.ts`, `en.ts`, `tg.ts`: typed semantic messages for navigation, settings and sign-in.
- `uiMessages.json`: shared interface-copy dictionary. Russian source text is the key; templates use `{0}`, `{1}`, etc.
- `uiText()` translates interface copy. Keep names, school content and stored identifiers out of translations.
- `localizeCopy()` provides live labels for static UI option lists while preserving `value`, `key`, `id` and `code`.
- Include `uiLanguage()` in memo dependencies when caching translated labels.
- `tgAntd.json` supplies the complete Tajik calendar, table and validation UI.

Run `npm run i18n:sync` after changing the shared dictionary or helper. It updates generated native and public landing copies. Production builds run it automatically.

The landing HTML is a Vite entry at `landing/index.html`; its language menu imports the application's `LanguageSwitcher` component through `src/landing.tsx`.
