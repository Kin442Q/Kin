import { useEffect, useState } from 'react'
import { App as AntdApp, Spin } from 'antd'
import { ListChecks } from 'lucide-react'

import { SproutCard, SproutEmpty, SproutPageHeader } from '../../components/sprout'
import QuizCard from '../../components/student/QuizCard'
import { quizApi, type QuizSummary } from '../../api/learningApi'

/** Все доступные квизы школы с моим лучшим результатом. */
export default function StudentQuizzesPage() {
  const { message } = AntdApp.useApp()
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    quizApi
      .list()
      .then(setQuizzes)
      .catch((e) => message.error(e?.response?.data?.message || 'Не удалось загрузить квизы'))
      .finally(() => setLoading(false))
  }, [message])

  return (
    <div>
      <SproutPageHeader
        title="Квизы"
        icon={<ListChecks size={22} strokeWidth={2} />}
        iconAccent="mint"
        description="Играй, набирай очки и звёзды. Режим «на скорость» даёт бонус за быстрые ответы, лучший результат запоминается"
      />
      <Spin spinning={loading}>
        {quizzes.length === 0 ? (
          <SproutCard>
            <SproutEmpty
              icon={<ListChecks size={32} strokeWidth={1.8} />}
              title="Квизов пока нет"
              description="Когда учитель опубликует первый квиз, он появится здесь"
              minHeight={200}
            />
          </SproutCard>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {quizzes.map((q) => (
              <QuizCard key={q.id} quiz={q} />
            ))}
          </div>
        )}
      </Spin>
    </div>
  )
}
