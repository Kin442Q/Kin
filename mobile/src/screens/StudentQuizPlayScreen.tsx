import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'

import Screen from '../components/Screen'
import Card from '../components/Card'
import Btn from '../components/Btn'
import StackHeader from '../components/StackHeader'
import EmptyState from '../components/EmptyState'
import { colors, radius } from '../theme/colors'
import { quizApi, type AttemptResult, type PlayQuiz } from '../api/learning'

type Stage = 'intro' | 'run' | 'result'

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

/** Прохождение квиза: вопросы по одному, таймер (если есть лимит), разбор после сдачи. */
export default function StudentQuizPlayScreen() {
  const navigation = useNavigation()
  const { id } = useRoute<any>().params as { id: string }

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
    quizApi
      .play(id)
      .then(setQuiz)
      .catch((e) => setError(e?.response?.data?.message || 'Квиз недоступен'))
  }, [id])

  const submit = useCallback(async () => {
    if (!quiz || sent.current) return
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
      Alert.alert('Ошибка', e?.response?.data?.message || 'Не удалось отправить ответы')
    } finally {
      setSubmitting(false)
    }
  }, [quiz, id, answers, startedAt])

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
    setLeft(null)
    setStartedAt(Date.now())
    setStage('run')
  }

  if (error) {
    return (
      <Screen>
        <StackHeader title="Квиз" />
        <EmptyState title="Квиз недоступен" hint={error} />
      </Screen>
    )
  }
  if (!quiz) {
    return (
      <Screen>
        <StackHeader title="Квиз" />
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    )
  }

  // ─── Вступление ───────────────────────────────────────────────
  if (stage === 'intro') {
    return (
      <Screen>
        <StackHeader title="Квиз" />
        <View style={styles.center}>
          <Card padding={24} style={{ alignItems: 'center', gap: 8 }}>
            <Text style={styles.bigTitle}>{quiz.title}</Text>
            {quiz.description ? <Text style={styles.desc}>{quiz.description}</Text> : null}
            <Text style={styles.meta}>
              Вопросов: {quiz.questions.length}
              {quiz.timeLimitSec
                ? ` · время: ${Math.round(quiz.timeLimitSec / 60)} мин`
                : ' · без ограничения по времени'}
            </Text>
            <Btn block size="lg" onPress={start} style={{ marginTop: 10 }}>
              Начать
            </Btn>
          </Card>
        </View>
      </Screen>
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
      <Screen>
        <StackHeader title={quiz.title} />
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.progressRow}>
            <Text style={styles.meta}>
              Вопрос {idx + 1} из {quiz.questions.length}
            </Text>
            {left !== null && (
              <Text style={[styles.timer, left <= 30 && { color: colors.danger }]}>⏱ {mmss(left)}</Text>
            )}
          </View>
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${Math.round((idx / quiz.questions.length) * 100)}%` }]} />
          </View>

          <Text style={styles.question}>{q.text}</Text>
          {q.kind === 'MULTIPLE' && <Text style={styles.hint}>Выберите все верные ответы</Text>}

          <View style={{ gap: 10, marginTop: 6 }}>
            {q.options.map((o, i) => {
              const on = picked.includes(i)
              return (
                <Pressable
                  key={i}
                  onPress={() => choose(i)}
                  accessibilityState={{ selected: on }}
                  style={[
                    styles.option,
                    {
                      borderColor: on ? colors.primary : colors.borderSoft,
                      backgroundColor: on ? colors.primaryGhost : colors.surface,
                    },
                  ]}
                >
                  <Text style={styles.mark}>
                    {q.kind === 'MULTIPLE' ? (on ? '☑' : '☐') : on ? '●' : '○'}
                  </Text>
                  <Text style={styles.optionText}>{o.text}</Text>
                </Pressable>
              )
            })}
          </View>

          <View style={styles.nav}>
            <Btn variant="secondary" disabled={idx === 0} onPress={() => setIdx((i) => i - 1)}>
              ← Назад
            </Btn>
            {last ? (
              <Btn loading={submitting} onPress={submit}>
                Завершить
              </Btn>
            ) : (
              <Btn onPress={() => setIdx((i) => i + 1)}>Дальше →</Btn>
            )}
          </View>
        </ScrollView>
      </Screen>
    )
  }

  // ─── Результат и разбор ───────────────────────────────────────
  const r = result!
  const tone = r.percent >= 80 ? colors.primaryDeep : r.percent >= 50 ? colors.yellowDeep : colors.danger
  return (
    <Screen>
      <StackHeader title="Результат" />
      <ScrollView contentContainerStyle={styles.container}>
        <Card padding={22} style={{ alignItems: 'center' }}>
          <Text style={styles.meta}>{quiz.title}</Text>
          <Text style={[styles.percent, { color: tone }]}>{r.percent}%</Text>
          <Text style={styles.desc}>
            Верно {r.score} из {r.total}
          </Text>
          <View style={styles.nav}>
            <Btn onPress={start}>Ещё раз</Btn>
            <Btn variant="secondary" onPress={() => navigation.goBack()}>
              К квизам
            </Btn>
          </View>
        </Card>

        <Text style={styles.section}>Разбор ответов</Text>
        {quiz.questions.map((q, n) => {
          const rev = r.review.find((x) => x.questionId === q.id)
          if (!rev) return null
          return (
            <Card key={q.id} padding={14} style={{ gap: 6 }}>
              <Text style={styles.reviewQ}>
                {rev.correct ? '✅' : '❌'} {n + 1}. {q.text}
              </Text>
              {q.options.map((o, i) => {
                const isCorrect = rev.correctOptions.includes(i)
                const chosen = rev.selected.includes(i)
                return (
                  <Text
                    key={i}
                    style={[
                      styles.reviewOpt,
                      {
                        backgroundColor: isCorrect
                          ? colors.primaryGhost
                          : chosen
                            ? colors.roseSoft
                            : 'transparent',
                        color: isCorrect ? colors.primaryDeep : chosen ? colors.danger : colors.textMid,
                        fontWeight: isCorrect || chosen ? '700' : '500',
                      },
                    ]}
                  >
                    {isCorrect ? '✓ ' : chosen ? '✗ ' : '· '}
                    {o.text}
                    {chosen ? ' (твой ответ)' : ''}
                  </Text>
                )
              })}
              {rev.explanation ? <Text style={styles.explain}>💡 {rev.explanation}</Text> : null}
            </Card>
          )
        })}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, padding: 16, justifyContent: 'center' },
  container: { padding: 16, paddingBottom: 40, gap: 12 },
  bigTitle: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
  desc: { fontSize: 14, color: colors.textMid, textAlign: 'center' },
  meta: { fontSize: 12.5, color: colors.muted },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  timer: { fontSize: 13, fontWeight: '800', color: colors.muted },
  bar: { height: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  barFill: { height: 6, backgroundColor: colors.primary },
  question: { fontSize: 19, fontWeight: '800', color: colors.text, marginTop: 8 },
  hint: { fontSize: 12.5, fontWeight: '700', color: colors.blueDeep },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 2,
  },
  mark: { fontSize: 16, color: colors.primaryDeep },
  optionText: { flex: 1, fontSize: 15, color: colors.text },
  nav: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 14 },
  percent: { fontSize: 56, fontWeight: '800', marginTop: 4 },
  section: { fontSize: 15, fontWeight: '800', color: colors.text, marginTop: 6 },
  reviewQ: { fontSize: 14.5, fontWeight: '800', color: colors.text },
  reviewOpt: { fontSize: 13.5, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 8, overflow: 'hidden' },
  explain: { fontSize: 13, color: colors.textMid, marginTop: 4 },
})
