import { useCallback, useEffect, useState } from 'react'
import { App as AntdApp, Avatar, Button, Input, Modal, Segmented, Space, Spin, Table, Tag, Tooltip } from 'antd'
import { MessageOutlined } from '@ant-design/icons'
import { Users } from 'lucide-react'

import { SP, SproutCard, SproutEmpty, SproutPageHeader } from '../components/sprout'
import ClassFilter, { EMPTY_SELECTION, selectionFor, type ClassSelection } from '../components/ClassFilter'
import {
  homeroomApi,
  type HomeroomClass,
  type HomeroomOverview,
  type HomeroomRow,
} from '../api/schoolApi'

/** Быстрые заготовки — текст можно править перед отправкой. */
const QUICK_TEXTS = [
  'Здравствуйте! Ваш ребёнок в последнее время не выполняет домашние задания. Просим обратить внимание.',
  'Здравствуйте! Ваш ребёнок пропускает уроки. Просим сообщить причину и помочь наверстать материал.',
  'Здравствуйте! Просим вас зайти в школу — нужно обсудить успеваемость вашего ребёнка.',
]

/**
 * Сводка по классу для классного руководителя (и админа): кто не делает
 * домашние задания, пропускает уроки, какой средний балл — и сообщение
 * родителям выбранных учеников.
 */
