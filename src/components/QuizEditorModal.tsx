import { useEffect, useState } from 'react'
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Checkbox,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Space,
  Spin,
  Switch,
  Typography,
} from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'

import {
  quizApi,
  type ExamTrack,
  type QuestionKind,
  type QuizInput,
  type QuizOption,
} from '../api/learningApi'

const { Text } = Typography

interface DraftQuestion {
  key: string
  text: string
  kind: QuestionKind
  options: QuizOption[]
  explanation: string
}

interface SubjectOpt {
  id: string
  name: string
}

interface Props {
  /** null — окно закрыто; 'new' — новый квиз; иначе id редактируемого квиза. */
  target: string | 'new' | null
  subjects: SubjectOpt[]
  tracks: ExamTrack[]
  onClose: () => void
  onSaved: () => void
}

let counter = 0
const newKey = () => `q${++counter}`

const emptyQuestion = (): DraftQuestion => ({
  key: newKey(),
  text: '',
  kind: 'SINGLE',
  options: [
    { text: '', correct: true },
    { text: '', correct: false },
  ],
  explanation: '',
})

/**
 * Редактор квиза: название, предмет, направление, лимит времени и вопросы
 * с вариантами ответов (один или несколько правильных).
 */
export default function QuizEditorModal({ target, subjects, tracks, onClose, onSaved }: Props) {
  const { message } = AntdApp.useApp()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [subjectId, setSubjectId] = useState<string | undefined>()
  const [examTrackId, setExamTrackId] = useState<string | undefined>()
  const [timeLimitMin, setTimeLimitMin] = useState<number | null>(null)
  const [isPublished, setIsPublished] = useState(false)
  const [questions, setQuestions] = useState<DraftQuestion[]>([emptyQuestion()])

  useEffect(() => {
    setError(null)
    if (target === null) return
    if (target === 'new') {
      setTitle('')
      setDescription('')
      setSubjectId(undefined)
      setExamTrackId(undefined)
      setTimeLimitMin(null)
      setIsPublished(false)
      setQuestions([emptyQuestion()])
      return
    }
    setLoading(true)
    quizApi
      .get(target)
      .then((q) => {
        setTitle(q.title)
        setDescription(q.description ?? '')
        setSubjectId(q.subjectId ?? undefined)
        setExamTrackId(q.examTrackId ?? undefined)
        setTimeLimitMin(q.timeLimitSec ? Math.round(q.timeLimitSec / 60) : null)
        setIsPublished(q.isPublished)
        setQuestions(
          q.questions.map((x) => ({
            key: newKey(),
            text: x.text,
            kind: x.kind,
            options: x.options.map((o) => ({ ...o })),
            explanation: x.explanation ?? '',
          })),
        )
      })
      .catch((e) => {
        message.error(e?.response?.data?.message || 'Не удалось загрузить квиз')
        onClose()
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  const patchQuestion = (key: string, patch: Partial<DraftQuestion>) =>
    setQuestions((list) => list.map((q) => (q.key === key ? { ...q, ...patch } : q)))

  const setKind = (q: DraftQuestion, kind: QuestionKind) => {
    // Один правильный ответ: если было отмечено несколько — оставляем первый.
    let options = q.options
    if (kind === 'SINGLE') {
      const first = options.findIndex((o) => o.correct)
      options = options.map((o, i) => ({ ...o, correct: i === (first < 0 ? 0 : first) }))
    }
    patchQuestion(q.key, { kind, options })
  }

  const setCorrect = (q: DraftQuestion, index: number, checked: boolean) => {
    const options =
      q.kind === 'SINGLE'
        ? q.options.map((o, i) => ({ ...o, correct: i === index }))
        : q.options.map((o, i) => (i === index ? { ...o, correct: checked } : o))
    patchQuestion(q.key, { options })
  }

  const save = async () => {
    setError(null)
    const body: QuizInput = {
      title: title.trim(),
      description: description.trim() || null,
      subjectId: subjectId ?? null,
      examTrackId: examTrackId ?? null,
      timeLimitSec: timeLimitMin ? timeLimitMin * 60 : null,
      isPublished,
      questions: questions.map((q) => ({
        text: q.text.trim(),
        kind: q.kind,
        options: q.options.map((o) => ({ text: o.text.trim(), correct: o.correct })),
        explanation: q.explanation.trim() || null,
      })),
    }
    if (!body.title) {
      setError('Введите название квиза')
      return
    }
    setSaving(true)
    try {
      if (target === 'new') await quizApi.create(body)
      else await quizApi.update(target as string, body)
      message.success(target === 'new' ? 'Квиз создан' : 'Квиз сохранён')
      onSaved()
      onClose()
    } catch (e: any) {
      const m = e?.response?.data?.message
      // сервер называет номер вопроса и что не так — показываем как есть
      setError(Array.isArray(m) ? m.join('; ') : m || 'Не удалось сохранить квиз')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={target !== null}
      onCancel={onClose}
      width={820}
      title={target === 'new' ? 'Новый квиз' : 'Редактировать квиз'}
      okText="Сохранить"
      cancelText="Отмена"
      onOk={save}
      confirmLoading={saving}
      destroyOnClose
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
    >
      <Spin spinning={loading}>
        {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}

        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <Input placeholder="Название квиза" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
          <Input.TextArea
            placeholder="Описание (необязательно)"
            rows={2}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Space wrap>
            <Select
              allowClear
              placeholder="Предмет"
              style={{ width: 200 }}
              value={subjectId}
              onChange={setSubjectId}
              options={subjects.map((s) => ({ value: s.id, label: s.name }))}
            />
            {tracks.length > 0 && (
              <Select
                allowClear
                placeholder="Направление подготовки"
                style={{ width: 240 }}
                value={examTrackId}
                onChange={setExamTrackId}
                options={tracks.map((t) => ({ value: t.id, label: t.name }))}
              />
            )}
            <InputNumber
              min={1}
              max={240}
              placeholder="Лимит, мин"
              value={timeLimitMin}
              onChange={(v) => setTimeLimitMin(v)}
              style={{ width: 130 }}
            />
            <Space>
              <Switch checked={isPublished} onChange={setIsPublished} />
              <Text>{isPublished ? 'Опубликован — виден ученикам' : 'Черновик'}</Text>
            </Space>
          </Space>
        </Space>

        <div style={{ margin: '16px 0 8px', fontWeight: 700 }}>Вопросы ({questions.length})</div>

        {questions.map((q, n) => (
          <Card
            key={q.key}
            size="small"
            style={{ marginBottom: 12 }}
            title={`Вопрос ${n + 1}`}
            extra={
              <Button
                size="small"
                type="text"
                danger
                icon={<DeleteOutlined />}
                disabled={questions.length === 1}
                onClick={() => setQuestions((list) => list.filter((x) => x.key !== q.key))}
              />
            }
          >
            <Input.TextArea
              rows={2}
              placeholder="Текст вопроса"
              maxLength={1000}
              value={q.text}
              onChange={(e) => patchQuestion(q.key, { text: e.target.value })}
            />
            <div style={{ margin: '8px 0' }}>
              <Radio.Group
                size="small"
                value={q.kind}
                onChange={(e) => setKind(q, e.target.value)}
                options={[
                  { value: 'SINGLE', label: 'Один правильный ответ' },
                  { value: 'MULTIPLE', label: 'Несколько правильных' },
                ]}
              />
            </div>

            {q.options.map((o, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                {q.kind === 'SINGLE' ? (
                  <Radio checked={o.correct} onChange={() => setCorrect(q, i, true)} />
                ) : (
                  <Checkbox checked={o.correct} onChange={(e) => setCorrect(q, i, e.target.checked)} />
                )}
                <Input
                  placeholder={`Вариант ${i + 1}`}
                  maxLength={300}
                  value={o.text}
                  onChange={(e) =>
                    patchQuestion(q.key, {
                      options: q.options.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)),
                    })
                  }
                />
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  disabled={q.options.length <= 2}
                  onClick={() => patchQuestion(q.key, { options: q.options.filter((_, j) => j !== i) })}
                />
              </div>
            ))}
            <Space>
              <Button
                size="small"
                icon={<PlusOutlined />}
                disabled={q.options.length >= 8}
                onClick={() => patchQuestion(q.key, { options: [...q.options, { text: '', correct: false }] })}
              >
                Вариант
              </Button>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Отметка слева — правильный ответ
              </Text>
            </Space>
            <Input
              style={{ marginTop: 8 }}
              placeholder="Пояснение к ответу (покажется ученику после сдачи)"
              maxLength={1000}
              value={q.explanation}
              onChange={(e) => patchQuestion(q.key, { explanation: e.target.value })}
            />
          </Card>
        ))}

        <Button
          icon={<PlusOutlined />}
          disabled={questions.length >= 100}
          onClick={() => setQuestions((list) => [...list, emptyQuestion()])}
        >
          Добавить вопрос
        </Button>
      </Spin>
    </Modal>
  )
}
