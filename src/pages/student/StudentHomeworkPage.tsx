import { uiLanguage, uiText } from '../../i18n/uiText'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { App as AntdApp, Segmented, Spin } from 'antd'
import { BookOpen } from 'lucide-react'
import dayjs from 'dayjs'

import { SproutCard, SproutEmpty, SproutPageHeader } from '../../components/sprout'
import StudentHomeworkCard from '../../components/student/StudentHomeworkCard'
import { studentApi, type StudentHomework, type SubmissionStatus } from '../../api/schoolApi'

type Filter = 'open' | 'done' | 'past'

/** Все мои домашние задания: что надо сделать, что сдано, что прошло. */
export default function StudentHomeworkPage() {
  const { message } = AntdApp.useApp()
  const [items, setItems] = useState<StudentHomework[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('open')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // с запасом назад: 60 дней
      setItems(await studentApi.homework({ from: dayjs().subtract(60, 'day').format('YYYY-MM-DD') }))
    } catch (e: any) {
      message.error(e?.response?.data?.message || uiText("Не удалось загрузить задания"))
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    load()
  }, [load])

  const apply = (id: string, status: SubmissionStatus | null) =>
    setItems((list) =>
      list.map((h) =>
        h.id === id
          ? { ...h, submission: status ? { status, comment: null, updatedAt: new Date().toISOString() } : null }
          : h,
      ),
    )

  const visible = useMemo(() => {
    const today = dayjs().startOf('day')
    return items.filter((h) => {
      const status = h.submission?.status ?? null
      const checked = status === 'DONE' || status === 'PARTIAL' || status === 'NOT_DONE'
      const past = dayjs(h.dueDate).isBefore(today)
      if (filter === 'open') return !checked && !past
      if (filter === 'done') return checked || status === 'SUBMITTED'
      return past && !checked
    })
  }, [items, filter, uiLanguage()])

  return (
    <div>
      <SproutPageHeader
        title={uiText("Домашние задания")}
        icon={<BookOpen size={22} strokeWidth={2} />}
        iconAccent="yellow"
        description={uiText("Что задано в вашем классе. Сделали — нажмите «Я сделал(а)», учитель проверит.")}
        actions={
          <Segmented
            value={filter}
            onChange={(v) => setFilter(v as Filter)}
            options={[
              { value: 'open', label: uiText("Активные") },
              { value: 'done', label: uiText("Сдано") },
              { value: 'past', label: uiText("Прошедшие") },
            ]}
          />
        }
      />

      <Spin spinning={loading}>
        {visible.length === 0 ? (
          <SproutCard>
            <SproutEmpty
              icon={<BookOpen size={32} strokeWidth={1.8} />}
              title={filter === 'open' ? uiText("Заданий нет") : uiText("Здесь пока пусто")}
              description={filter === 'open' ? uiText("Все задания выполнены — отлично!") : undefined}
              minHeight={200}
            />
          </SproutCard>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {visible.map((h) => (
              <StudentHomeworkCard key={h.id} hw={h} onChange={apply} />
            ))}
          </div>
        )}
      </Spin>
    </div>
  )
}
