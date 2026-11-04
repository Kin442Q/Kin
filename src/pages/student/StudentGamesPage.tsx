import { useCallback, useEffect, useState, type ComponentType } from 'react'
import { App as AntdApp, Button, Tag } from 'antd'
import { Gamepad2, Trophy } from 'lucide-react'

import { SP, SproutCard, SproutEmpty, SproutPageHeader } from '../../components/sprout'
import MemoryGame from '../../components/games/MemoryGame'
import MathGame from '../../components/games/MathGame'
import SequenceGame from '../../components/games/SequenceGame'
import type { GameProps, GameResult } from '../../components/games/types'
import { gamesApi, type GameInfo, type GameKey, type LeaderRow } from '../../api/learningApi'

const GAME_COMPONENTS: Record<GameKey, ComponentType<GameProps>> = {
  memory: MemoryGame,
  math: MathGame,
  sequence: SequenceGame,
}

const GAME_EMOJI: Record<GameKey, string> = { memory: '🃏', math: '➕', sequence: '💡' }

/** Игры для развития мозга и рейтинг класса. */
export default function StudentGamesPage() {
  const { message } = AntdApp.useApp()
  const [games, setGames] = useState<GameInfo[]>([])
  const [active, setActive] = useState<GameKey | null>(null)
  const [round, setRound] = useState(0)
  const [result, setResult] = useState<{ score: number; best: number; isRecord: boolean } | null>(null)
  const [board, setBoard] = useState<LeaderRow[]>([])

  const loadGames = useCallback(() => {
    gamesApi
      .list()
      .then(setGames)
      .catch((e) => message.error(e?.response?.data?.message || 'Не удалось загрузить игры'))
  }, [message])

  const loadBoard = useCallback((key: GameKey) => {
    gamesApi.leaderboard(key).then(setBoard).catch(() => setBoard([]))
  }, [])

  useEffect(() => {
    loadGames()
  }, [loadGames])

  useEffect(() => {
    if (active) loadBoard(active)
  }, [active, loadBoard])

  const finish = useCallback(
    async (res: GameResult) => {
      if (!active) return
      try {
        setResult(await gamesApi.submit(active, res))
      } catch (e: any) {
        message.error(e?.response?.data?.message || 'Результат не сохранился')
        setResult({ score: res.score, best: res.score, isRecord: false })
      }
      loadGames()
      loadBoard(active)
    },
    [active, loadGames, loadBoard, message],
  )

  const info = games.find((g) => g.key === active)
  const Game = active ? GAME_COMPONENTS[active] : null

  return (
    <div>
      <SproutPageHeader
        title="Игры для мозга"
        icon={<Gamepad2 size={22} strokeWidth={2} />}
        iconAccent="lilac"
        description="Тренируй память, счёт и внимание. Лучшие результаты попадают в рейтинг класса."
        actions={
          active ? (
            <Button
              onClick={() => {
                setActive(null)
                setResult(null)
              }}
            >
              ← Ко всем играм
            </Button>
          ) : undefined
        }
      />

      {!active && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          {games.map((g) => (
            <SproutCard key={g.key} padding={18}>
              <div style={{ fontSize: 38 }}>{GAME_EMOJI[g.key]}</div>
              <div style={{ fontSize: 17, fontWeight: 700, marginTop: 6 }}>{g.title}</div>
              <Tag style={{ margin: '6px 0' }}>{g.skill}</Tag>
              <div style={{ fontSize: 13, color: SP.textMid, minHeight: 56 }}>{g.description}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <span style={{ fontSize: 12, color: SP.muted }}>
                  {g.myBest != null ? `Мой рекорд: ${g.myBest}` : 'Ещё не играл(а)'}
                </span>
                <Button
                  type="primary"
                  onClick={() => {
                    setResult(null)
                    setRound((r) => r + 1)
                    setActive(g.key)
                  }}
                >
                  Играть
                </Button>
              </div>
            </SproutCard>
          ))}
          {games.length === 0 && (
            <SproutCard>
              <SproutEmpty title="Игр пока нет" minHeight={140} />
            </SproutCard>
          )}
        </div>
      )}

      {active && info && Game && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          <SproutCard padding={20}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 14, textAlign: 'center' }}>
              {GAME_EMOJI[active]} {info.title}
            </div>

            {!result ? (
              <Game key={`${active}-${round}`} onFinish={finish} />
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 14, color: SP.textMid }}>Твой результат</div>
                <div style={{ fontSize: 54, fontWeight: 800, color: SP.primaryDeep }}>{result.score}</div>
                {result.isRecord ? (
                  <Tag color="gold" style={{ fontSize: 14, padding: '2px 10px' }}>
                    🏆 Новый рекорд!
                  </Tag>
                ) : (
                  <div style={{ color: SP.muted }}>Лучший результат: {result.best}</div>
                )}
                <div style={{ marginTop: 18, display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <Button
                    type="primary"
                    onClick={() => {
                      setResult(null)
                      setRound((r) => r + 1)
                    }}
                  >
                    Играть ещё
                  </Button>
                  <Button onClick={() => setActive(null)}>К списку</Button>
                </div>
              </div>
            )}
          </SproutCard>

          <SproutCard padding={20}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, marginBottom: 12 }}>
              <Trophy size={18} color={SP.yellowDeep} /> Рейтинг класса
            </div>
            {board.length === 0 ? (
              <SproutEmpty title="Пока никто не играл" description="Стань первым!" minHeight={120} />
            ) : (
              <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {board.map((row) => (
                  <li
                    key={row.rank}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      borderRadius: 10,
                      background: row.isMe ? SP.primaryGhost : SP.surfaceAlt,
                      fontWeight: row.isMe ? 700 : 500,
                    }}
                  >
                    <span style={{ width: 22, textAlign: 'center' }}>
                      {row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : row.rank}
                    </span>
                    <span style={{ flex: 1 }}>
                      {row.name}
                      {row.isMe ? ' (ты)' : ''}
                    </span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{row.score}</span>
                  </li>
                ))}
              </ol>
            )}
          </SproutCard>
        </div>
      )}
    </div>
  )
}
