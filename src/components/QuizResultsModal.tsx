import { uiText } from '../i18n/uiText'
import { useEffect, useState } from 'react'
import { App as AntdApp, Button, Modal, Table, Tag } from 'antd'
import dayjs from 'dayjs'

import { quizApi, type QuizResultRow } from '../api/learningApi'

interface Props {
  quiz: { id: string; title: string } | null
  onClose: () => void
}

/** Кто и как прошёл квиз: лучший результат, число попыток и дата последней. */
export default function QuizResultsModal({ quiz, onClose }: Props) {
  const { message } = AntdApp.useApp()
  const [rows, setRows] = useState<QuizResultRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setRows([])
    if (!quiz) return
    setLoading(true)
    quizApi
      .results(quiz.id)
      .then(setRows)
      .catch((e) => message.error(e?.response?.data?.message || uiText("Не удалось загрузить результаты")))
      .finally(() => setLoading(false))
  }, [quiz, message])

  return (
    <Modal
      open={!!quiz}
      onCancel={onClose}
      footer={<Button onClick={onClose}>{uiText("Закрыть")}</Button>}
      title={quiz ? uiText("Результаты: {0}", quiz.title) : uiText("Результаты")}
      width={720}
      destroyOnClose
    >
      <Table<QuizResultRow>
        rowKey={(r) => r.student.id}
        size="small"
        loading={loading}
        dataSource={rows}
        pagination={false}
        locale={{ emptyText: uiText("Пока никто не проходил этот квиз") }}
        columns={[
          { title: uiText("Ученик"), key: 'name', render: (_, r) => `${r.student.lastName} ${r.student.firstName}` },
          { title: uiText("Класс"), key: 'group', width: 90, render: (_, r) => r.student.group ?? '—' },
          {
            title: uiText("Лучший результат"),
            key: 'best',
            width: 170,
            render: (_, r) =>
              r.best ? (
                <Tag color={r.best.percent >= 80 ? 'green' : r.best.percent >= 50 ? 'orange' : 'red'}>
                  {r.best.percent}% ({r.best.score}/{r.best.total})
                </Tag>
              ) : (
                '—'
              ),
          },
          { title: uiText("Попыток"), key: 'attempts', width: 90, align: 'center', render: (_, r) => r.best?.attempts ?? 0 },
          { title: uiText("Последняя"), dataIndex: 'lastAt', width: 130, render: (d: string) => dayjs(d).format('DD.MM.YYYY HH:mm') },
        ]}
      />
    </Modal>
  )
}
