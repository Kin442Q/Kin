import { useCallback, useEffect, useState } from 'react'
import { App as AntdApp, Button, Popconfirm, Space, Switch, Table, Tabs, Tag, Tooltip } from 'antd'
import { BarChartOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { ListChecks } from 'lucide-react'

import { SproutCard, SproutPageHeader } from '../components/sprout'
import QuizEditorModal from '../components/QuizEditorModal'
import QuizResultsModal from '../components/QuizResultsModal'
import ExamTracksPanel from '../components/ExamTracksPanel'
import { useAuthStore } from '../store/authStore'
import { useFeature } from '../hooks/useFeature'
import { http } from '../api'
import { examTrackApi, quizApi, type ExamTrack, type QuizSummary } from '../api/learningApi'

/** Квизы и направления подготовки к экзаменам: создание, публикация, результаты учеников. */
export default function QuizzesPage() {
  const { message } = AntdApp.useApp()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'admin' || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'
  const examOn = useFeature('exam_prep')

  const [quizzes, setQuizzes] = useState<QuizSummary[]>([])
  const [tracks, setTracks] = useState<ExamTrack[]>([])
  const [subjects, setSubjects] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [editor, setEditor] = useState<string | 'new' | null>(null)
  const [results, setResults] = useState<{ id: string; title: string } | null>(null)

  const errorText = (e: any, fallback: string) => e?.response?.data?.message || fallback

  const loadQuizzes = useCallback(() => {
    setLoading(true)
    quizApi
      .list()
      .then(setQuizzes)
      .catch((e) => message.error(errorText(e, 'Не удалось загрузить квизы')))
      .finally(() => setLoading(false))
  }, [message])

  const loadTracks = useCallback(() => {
    if (!examOn) return
    examTrackApi.list().then(setTracks).catch(() => setTracks([]))
  }, [examOn])

  useEffect(() => {
    loadQuizzes()
  }, [loadQuizzes])

  useEffect(() => {
    loadTracks()
  }, [loadTracks])

  useEffect(() => {
    http
      .get<Array<{ id: string; name: string }>>('/v1/subjects')
      .then((r) => setSubjects(r.data))
      .catch(() => setSubjects([]))
  }, [])

  const canManage = (q: QuizSummary) => isAdmin || q.authorId === user?.id

  const togglePublish = async (q: QuizSummary, value: boolean) => {
    try {
      await quizApi.update(q.id, { isPublished: value })
      setQuizzes((list) => list.map((x) => (x.id === q.id ? { ...x, isPublished: value } : x)))
    } catch (e) {
      message.error(errorText(e, 'Не удалось изменить'))
    }
  }

  const remove = async (q: QuizSummary) => {
    try {
      await quizApi.remove(q.id)
      message.success('Квиз удалён')
      loadQuizzes()
      loadTracks()
    } catch (e) {
      message.error(errorText(e, 'Не удалось удалить'))
    }
  }

  const quizzesTab = (
    <Table<QuizSummary>
      rowKey="id"
      size="middle"
      loading={loading}
      dataSource={quizzes}
      pagination={{ pageSize: 15, hideOnSinglePage: true }}
      scroll={{ x: 760 }}
      locale={{ emptyText: 'Квизов пока нет. Нажмите «Новый квиз»' }}
      columns={[
        {
          title: 'Квиз',
          key: 'title',
          render: (_, q) => (
            <div>
              <b>{q.title}</b>
              <div style={{ marginTop: 2 }}>
                {q.subject && <Tag style={{ background: q.subject.color, color: '#fff', border: 'none' }}>{q.subject.name}</Tag>}
                {q.examTrack && <Tag color="purple">{q.examTrack.name}</Tag>}
              </div>
            </div>
          ),
        },
        { title: 'Вопросов', dataIndex: 'questionsCount', width: 90, align: 'center' },
        { title: 'Попыток', dataIndex: 'attemptsCount', width: 90, align: 'center' },
        { title: 'Автор', key: 'author', width: 160, render: (_, q) => q.author?.fullName ?? '—' },
        {
          title: 'Опубликован',
          key: 'pub',
          width: 120,
          align: 'center',
          render: (_, q) => (
            <Tooltip title={q.isPublished ? 'Виден ученикам' : 'Черновик — ученики не видят'}>
              <Switch size="small" checked={q.isPublished} disabled={!canManage(q)} onChange={(v) => togglePublish(q, v)} />
            </Tooltip>
          ),
        },
        {
          title: '',
          key: 'actions',
          width: 130,
          render: (_, q) => (
            <Space size={0}>
              <Tooltip title="Результаты учеников">
                <Button size="small" type="text" icon={<BarChartOutlined />} onClick={() => setResults({ id: q.id, title: q.title })} />
              </Tooltip>
              {canManage(q) && (
                <>
                  <Tooltip title="Редактировать">
                    <Button size="small" type="text" icon={<EditOutlined />} onClick={() => setEditor(q.id)} />
                  </Tooltip>
                  <Popconfirm
                    title={`Удалить «${q.title}»?`}
                    description="Попытки учеников тоже удалятся."
                    okText="Удалить"
                    cancelText="Отмена"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => remove(q)}
                  >
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </>
              )}
            </Space>
          ),
        },
      ]}
    />
  )

  return (
    <div>
      <SproutPageHeader
        title="Квизы"
        icon={<ListChecks size={22} strokeWidth={2} />}
        iconAccent="mint"
        description="Тесты с автоматической проверкой и подготовка к экзаменам"
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditor('new')}>
            Новый квиз
          </Button>
        }
      />

      <SproutCard>
        {examOn ? (
          <Tabs
            items={[
              { key: 'quizzes', label: 'Квизы', children: quizzesTab },
              {
                key: 'tracks',
                label: 'Направления подготовки',
                children: <ExamTracksPanel tracks={tracks} onChanged={() => { loadTracks(); loadQuizzes() }} />,
              },
            ]}
          />
        ) : (
          quizzesTab
        )}
      </SproutCard>

      <QuizEditorModal
        target={editor}
        subjects={subjects}
        tracks={examOn ? tracks : []}
        onClose={() => setEditor(null)}
        onSaved={() => {
          loadQuizzes()
          loadTracks()
        }}
      />
      <QuizResultsModal quiz={results} onClose={() => setResults(null)} />
    </div>
  )
}
