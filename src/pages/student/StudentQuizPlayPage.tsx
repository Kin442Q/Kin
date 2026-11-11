import { localizeCopy, uiText } from '../../i18n/uiText'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { App as AntdApp, Button, Result, Spin, Tag } from 'antd'
import { AnimatePresence, motion } from 'framer-motion'
import { Flame, Gamepad2, Star, Timer, X, Zap } from 'lucide-react'

import { SP, SproutCard } from '../../components/sprout'
import { quizApi, type AttemptResult, type PlayQuiz } from '../../api/learningApi'
import { SPEED_SECONDS, scoreGame, type GameSummary } from '../../lib/quizGame'

type Stage = 'intro' | 'run' | 'result'

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
const LETTERS = localizeCopy(['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З'])
const TILE_COLORS = ['#0D7A7C', '#FF8A65', '#FFB020', '#8B7BD4', '#3B8FBF', '#D9709B', '#1BA6A0', '#075B5D']

/** Круговой таймер: дуга уменьшается по мере того, как уходит время на вопрос. */
function TimerRing({ left, total }: { left: number; total: number }) {
  const R = 18
  const C = 2 * Math.PI * R
  const frac = Math.max(0, Math.min(1, left / total))
  const urgent = left <= 5
  return (
    <div className="qg-timer" role="timer" aria-label={uiText("Осталось {0} секунд", Math.ceil(left))}>
      <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r={R} fill="none" stroke="var(--sp-border-soft)" strokeWidth="5" />
        <circle
          cx="24"
          cy="24"
          r={R}
          fill="none"
          stroke={urgent ? 'var(--sp-rose)' : 'var(--sp-primary)'}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - frac)}
          transform="rotate(-90 24 24)"
        />
      </svg>
      <span style={{ color: urgent ? SP.roseDeep : SP.text }}>{Math.ceil(left)}</span>
    </div>
  )
}

/** Число плавно «набегает» от 0 до значения — для очков на итоговом экране. */
function useCountUp(target: number, run: boolean, ms = 1100) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!run) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setV(target)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms)
      setV(Math.round(target * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, run, ms])
  return v
}

function Stars({ count }: { count: 0 | 1 | 2 | 3 }) {
  return (
    <div className="qg-stars" aria-label={uiText("Звёзд: {0} из 3", count)}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          initial={{ scale: 0, rotate: -40, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ delay: 0.25 + i * 0.22, type: 'spring', stiffness: 260, damping: 14 }}
          className={i < count ? 'qg-star on' : 'qg-star'}
        >
          <Star size={44} strokeWidth={2} fill={i < count ? 'currentColor' : 'none'} />
        </motion.span>
      ))}
    </div>
  )
}

