import { uiText } from '../../i18n/uiText'
import { useEffect, useState } from 'react'
import { App as AntdApp, Button, Progress, Spin } from 'antd'
import { Target } from 'lucide-react'

import { SP, SproutCard, SproutEmpty, SproutPageHeader } from '../../components/sprout'
import QuizCard from '../../components/student/QuizCard'
import { examTrackApi, quizApi, type ExamTrack, type QuizSummary } from '../../api/learningApi'

/**
 * Подготовка к экзаменам: направления, которые создала школа, прогресс по
 * каждому и квизы внутри направления.
 */
export default function StudentExamPage() {
  const { message } = AntdApp.useApp()
  const [tracks, setTracks] = useState<ExamTrack[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([])
  const [loadingQuizzes, setLoadingQuizzes] = useState(false)

  useEffect(() => {
    examTrackApi
      .list()
      .then(setTracks)
      .catch((e) => message.error(e?.response?.data?.message || uiText("Не удалось загрузить направления")))
      .finally(() => setLoading(false))
  }, [message])

  const toggle = (id: string) => {
    if (openId === id) {
      setOpenId(null)
      return
    }
    setOpenId(id)
    setLoadingQuizzes(true)
    quizApi
      .list({ examTrackId: id })
      .then(setQuizzes)
      .catch((e) => message.error(e?.response?.data?.message || uiText("Не удалось загрузить квизы")))
      .finally(() => setLoadingQuizzes(false))
  }

  return (
    <div>
      <SproutPageHeader
        title={uiText("Подготовка к экзаменам")}
        icon={<Target size={22} strokeWidth={2} />}
        iconAccent="rose"
        description={uiText("Выбери направление и проходи квизы — прогресс считается по лучшим результатам")}
      />

      <Spin spinning={loading}>
        {tracks.length === 0 ? (
          <SproutCard>
            <SproutEmpty
              icon={<Target size={32} strokeWidth={1.8} />}
              title={uiText("Направлений пока нет")}
              description={uiText("Школа создаёт направления подготовки — они появятся здесь")}
              minHeight={200}
            />
          </SproutCard>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {tracks.map((t) => {
              const p = t.progress
              const donePct = p && p.total > 0 ? Math.round((p.attempted / p.total) * 100) : 0
              return (
                <SproutCard key={t.id} padding={18}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div style={{ fontSize: 17, fontWeight: 700, color: SP.text }}>{t.name}</div>
                      {t.description && <div style={{ fontSize: 13, color: SP.textMid, marginTop: 2 }}>{t.description}</div>}
                      <div style={{ fontSize: 12, color: SP.muted, marginTop: 6 }}>
                        {" " + uiText("Квизов:") + " "}{t.quizzesCount}
                        {p && p.attempted > 0 && p.avgPercent != null ? uiText("· средний результат {0}%", p.avgPercent) : ''}
                      </div>
                    </div>
                    <div style={{ width: 220 }}>
                      <div style={{ fontSize: 12, color: SP.muted, marginBottom: 2 }}>
                        {" " + uiText("Пройдено") + " "}{p?.attempted ?? 0} {" " + uiText("из") + " "}{p?.total ?? 0}
                      </div>
                      <Progress percent={donePct} size="small" strokeColor={SP.primary} />
                    </div>
                    <Button type={openId === t.id ? 'default' : 'primary'} onClick={() => toggle(t.id)}>
                      {openId === t.id ? uiText("Свернуть") : uiText("Квизы")}
                    </Button>
                  </div>

                  {openId === t.id && (
                    <div style={{ marginTop: 14 }}>
                      <Spin spinning={loadingQuizzes}>
                        {quizzes.length === 0 && !loadingQuizzes ? (
                          <SproutEmpty title={uiText("В этом направлении пока нет квизов")} minHeight={100} />
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                            {quizzes.map((q) => (
                              <QuizCard key={q.id} quiz={q} />
                            ))}
                          </div>
                        )}
                      </Spin>
                    </div>
                  )}
                </SproutCard>
              )
            })}
          </div>
        )}
      </Spin>
    </div>
  )
}
