import { localizeCopy, uiText } from '../i18n/uiText'
import { useCallback, useEffect, useState } from 'react'
import { App as AntdApp, Avatar, Button, Input, Modal, Segmented, Space, Spin, Table, Tag, Tooltip } from 'antd'
import { LinkOutlined, MessageOutlined } from '@ant-design/icons'
import { Users } from 'lucide-react'

import { SP, SproutCard, SproutEmpty, SproutPageHeader } from '../components/sprout'
import ClassFilter, { EMPTY_SELECTION, selectionFor, type ClassSelection } from '../components/ClassFilter'
import ClassLinksModal from '../components/ClassLinksModal'
import { useFeature } from '../hooks/useFeature'
import {
  homeroomApi,
  type HomeroomClass,
  type HomeroomOverview,
  type HomeroomRow,
} from '../api/schoolApi'

/** Быстрые заготовки — текст можно править перед отправкой. */
const QUICK_TEXTS = localizeCopy([
  'Здравствуйте! Ваш ребёнок в последнее время не выполняет домашние задания. Просим обратить внимание.',
  'Здравствуйте! Ваш ребёнок пропускает уроки. Просим сообщить причину и помочь наверстать материал.',
  'Здравствуйте! Просим вас зайти в школу — нужно обсудить успеваемость вашего ребёнка.',
])

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
  // Личные ссылки входа учеников класса (кабинет ученика должен быть включён)
  const portalOn = useFeature('portal')
  const [linksOpen, setLinksOpen] = useState(false)

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
        message.error(errorText(e, uiText("Не удалось загрузить классы")))
      })
  }, [message])

  const load = useCallback(async () => {
    if (!groupId) return
    setLoading(true)
    try {
      setData(await homeroomApi.overview(groupId, days))
      setSelected([])
    } catch (e) {
      message.error(errorText(e, uiText("Не удалось загрузить сводку")))
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
        uiText("Отправлено: {0} из {1}", r.notified, selected.length) +
          (r.skipped.length ? uiText(". У {0} нет родителей в системе", r.skipped.length) : ''),
      )
      setWriteOpen(false)
      setText('')
      setSelected([])
    } catch (e) {
      message.error(errorText(e, uiText("Не удалось отправить")))
    } finally {
      setSending(false)
    }
  }

  const sections = data?.sections

  return (
    <div>
      <SproutPageHeader
        title={uiText("Сводка класса")}
        icon={<Users size={22} strokeWidth={2} />}
        iconAccent="blue"
        description={uiText("Классному руководителю: кто не делает ДЗ, пропускает уроки, и связь с родителями")}
        actions={
          <Space wrap>
            <Segmented
              value={days}
              onChange={(v) => setDays(Number(v))}
              options={[
                { value: 7, label: uiText("7 дней") },
                { value: 14, label: uiText("14 дней") },
                { value: 30, label: uiText("30 дней") },
              ]}
            />
          </Space>
        }
      />

      {classes && classes.length === 0 ? (
        <SproutCard>
          <SproutEmpty
            icon={<Users size={32} strokeWidth={1.8} />}
            title={uiText("Вы пока не классный руководитель")}
            description={uiText("Администратор школы назначает классного руководителя в карточке класса")}
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
              title={uiText("Выберите класс")}
              description={uiText("Сначала параллель, затем букву класса. Сводка появится после выбора.")}
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
              {" " + uiText("Написать родителям (")}{selected.length})
            </Button>
            {portalOn && (
              <Button icon={<LinkOutlined />} disabled={!groupId} onClick={() => setLinksOpen(true)}>
                {" " + uiText("Ссылки класса") + " "}</Button>
            )}
            {data && sections?.homework && (
              <span style={{ color: SP.muted, fontSize: 13 }}>
                {" " + uiText("Заданий за период:") + " "}{data.homeworkCount}
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
                  title: uiText("Ученик"),
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
                        title: uiText("Домашние задания"),
                        key: 'homework',
                        render: (_: unknown, r: HomeroomRow) => {
                          const h = r.homework!
                          return (
                            <Space size={4} wrap>
                              <Tooltip title={uiText("Выполнено / частично")}>
                                <Tag color="green">{h.done + h.partial}</Tag>
                              </Tooltip>
                              <Tooltip title={uiText("Не выполнено")}>
                                <Tag color={h.notDone > 0 ? 'red' : 'default'}>{h.notDone}</Tag>
                              </Tooltip>
                              <Tooltip title={uiText("Не отмечено учителем (из заданных за период)")}>
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
                        title: uiText("Пропуски"),
                        key: 'attendance',
                        render: (_: unknown, r: HomeroomRow) => {
                          const a = r.attendance!
                          const missed = a.absent + a.sick
                          return missed > 0 ? (
                            <Tag color={a.absent > 0 ? 'red' : 'orange'}>
                              {missed} {" " + uiText("(болезнь") + " "}{a.sick})
                            </Tag>
                          ) : (
                            <Tag color="green">{uiText("нет")}</Tag>
                          )
                        },
                      },
                    ]
                  : []),
                ...(sections?.grades
                  ? [
                      {
                        title: uiText("Средний балл"),
                        key: 'grades',
                        render: (_: unknown, r: HomeroomRow) =>
                          r.grades!.average == null ? '—' : `${r.grades!.average} (${r.grades!.count})`,
                      },
                    ]
                  : []),
                {
                  title: uiText("Родители"),
                  key: 'parents',
                  width: 90,
                  render: (_: unknown, r: HomeroomRow) =>
                    r.parentsCount > 0 ? <Tag color="green">{r.parentsCount}</Tag> : <Tag>{uiText("нет")}</Tag>,
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
        okText={uiText("Отправить")}
        cancelText={uiText("Отмена")}
        okButtonProps={{ disabled: !text.trim() }}
        confirmLoading={sending}
        title={uiText("Написать родителям: {0} уч.", selected.length)}
        destroyOnClose
      >
        <p style={{ marginTop: 0, color: SP.textMid }}>
          {" " + uiText("Сообщение придёт родителям каждого выбранного ученика (в чате и пуш-уведомлением).") + " "}</p>
        <Space size={[6, 6]} wrap style={{ marginBottom: 8 }}>
          {QUICK_TEXTS.map((t, i) => (
            <Tag key={i} style={{ cursor: 'pointer' }} onClick={() => setText(t)}>
              {[uiText("Не делает ДЗ"), uiText("Пропускает уроки"), uiText("Прийти в школу")][i]}
            </Tag>
          ))}
        </Space>
        <Input.TextArea
          rows={5}
          maxLength={2000}
          showCount
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={uiText("Текст сообщения")}
        />
      </Modal>

      <ClassLinksModal
        group={linksOpen && groupId ? { id: groupId, name: classes?.find((c) => c.id === groupId)?.name ?? '' } : null}
        onClose={() => setLinksOpen(false)}
      />
    </div>
  )
}