export default function HomeroomPage() {
  const { message } = AntdApp.useApp()
  const [classes, setClasses] = useState<HomeroomClass[] | null>(null)
  // Класс выбирается двумя шагами: параллель → буква; пока не выбран, сводка не показывается.
  const [sel, setSel] = useState<ClassSelection>(EMPTY_SELECTION)
  const groupId = sel.groupId
  const [days, setDays] = useState(14)
  const [data, setData] = useState<HomeroomOverview | null>(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<string[]>([])

  const [writeOpen, setWriteOpen] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  const errorText = (e: any, fallback: string) => e?.response?.data?.message || fallback

  useEffect(() => {
    homeroomApi
      .mine()
      .then((list) => {
        setClasses(list)
        // Класс один — открываем сразу; несколько — выбирает сам пользователь
        if (list.length === 1) setSel((cur) => (cur.groupId ? cur : selectionFor(list, list[0].id)))
      })
      .catch((e) => {
        setClasses([])
        message.error(errorText(e, 'Не удалось загрузить классы'))
      })
  }, [message])

  const load = useCallback(async () => {
    if (!groupId) return
    setLoading(true)
    try {
      setData(await homeroomApi.overview(groupId, days))
      setSelected([])
    } catch (e) {
      message.error(errorText(e, 'Не удалось загрузить сводку'))
    } finally {
      setLoading(false)
    }
  }, [groupId, days, message])

  useEffect(() => {
    load()
  }, [load])

  const send = async () => {
    if (!groupId || selected.length === 0 || !text.trim()) return
    setSending(true)
    try {
      const r = await homeroomApi.notify(groupId, { studentIds: selected, text: text.trim() })
      message.success(
        `Отправлено: ${r.notified} из ${selected.length}` +
          (r.skipped.length ? `. У ${r.skipped.length} нет родителей в системе` : ''),
      )
      setWriteOpen(false)
      setText('')
      setSelected([])
    } catch (e) {
      message.error(errorText(e, 'Не удалось отправить'))
    } finally {
      setSending(false)
    }
  }

  const sections = data?.sections

  return (
    <div>
      <SproutPageHeader
        title="Сводка класса"
        icon={<Users size={22} strokeWidth={2} />}
        iconAccent="blue"
        description="Классному руководителю: кто не делает ДЗ, пропускает уроки, и связь с родителями"
        actions={
          <Space wrap>
            <Segmented
              value={days}
              onChange={(v) => setDays(Number(v))}
              options={[
                { value: 7, label: '7 дней' },
                { value: 14, label: '14 дней' },
                { value: 30, label: '30 дней' },
              ]}
            />
          </Space>
        }
      />

      {classes && classes.length === 0 ? (
        <SproutCard>
          <SproutEmpty
            icon={<Users size={32} strokeWidth={1.8} />}
            title="Вы пока не классный руководитель"
            description="Администратор школы назначает классного руководителя в карточке класса"
            minHeight={220}
          />
        </SproutCard>
      ) : (
        <SproutCard>
          {classes && classes.length > 1 && (
            <div style={{ marginBottom: 14 }}>
              <ClassFilter groups={classes} value={sel} onChange={setSel} />
            </div>
          )}
          {!groupId ? (
            <SproutEmpty
              icon={<Users size={32} strokeWidth={1.8} />}
              title="Выберите класс"
              description="Сначала параллель, затем букву класса. Сводка появится после выбора."
              minHeight={200}
            />
          ) : (
          <>
          <Space style={{ marginBottom: 12 }} wrap>
            <Button
              type="primary"
              icon={<MessageOutlined />}
              disabled={selected.length === 0}
              onClick={() => {
                setText(QUICK_TEXTS[0])
                setWriteOpen(true)
              }}
            >
              Написать родителям ({selected.length})
            </Button>
            {data && sections?.homework && (
              <span style={{ color: SP.muted, fontSize: 13 }}>
                Заданий за период: {data.homeworkCount}
              </span>
            )}
          </Space>

          <Spin spinning={loading}>
            <Table<HomeroomRow>
              rowKey={(r) => r.student.id}
              size="middle"
              pagination={false}
              dataSource={data?.students ?? []}
              rowSelection={{ selectedRowKeys: selected, onChange: (k) => setSelected(k as string[]) }}
              scroll={{ x: 720 }}
              columns={[
                {
                  title: 'Ученик',
                  key: 'student',
                  fixed: 'left',
                  render: (_, r) => (
                    <Space>
                      <Avatar size={30} src={r.student.photoUrl || undefined}>
                        {r.student.firstName.slice(0, 1)}
                      </Avatar>
                      {r.student.lastName} {r.student.firstName}
                    </Space>
                  ),
                },
                ...(sections?.homework
                  ? [
                      {
                        title: 'Домашние задания',
                        key: 'homework',
                        render: (_: unknown, r: HomeroomRow) => {
                          const h = r.homework!
                          return (
                            <Space size={4} wrap>
                              <Tooltip title="Выполнено / частично">
                                <Tag color="green">{h.done + h.partial}</Tag>
                              </Tooltip>
                              <Tooltip title="Не выполнено">
                                <Tag color={h.notDone > 0 ? 'red' : 'default'}>{h.notDone}</Tag>
                              </Tooltip>
                              <Tooltip title="Не отмечено учителем (из заданных за период)">
                                <Tag>{h.unmarked}</Tag>
                              </Tooltip>
                            </Space>
                          )
                        },
                      },
                    ]
                  : []),
                ...(sections?.attendance
                  ? [
                      {
                        title: 'Пропуски',
                        key: 'attendance',
                        render: (_: unknown, r: HomeroomRow) => {
                          const a = r.attendance!
                          const missed = a.absent + a.sick
                          return missed > 0 ? (
                            <Tag color={a.absent > 0 ? 'red' : 'orange'}>
                              {missed} (болезнь {a.sick})
                            </Tag>
                          ) : (
                            <Tag color="green">нет</Tag>
                          )
                        },
                      },
                    ]
                  : []),
                ...(sections?.grades
                  ? [
                      {
                        title: 'Средний балл',
                        key: 'grades',
                        render: (_: unknown, r: HomeroomRow) =>
                          r.grades!.average == null ? '—' : `${r.grades!.average} (${r.grades!.count})`,
                      },
                    ]
                  : []),
                {
                  title: 'Родители',
                  key: 'parents',
                  width: 90,
                  render: (_: unknown, r: HomeroomRow) =>
                    r.parentsCount > 0 ? <Tag color="green">{r.parentsCount}</Tag> : <Tag>нет</Tag>,
                },
              ]}
            />
          </Spin>
          </>
          )}
        </SproutCard>
      )}

      <Modal
        open={writeOpen}
        onCancel={() => setWriteOpen(false)}
        onOk={send}
        okText="Отправить"
        cancelText="Отмена"
        okButtonProps={{ disabled: !text.trim() }}
        confirmLoading={sending}
        title={`Написать родителям: ${selected.length} уч.`}
        destroyOnClose
      >
        <p style={{ marginTop: 0, color: SP.textMid }}>
          Сообщение придёт родителям каждого выбранного ученика (в чате и пуш-уведомлением).
        </p>
        <Space size={[6, 6]} wrap style={{ marginBottom: 8 }}>
          {QUICK_TEXTS.map((t, i) => (
            <Tag key={i} style={{ cursor: 'pointer' }} onClick={() => setText(t)}>
              {['Не делает ДЗ', 'Пропускает уроки', 'Прийти в школу'][i]}
            </Tag>
          ))}
        </Space>
        <Input.TextArea
          rows={5}
          maxLength={2000}
          showCount
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Текст сообщения"
        />
      </Modal>
    </div>
  )
}
