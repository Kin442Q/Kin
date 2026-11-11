import {
  BookOpen,
  Calculator,
  Dumbbell,
  FlaskConical,
  Globe,
  Landmark,
  Languages,
  Laptop,
  Leaf,
  Music,
  Palette,
  type LucideIcon,
} from 'lucide-react-native'

/** Значок предмета по названию («Математика» — калькулятор, «Русский язык» — языки…); неизвестный — открытая книга. */
export function subjectIcon(name: string | null | undefined): LucideIcon {
  const n = (name ?? '').toLowerCase()
  if (/математ|алгебр|геометр|арифм/.test(n)) return Calculator
  if (/язык|тадж|русск|англ|немец|франц|араб|китай/.test(n)) return Languages
  if (/истори|обществ|право/.test(n)) return Landmark
  if (/физкульт|спорт|физическ/.test(n)) return Dumbbell
  if (/биолог|природ|окруж|эколог/.test(n)) return Leaf
  if (/хими|физик|астроном/.test(n)) return FlaskConical
  if (/информат|компьютер|программ/.test(n)) return Laptop
  if (/музык|пени/.test(n)) return Music
  if (/рисов|изо|искусств|труд|технолог/.test(n)) return Palette
  if (/географ/.test(n)) return Globe
  return BookOpen
}

/** Полупрозрачная версия цвета `#RRGGBB`: плитка предмета берёт цвет самого предмета. Не `#RRGGBB` — запасной цвет. */
export function tint(hex: string | null | undefined, alpha: number, fallback: string): string {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return fallback
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0')
  return `${hex}${a}`
}
