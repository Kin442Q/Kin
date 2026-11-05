import { useCallback, useEffect, useState } from 'react'
import { App as AntdApp, Button, Modal, Space, Spin, Table, Tag } from 'antd'
import { PrinterOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

import { studentAccountApi, type ClassLinkRow, type ClassLinks } from '../api/schoolApi'
import { printStudentCards } from '../lib/studentCards'

interface Props {
  /** Класс, для которого открыт список; null — окно закрыто. */
  group: { id: string; name: string } | null
  onClose: () => void
}

const fullName = (r: ClassLinkRow) => `${r.lastName} ${r.firstName}`.trim()

/**
 * Ссылки входа всего класса: кто уже получил, кто заходил. «Выдать всем» создаёт
 * недостающие, «Печать карточек» открывает листок с QR-кодами по одному на ученика —
 * его режут и раздают.
 */
export default function ClassLinksModal({ group, onClose }: Props) {
  const { message } = AntdApp.useApp()
  const [data, setData] = useState<ClassLinks | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  const errorText = (e: any, fallback: string) => e?.response?.data?.message || fallback

  const load = useCallback(async () => {
    if (!group) return
    setLoading(true)
    try {
      setData(await studentAccountApi.classLinks(group.id))
    } catch (e) {
      message.error(errorText(e, 'Не удалось загрузить ссылки класса'))
    } finally {
      setLoading(false)
    }
  }, [group, message])

  useEffect(() => {
    setData(null)
    if (group) load()
  }, [group, load])

  const rows = data?.students ?? []
  const withLink = rows.filter((r) => r.link)
  const missing = rows.length - withLink.length

  const issueAll = async () => {
    if (!group) return
    setBusy(true)
    try {
      const before = withLink.length
      const next = await studentAccountApi.issueClassLinks(group.id)
      setData(next)
      const added = next.students.filter((r) => r.link).length - before
      message.success(added > 0 ? `Выдано ссылок: ${added}` : 'У всех уже есть ссылки')
    } catch (e) {
      message.error(errorText(e, 'Не удалось выдать ссылки'))
    } finally {
      setBusy(false)
    }
  }

  const print = async () => {
    if (!group || withLink.length === 0) return
    setBusy(true)
    try {
      const ok = await printStudentCards(
        group.name,
        withLink.map((r) => ({ name: fullName(r), link: r.link! })),
      )
      if (!ok) message.warning('Браузер не открыл окно печати. Разрешите всплывающие окна для этого сайта.')
    } catch {
      message.error('Не удалось подготовить карточки')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={!!group}
      onCancel={onClose}
      footer={<Button onClick={onClose}>Закрыть</Button>}
      title={group ? `Ссылки класса ${group.name}` : 'Ссылки класса'}
      width={640}
      destroyOnClose
    >
      <Spin spinning={loading}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" loading={busy} disabled={missing === 0} onClick={issueAll}>
            {missing > 0 ? `Выдать всем (${missing})` : 'Выдать всем'}
          </Button>
          <Button icon={<PrinterOutlined />} loading={busy} disabled={withLink.length === 0} onClick={print}>
            Печать карточек
          </Button>
        </Space>
        <Table<ClassLinkRow>
          size="small"
          rowKey="studentId"
          pagination={false}
          dataSource={rows}
          locale={{ emptyText: loading ? ' ' : 'В классе нет учеников' }}
          columns={[
            { title: 'Ученик', key: 'name', render: (_: unknown, r) => fullName(r) },
            {
              title: 'Ссылка',
              key: 'link',
              width: 130,
              render: (_: unknown, r) => (r.link ? <Tag color="green">выдана</Tag> : <Tag>не выдана</Tag>),
            },
            {
              title: 'Заходил',
              key: 'last',
              width: 150,
              render: (_: unknown, r) =>
                r.lastLoginAt ? dayjs(r.lastLoginAt).format('DD.MM.YYYY HH:mm') : <span style={{ color: '#8c8c8c' }}>ещё не заходил</span>,
            },
          ]}
        />
      </Spin>
    </Modal>
  )
}
