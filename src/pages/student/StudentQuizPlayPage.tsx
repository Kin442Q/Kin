import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { App as AntdApp, Button, Progress, Result, Spin, Tag } from 'antd'
import { CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons'

import { SP, SproutCard } from '../../components/sprout'
import { quizApi, type AttemptResult, type PlayQuiz } from '../../api/learningApi'

type Stage = 'intro' | 'run' | 'result'

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

/** Прохождение квиза: вопросы по одному, таймер (если есть лимит), разбор после сдачи. */
export default function StudentQuizPlayPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { message } = AntdApp.useApp()

  const [quiz, setQuiz] = useState<PlayQuiz | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stage, setStage] = useState<Stage>('intro')
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number[]>>({})
  const [startedAt, setStartedAt] = useState(0)
  const [left, setLeft] = useState<number | null>(null)
  const [result, setResult] = useState<AttemptResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const sent = useRef(false)

  useEffect(() => {
    if (!id) return
    quizApi
      .play(id)
      .then(setQuiz)
      .catch((e) => setError(e?.response?.data?.message || 'Квиз недоступен'))
  }, [id])

  const submit = useCallback(async () => {
    if (!quiz || !id || sent.current) return
    sent.current = true
    setSubmitting(true)
    try {
      const r = await quizApi.submit(id, {
        answers: quiz.questions.map((q) => ({ questionId: q.id, selected: answers[q.id] ?? [] })),
        durationSec: Math.round((Date.now() - startedAt) / 1000),
      })
      setResult(r)
      setStage('result')
    } catch (e: any) {
      sent.current = false
      message.error(e?.response?.data?.message || 'Не удалось отправить ответы')
    } finally {
      setSubmitting(false)
    }
  }, [quiz, id, answers, startedAt, message])

  // Таймер: время вышло — отправляем то, что успели ответить.
  useEffect(() => {
    if (stage !== 'run' || !quiz?.timeLimitSec) return
    const limit = quiz.timeLimitSec
    const tick = () => {
      const remaining = limit - Math.floor((Date.now() - startedAt) / 1000)
      setLeft(Math.max(remaining, 0))
      if (remaining <= 0) submit()
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [stage, quiz, startedAt, submit])

  const start = () => {
    sent.current = false
    setAnswers({})
    setIdx(0)
    setResult(null)
    setStartedAt(Date.now())
    setStage('run')
  }

  if (error) {
    return (
      <Result
        status="404"
        title="Квиз недоступен"
        subTitle={error}
        extra={<Button type="primary" onClick={() => navigate('/student/quizzes')}>К квизам</Button>}
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
      <SproutCard padding={28} style={{ maxWidth: 620, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: SP.text }}>{quiz.title}</div>
        {quiz.description && <div style={{ color: SP.textMid, marginTop: 6 }}>{quiz.description}</div>}
        <div style={{ margin: '18px 0', color: SP.muted }}>
          Вопросов: {quiz.questions.length}
          {quiz.timeLimitSec ? ` · время: ${Math.round(quiz.timeLimitSec / 60)} мин` : ' · без ограничения по времени'}
        </div>
        <Button type="primary" size="large" onClick={start}>
          Начать
        </Button>{' '}
        <Button size="large" onClick={() => navigate('/student/quizzes')}>
          Назад
        </Button>
      </SproutCard>
    )
  }

  // ─── Прохождение ──────────────────────────────────────────────
  if (stage === 'run') {
    const q = quiz.questions[idx]
    const picked = answers[q.id] ?? []
    const last = idx === quiz.questions.length - 1

    const choose = (i: number) =>
      setAnswers((a) => {
        const cur = a[q.id] ?? []
        if (q.kind === 'SINGLE') return { ...a, [q.id]: [i] }
        return { ...a, [q.id]: cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i] }
      })

    return (
      <SproutCard padding={24} style={{ maxWidth: 700, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: SP.muted, fontSize: 13, marginBottom: 6 }}>
          <span>
            Вопрос {idx + 1} из {quiz.questions.length}
          </span>
          {left !== null && (
            <span style={{ color: left <= 30 ? SP.danger : SP.muted, fontWeight: 700 }}>⏱ {mmss(left)}</span>
          )}
        </div>
        <Progress percent={Math.round((idx / quiz.questions.length) * 100)} showInfo={false} size="small" strokeColor={SP.primary} />

        <div style={{ fontSize: 19, fontWeight: 700, margin: '16px 0 4px', color: SP.text }}>{q.text}</div>
        {q.kind === 'MULTIPLE' && <Tag color="blue">Выберите все верные ответы</Tag>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
          {q.options.map((o, i) => {
            const on = picked.includes(i)
            return (
              <button
                key={i}
                type="button"
                onClick={() => choose(i)}
                aria-pressed={on}
                style={{
                  textAlign: 'left',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: `2px solid ${on ? SP.primary : SP.borderSoft}`,
                  background: on ? SP.primaryGhost : SP.surface,
                  fontSize: 15,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ marginRight: 8 }}>{q.kind === 'MULTIPLE' ? (on ? '☑' : '☐') : on ? '●' : '○'}</span>
                {o.text}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
          <Button disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>
            ← Назад
          </Button>
          {last ? (
            <Button type="primary" loading={submitting} onClick={submit}>
              Завершить
            </Button>
          ) : (
            <Button type="primary" onClick={() => setIdx((i) => i + 1)}>
              Дальше →
            </Button>
          )}
        </div>
      </SproutCard>
    )
  }

  // ─── Результат и разбор ───────────────────────────────────────
  const r = result!
  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <SproutCard padding={24} style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ color: SP.muted }}>{quiz.title}</div>
        <div
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: r.percent >= 80 ? SP.primaryDeep : r.percent >= 50 ? SP.yellowDeep : SP.danger,
          }}
        >
          {r.percent}%
        </div>
        <div style={{ color: SP.textMid }}>
          Верно {r.score} из {r.total}
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'center' }}>
          <Button type="primary" onClick={start}>
            Пройти ещё раз
          </Button>
          <Button onClick={() => navigate('/student/quizzes')}>К квизам</Button>
        </div>
      </SproutCard>

      <div style={{ fontSize: 16, fontWeight: 700, margin: '4px 4px 10px' }}>Разбор ответов</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {quiz.questions.map((q, n) => {
          const rev = r.review.find((x) => x.questionId === q.id)
          if (!rev) return null
          return (
            <SproutCard key={q.id} padding={16}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                {rev.correct ? (
                  <CheckCircleFilled style={{ color: SP.primary, fontSize: 18, marginTop: 3 }} />
                ) : (
                  <CloseCircleFilled style={{ color: SP.danger, fontSize: 18, marginTop: 3 }} />
                )}
                <div style={{ fontWeight: 700 }}>
                  {n + 1}. {q.text}
                </div>
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
                        borderRadius: 8,
                        fontSize: 14,
                        background: isCorrect ? 'rgba(16,185,129,0.12)' : chosen ? 'rgba(239,68,68,0.10)' : 'transparent',
                        color: isCorrect ? SP.primaryDeep : chosen ? SP.danger : SP.textMid,
                        fontWeight: isCorrect || chosen ? 600 : 400,
                      }}
                    >
                      {isCorrect ? '✓ ' : chosen ? '✗ ' : '· '}
                      {o.text}
                      {chosen && ' (твой ответ)'}
                    </div>
                  )
                })}
              </div>
              {rev.explanation && (
                <div style={{ marginTop: 8, fontSize: 13, color: SP.textMid }}>💡 {rev.explanation}</div>
              )}
            </SproutCard>
          )
        })}
      </div>
    </div>
  )
}