/** Игровое прохождение квиза: по одному вопросу, плитки-ответы, таймер, очки, серия и звёзды. */
export default function StudentQuizPlayPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { message } = AntdApp.useApp()

  const [quiz, setQuiz] = useState<PlayQuiz | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stage, setStage] = useState<Stage>('intro')
  const [speedMode, setSpeedMode] = useState(false)
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number[]>>({})
  const [times, setTimes] = useState<number[]>([])
  const [startedAt, setStartedAt] = useState(0)
  const [left, setLeft] = useState<number | null>(null)
  const [qLeft, setQLeft] = useState(SPEED_SECONDS)
  const [result, setResult] = useState<AttemptResult | null>(null)
  const [game, setGame] = useState<GameSummary | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const sent = useRef(false)
  const qStart = useRef(0)
  const advancing = useRef(false)

  useEffect(() => {
    if (!id) return
    quizApi
      .play(id)
      .then(setQuiz)
      .catch((e) => setError(e?.response?.data?.message || uiText("Квиз недоступен")))
  }, [id])

  const submitWith = useCallback(
    async (finalAnswers: Record<string, number[]>, finalTimes: number[]) => {
      if (!quiz || !id || sent.current) return
      sent.current = true
      setSubmitting(true)
      try {
        const r = await quizApi.submit(id, {
          answers: quiz.questions.map((q) => ({ questionId: q.id, selected: finalAnswers[q.id] ?? [] })),
          durationSec: Math.round((Date.now() - startedAt) / 1000),
        })
        const flags = quiz.questions.map((q) => r.review.find((x) => x.questionId === q.id)?.correct ?? false)
        setGame(scoreGame(flags, finalTimes, speedMode))
        setResult(r)
        setStage('result')
      } catch (e: any) {
        sent.current = false
        advancing.current = false
        message.error(e?.response?.data?.message || uiText("Не удалось отправить ответы"))
      } finally {
        setSubmitting(false)
      }
    },
    [quiz, id, startedAt, speedMode, message],
  )

  /** Фиксируем ответ на текущий вопрос и идём дальше (или сдаём квиз на последнем). */
  const lockIn = useCallback(
    (override?: Record<string, number[]>) => {
      if (!quiz || advancing.current) return
      advancing.current = true
      const used = Math.max(0, (Date.now() - qStart.current) / 1000)
      const nextTimes = [...times]
      nextTimes[idx] = used
      setTimes(nextTimes)
      const finalAnswers = override ?? answers
      if (idx >= quiz.questions.length - 1) {
        submitWith(finalAnswers, nextTimes)
        return
      }
      window.setTimeout(() => {
        setIdx((i) => i + 1)
        qStart.current = Date.now()
        setQLeft(SPEED_SECONDS)
        advancing.current = false
      }, 260)
    },
    [quiz, idx, times, answers, submitWith],
  )

  // Общий лимит на квиз (если задал учитель): время вышло — отправляем то, что успели.
  useEffect(() => {
    if (stage !== 'run' || !quiz?.timeLimitSec) return
    const limit = quiz.timeLimitSec
    const tick = () => {
      const remaining = limit - Math.floor((Date.now() - startedAt) / 1000)
      setLeft(Math.max(remaining, 0))
      if (remaining <= 0) submitWith(answers, times)
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [stage, quiz, startedAt, submitWith, answers, times])

  // Таймер вопроса (режим «на скорость»): время вышло — фиксируем то, что выбрано.
  useEffect(() => {
    if (stage !== 'run' || !speedMode) return
    const t = setInterval(() => {
      const elapsed = (Date.now() - qStart.current) / 1000
      const remaining = SPEED_SECONDS - elapsed
      setQLeft(Math.max(remaining, 0))
      if (remaining <= 0) lockIn()
    }, 200)
    return () => clearInterval(t)
  }, [stage, speedMode, lockIn])

  const start = (speed: boolean) => {
    sent.current = false
    advancing.current = false
    setSpeedMode(speed)
    setAnswers({})
    setTimes([])
    setIdx(0)
    setResult(null)
    setGame(null)
    setQLeft(SPEED_SECONDS)
    setStartedAt(Date.now())
    qStart.current = Date.now()
    setStage('run')
  }

  const xpShown = useCountUp(game?.xp ?? 0, stage === 'result')

  if (error) {
    return (
      <Result
        status="404"
        title={uiText("Квиз недоступен")}
        subTitle={error}
        extra={<Button type="primary" onClick={() => navigate('/student/quizzes')}>{uiText("К квизам")}</Button>}
      />
    )
  }
  if (!quiz) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin />
      </div>
    )
  }

  // ─── Вступление ───────────────────────────────────────────────
  if (stage === 'intro') {
    return (
      <div className="qg-wrap">
        <SproutCard padding={28} style={{ textAlign: 'center' }}>
          <div className="qg-hero-icon" aria-hidden="true">
            <Gamepad2 size={34} strokeWidth={2} />
          </div>
          <h1 className="qg-title">{quiz.title}</h1>
          {quiz.description && <p style={{ color: SP.textMid, margin: '6px 0 0' }}>{quiz.description}</p>}
          <div className="qg-chips">
            <span className="sp-chip" style={{ background: SP.primarySoft, color: SP.primaryDeep }}>
              {quiz.questions.length} {" " + uiText("вопросов") + " "}</span>
            <span className="sp-chip" style={{ background: SP.blueSoft, color: SP.blueDeep }}>
              {quiz.timeLimitSec ? uiText("Лимит: {0} мин", Math.round(quiz.timeLimitSec / 60)) : uiText("Без общего лимита")}
            </span>
          </div>
          <ul className="qg-rules">
            <li>
              <Zap size={18} /> {" " + uiText("Режим «на скорость»:") + " "}{SPEED_SECONDS} {" " + uiText("секунд на вопрос, быстрее — больше очков") + " "}</li>
            <li>
              <Flame size={18} /> {" " + uiText("Верные ответы подряд — серия: каждое звено добавляет 10% к очкам") + " "}</li>
            <li>
              <Star size={18} /> {" " + uiText("Звёзды за результат: 50% — одна, 80% — две, 100% — три") + " "}</li>
          </ul>
          <div className="qg-actions">
            <Button type="primary" size="large" onClick={() => start(false)} disabled={quiz.questions.length === 0}>
              {" " + uiText("Играть") + " "}</Button>
            <Button size="large" icon={<Zap size={16} />} onClick={() => start(true)} disabled={quiz.questions.length === 0}>
              {" " + uiText("На скорость") + " "}</Button>
            <Button size="large" type="text" onClick={() => navigate('/student/quizzes')}>
              {" " + uiText("Назад") + " "}</Button>
          </div>
        </SproutCard>
      </div>
    )
  }

  // ─── Прохождение: один вопрос на экране ───────────────────────
  if (stage === 'run') {
    const q = quiz.questions[idx]
    const picked = answers[q.id] ?? []
    const total = quiz.questions.length

    const choose = (i: number) => {
      if (advancing.current) return
      if (q.kind === 'SINGLE') {
        const next = { ...answers, [q.id]: [i] }
        setAnswers(next)
        // короткая пауза, чтобы плитка успела «нажаться», затем следующий вопрос
        window.setTimeout(() => lockIn(next), 320)
        return
      }
      setAnswers((a) => {
        const cur = a[q.id] ?? []
        return { ...a, [q.id]: cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i] }
      })
    }

    return (
      <div className="qg-wrap">
        <div className="qg-top">
          <button
            type="button"
            className="qg-close"
            aria-label={uiText("Выйти из квиза")}
            onClick={() => {
              if (window.confirm(uiText("Выйти из квиза? Ответы не сохранятся."))) navigate('/student/quizzes')
            }}
          >
            <X size={18} />
          </button>
          <div className="qg-segs" aria-label={uiText("Вопрос {0} из {1}", idx + 1, total)}>
            {quiz.questions.map((qq, n) => (
              <span key={qq.id} className={n < idx ? 'qg-seg done' : n === idx ? 'qg-seg now' : 'qg-seg'} />
            ))}
          </div>
          {speedMode ? (
            <TimerRing left={qLeft} total={SPEED_SECONDS} />
          ) : (
            left !== null && (
              <span className="qg-limit" style={{ color: left <= 30 ? SP.roseDeep : SP.textMid }}>
                <Timer size={15} /> {mmss(left)}
              </span>
            )
          )}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={q.id}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.22 }}
          >
            <SproutCard padding={26} animate={false} className="qg-qcard">
              <div className="qg-qnum">
                {" " + uiText("Вопрос") + " "}{idx + 1} {" " + uiText("из") + " "}{total}
              </div>
              <div className="qg-qtext">{q.text}</div>
              {q.kind === 'MULTIPLE' && <Tag color="cyan">{uiText("Выберите все верные ответы")}</Tag>}
            </SproutCard>

            <div className="qg-options">
              {q.options.map((o, i) => {
                const on = picked.includes(i)
                return (
                  <button
                    key={i}
                    type="button"
                    className={on ? 'qg-opt is-on' : 'qg-opt'}
                    style={{ ['--qg-c' as string]: TILE_COLORS[i % TILE_COLORS.length] }}
                    aria-pressed={on}
                    onClick={() => choose(i)}
                  >
                    <span className="qg-letter">{LETTERS[i] ?? i + 1}</span>
                    <span>{o.text}</span>
                  </button>
                )
              })}
            </div>

            {q.kind === 'MULTIPLE' && (
              <div style={{ textAlign: 'center', marginTop: 18 }}>
                <Button type="primary" size="large" loading={submitting} onClick={() => lockIn()} disabled={picked.length === 0}>
                  {idx === total - 1 ? uiText("Завершить") : uiText("Ответить")}
                </Button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    )
  }

  // ─── Результат: звёзды, очки, серия и разбор ──────────────────
  const r = result!
  const g = game!
  const tone = r.percent >= 80 ? SP.primaryDeep : r.percent >= 50 ? SP.yellowDeep : SP.roseDeep
  const totalSec = Math.round((Date.now() - startedAt) / 1000)
  return (
    <div className="qg-wrap" style={{ maxWidth: 780 }}>
      <SproutCard padding={26} style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ color: SP.muted, fontWeight: 600 }}>{quiz.title}</div>
        <Stars count={g.stars} />
        <div className="qg-percent" style={{ color: tone }}>
          {r.percent}%
        </div>
        <div style={{ color: SP.textMid }}>
          {" " + uiText("Верно") + " "}{r.score} {" " + uiText("из") + " "}{r.total}
          {g.stars === 3 ? uiText("— отличный результат!") : g.stars === 0 ? uiText("— попробуй ещё раз, получится.") : ''}
        </div>
        <div className="qg-stats">
          <div>
            <b className="sp-num">{xpShown}</b>
            <span>{uiText("очков")}</span>
          </div>
          <div>
            <b className="sp-num">
              <Flame size={18} /> {g.bestStreak}
            </b>
            <span>{uiText("лучшая серия")}</span>
          </div>
          <div>
            <b className="sp-num">{mmss(totalSec)}</b>
            <span>{uiText("время")}</span>
          </div>
        </div>
        <div className="qg-actions" style={{ marginTop: 18 }}>
          <Button type="primary" size="large" onClick={() => start(false)}>
            {" " + uiText("Играть ещё") + " "}</Button>
          <Button size="large" icon={<Zap size={16} />} onClick={() => start(true)}>
            {" " + uiText("На скорость") + " "}</Button>
          <Button size="large" type="text" onClick={() => navigate('/student/quizzes')}>
            {" " + uiText("К квизам") + " "}</Button>
        </div>
      </SproutCard>

      <div className="qg-review-title">{uiText("Разбор ответов")}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {quiz.questions.map((q, n) => {
          const rev = r.review.find((x) => x.questionId === q.id)
          if (!rev) return null
          const pts = g.perQuestion[n]
          return (
            <SproutCard key={q.id} padding={16} animate={false}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span className={rev.correct ? 'qg-mark ok' : 'qg-mark bad'}>{rev.correct ? '✓' : '✗'}</span>
                <div style={{ fontWeight: 700, flex: 1 }}>
                  {n + 1}. {q.text}
                </div>
                {pts?.correct && (
                  <span className="sp-chip" style={{ background: SP.primarySoft, color: SP.primaryDeep }}>
                    +{pts.points}
                    {pts.streak >= 2 && (
                      <>
                        {' '}
                        <Flame size={12} /> {pts.streak}
                      </>
                    )}
                  </span>
                )}
              </div>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {q.options.map((o, i) => {
                  const isCorrect = rev.correctOptions.includes(i)
                  const chosen = rev.selected.includes(i)
                  return (
                    <div
                      key={i}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 10,
                        fontSize: 14,
                        background: isCorrect ? SP.primarySoft : chosen ? SP.roseSoft : 'transparent',
                        color: isCorrect ? SP.primaryDeep : chosen ? SP.roseDeep : SP.textMid,
                        fontWeight: isCorrect || chosen ? 600 : 400,
                      }}
                    >
                      {isCorrect ? '✓ ' : chosen ? '✗ ' : '· '}
                      {o.text}
                      {chosen && uiText("(твой ответ)")}
                    </div>
                  )
                })}
              </div>
              {rev.explanation && (
                <div style={{ marginTop: 8, fontSize: 13, color: SP.textMid }}>{uiText("Пояснение:") + " "}{rev.explanation}</div>
              )}
            </SproutCard>
          )
        })}
      </div>
    </div>
  )
}
