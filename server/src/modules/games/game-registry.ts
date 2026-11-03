/**
 * Мини-игры для развития мозга. Сами игры работают в браузере ученика;
 * сервер хранит результаты и считает рейтинг класса.
 *
 * maxScore — потолок осмысленного результата: всё, что выше, сервер
 * отклоняет, чтобы подделанный запрос не занимал первое место.
 */
export type GameKey = 'memory' | 'math' | 'sequence'

export interface GameDef {
  title: string
  description: string
  /** Чему тренирует игра — для карточки. */
  skill: string
  maxScore: number
}

export const GAMES: Record<GameKey, GameDef> = {
  memory: {
    title: 'Найди пары',
    description: 'Открывай карточки и находи одинаковые пары. Чем меньше ходов, тем больше очков.',
    skill: 'Зрительная память',
    maxScore: 1000,
  },
  math: {
    title: 'Устный счёт',
    description: '60 секунд на примеры: сложение, вычитание и умножение. Каждый верный ответ — очко.',
    skill: 'Счёт и скорость',
    maxScore: 200,
  },
  sequence: {
    title: 'Запомни порядок',
    description: 'Повтори последовательность огоньков. С каждым уровнем она становится длиннее.',
    skill: 'Внимание и рабочая память',
    maxScore: 100,
  },
}

export const GAME_KEYS = Object.keys(GAMES) as GameKey[]

export const isGameKey = (key: string): key is GameKey => Object.prototype.hasOwnProperty.call(GAMES, key)
