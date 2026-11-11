import { useEffect, useState } from 'react'

import type { Lang } from '../i18n/types'

/* ============================================================
   Логотип зависит от языка интерфейса: logo-ru / logo-en / logo-tg (+ -dark для тёмного фона).
   Файл другого языка раньше грузился только в момент переключения: если в эту секунду сети нет
   (или сервер перезапускается), логотип пропадал и вместо него оставалась сломанная картинка.
   Теперь все варианты подгружаются заранее, а при сбое показывается русский логотип.
   ============================================================ */

const LANGS: Lang[] = ['ru', 'en', 'tg']

/** Адрес логотипа для языка; dark — светлая версия для тёмного фона. */
export function brandLogoSrc(lang: Lang, dark: boolean): string {
  return `${import.meta.env.BASE_URL}brand/logo-${lang}${dark ? '-dark' : ''}.svg`
}

let warmed = false

/** Загружает логотипы всех языков и обеих тем заранее, чтобы смена языка не зависела от сети. Безопасно звать много раз. */
export function warmBrandLogos(): void {
  if (warmed || typeof Image === 'undefined') return
  warmed = true
  for (const lang of LANGS) {
    for (const dark of [false, true]) new Image().src = brandLogoSrc(lang, dark)
  }
}

/**
 * Адрес логотипа и обработчик ошибки для <img>. Не загрузился логотип выбранного языка — подставляется
 * русский (он есть у каждого и грузится первым), а не сломанная картинка с подписью. На смену языка
 * отказ не переносится: следующий язык снова пробует свой файл.
 */
export function useBrandLogo(lang: Lang, dark: boolean): { src: string; onError: () => void } {
  const wanted = brandLogoSrc(lang, dark)
  const [failed, setFailed] = useState<string | null>(null)
  useEffect(() => {
    warmBrandLogos()
  }, [])
  return {
    src: failed === wanted ? brandLogoSrc('ru', dark) : wanted,
    onError: () => setFailed(wanted),
  }
}
