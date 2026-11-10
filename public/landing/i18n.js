/* Static landing copy shares the interface dictionary with the React app. */
(async () => {
  const response = await fetch(new URL('../locales/ui.json', location.href));
  if (!response.ok) throw new Error('Could not load landing translations');
  const messages = await response.json();
  const dictionary = Object.fromEntries(Object.entries(messages).map(([key, value]) => [key.trim().replace(/\s+/g, ' '), value]));
  const nodes = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement.closest('script,style,#landing-language-root')) continue;
    const source = node.textContent;
    const key = source.trim().replace(/\s+/g, ' ');
    if (dictionary[key]) nodes.push({ node, source, key });
  }
  const names = { ru: 'Моя школа', en: 'My School', tg: 'Мактаби ман' };
  const isLang = value => ['ru', 'en', 'tg'].includes(value);
  function apply(lang) {
    if (!isLang(lang)) lang = 'ru';
    for (const { node, source, key } of nodes) {
      node.textContent = lang === 'ru' ? source : source.replace(source.trim(), dictionary[key][lang] || source.trim());
    }
    document.documentElement.lang = lang;
    document.title = names[lang];
    document.querySelectorAll('.brand-logo').forEach(img => {
      img.src = '../brand/logo-' + lang + (img.closest('.foot-brand') ? '-dark' : '') + '.svg';
      img.alt = names[lang];
    });
    document.querySelector('.hz-title').textContent = names[lang];
    document.querySelector('.foot-bot span').textContent = '© 2026 ' + names[lang] + ' · ' + {ru:'Все права защищены',en:'All rights reserved',tg:'Ҳамаи ҳуқуқҳо ҳифз шудаанд'}[lang];
  }
  let initial = 'ru';
  try { initial = JSON.parse(localStorage.getItem('kg_lang') || '{}').state?.lang || 'ru'; } catch {}
  apply(initial);
  window.addEventListener('maktab-language-change', event => apply(event.detail));
  window.addEventListener('message', event => {
    if (event.origin === location.origin && event.source === parent && event.data?.type === 'maktab-language') apply(event.data.lang);
  });
  window.addEventListener('storage', event => {
    if (event.key !== 'kg_lang') return;
    try { apply(JSON.parse(event.newValue || '{}').state?.lang); } catch {}
  });
  document.documentElement.dataset.translationsReady = 'true';
})();
