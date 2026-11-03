export interface GameResult {
  score: number
  /** Достигнутый уровень — для игр с уровнями. */
  level?: number
}

export interface GameProps {
  /** Вызывается один раз, когда партия закончена. */
  onFinish: (result: GameResult) => void
}
