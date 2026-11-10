import { uiText } from '../i18n/uiText'
import { useCallback, useEffect, useState } from 'react'
import { Alert, App as AntdApp, Button, Modal, Popconfirm, Space, Spin, Table, Tag } from 'antd'
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
 * Вход всего класса: кто получил ссылку, у кого есть логин и пароль, кто заходил.
 * «Выдать всем» создаёт недостающие ссылки, «Выдать логины и пароли» — недостающие пароли
 * (система создаёт их сама, виден каждый один раз). «Печать карточек» открывает листок: QR-код
 * и, для только что выданных, логин и пароль на каждого ученика — его режут и раздают.
 */
export default function ClassLinksModal({ group, onClose }: Props) {
  const { message } = AntdApp.useApp()
  const [data, setData] = useState<ClassLinks | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  // Пароли, выданные в этом окне: после закрытия их уже не показать
  const [secrets, setSecrets] = useState<Record<string, { login: string; password: string }>>({})

  const errorText = (e: any, fallback: string) => e?.response?.data?.message || fallback

  const load = useCallback(async () => {
    if (!group) return
    setLoading(true)
    try {
      setData(await studentAccountApi.classLinks(group.id))
    } catch (e) {
      message.error(errorText(e, uiText("Не удалось загрузить ссылки класса")))
    } finally {
      setLoading(false)
    }
  }, [group, message])

  useEffect(() => {
    setData(null)
    setSecrets({})
    if (group) load()
  }, [group, load])

  const rows = data?.students ?? []
  const withLink = rows.filter((r) => r.link)
  const missing = rows.length - withLink.length
  const withoutPassword = rows.filter((r) => !r.passwordIssued).length
  const hasSecrets = Object.keys(secrets).length > 0

  const issueAll = async () => {
    if (!group) return
    setBusy(true)
    try {
      const before = withLink.length
      const next = await studentAccountApi.issueClassLinks(group.id)
      setData(next)
      const added = next.students.filter((r) => r.link).length - before
      message.success(added > 0 ? uiText("Выдано ссылок: {0}", added) : uiText("У всех уже есть ссылки"))
    } catch (e) {
      message.error(errorText(e, uiText("Не удалось выдать ссылки")))
    } finally {
      setBusy(false)
    }
  }

  /** onlyMissing: только тем, у кого пароля нет; иначе заново всем (старые пароли перестают работать). */
  const issuePasswords = async (onlyMissing: boolean) => {
    if (!group) return
    setBusy(true)
    try {
      const res = await studentAccountApi.issueClassPasswords(group.id, onlyMissing)
      const fresh: Record<string, { login: string; password: string }> = onlyMissing ? { ...secrets } : {}
      for (const r of res.students) if (r.password && r.login) fresh[r.studentId] = { login: r.login, password: r.password }
      setSecrets(fresh)
      setData(await studentAccountApi.classLinks(group.id))
      const n = res.students.filter((r) => r.password).length
      message.success(n > 0 ? uiText("Выдано логинов и паролей: {0}", n) : uiText("У всех уже есть пароли"))
    } catch (e) {
      message.error(errorText(e, uiText("Не удалось выдать логины и пароли")))
    } finally {
      setBusy(false)
    }
  }

  const print = async () => {
    if (!group || (withLink.length === 0 && !hasSecrets)) return
    setBusy(true)
    try {
      const ok = await printStudentCards(
        group.name,
        rows
          .filter((r) => r.link || secrets[r.studentId])
          .map((r) => ({
            name: fullName(r),
            link: r.link,
            login: secrets[r.studentId]?.login,
            password: secrets[r.studentId]?.password,
          })),
      )
      if (!ok) message.warning(uiText("Браузер не открыл окно печати. Разрешите всплывающие окна для этого сайта."))
    } catch {
      message.error(uiText("Не удалось подготовить карточки"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={!!group}
      onCancel={onClose}
      footer={<Button onClick={onClose}>{uiText("Закрыть")}</Button>}
      title={group ? uiText("Ссылки класса {0}", group.name) : uiText("Ссылки класса")}
      width={760}
      destroyOnClose
    >
      <Spin spinning={loading}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Button type="primary" loading={busy} disabled={missing === 0} onClick={issueAll}>
            {missing > 0 ? uiText("Выдать всем ({0})", missing) : uiText("Выдать всем")}
          </Button>
          <Button loading={busy} disabled={withoutPassword === 0} onClick={() => issuePasswords(true)}>
            {withoutPassword > 0 ? uiText("Выдать логины и пароли ({0})", withoutPassword) : uiText("Выдать логины и пароли")}
          </Button>
          <Popconfirm
            title={uiText("Выдать пароли заново всем?")}
            description={uiText("Все старые пароли класса перестанут работать, ученики выйдут на всех устройствах.")}
            okText={uiText("Выдать заново")}
            cancelText={uiText("Отмена")}
            onConfirm={() => issuePasswords(false)}
            disabled={rows.length === 0}
          >
            <Button loading={busy} disabled={rows.length === 0}>
              {" " + uiText("Пароли заново всем") + " "}</Button>
          </Popconfirm>
          <Button icon={<PrinterOutlined />} loading={busy} disabled={withLink.length === 0 && !hasSecrets} onClick={print}>
            {" " + uiText("Печать карточек") + " "}</Button>
        </Space>

        {hasSecrets && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            message={uiText("Пароли видны только сейчас")}
            description={uiText("Напечатайте карточки до закрытия окна. Потом пароль не показать, можно только выдать новый.")}
          />
        )}

        <Table<ClassLinkRow>
          size="small"
          rowKey="studentId"
          pagination={false}
          dataSource={rows}
          locale={{ emptyText: loading ? ' ' : uiText("В классе нет учеников") }}
          columns={[
            { title: uiText("Ученик"), key: 'name', render: (_: unknown, r) => fullName(r) },
            {
              title: uiText("Ссылка"),
              key: 'link',
              width: 110,
              render: (_: unknown, r) => (r.link ? <Tag color="green">{uiText("выдана")}</Tag> : <Tag>{uiText("не выдана")}</Tag>),
            },
            {
              title: uiText("Логин и пароль"),
              key: 'password',
              width: 190,
              render: (_: unknown, r) =>
                secrets[r.studentId] ? (
                  <span>
                    <code>{secrets[r.studentId].login}</code> · <code>{secrets[r.studentId].password}</code>
                  </span>
                ) : r.passwordIssued ? (
                  <Tag color="green">{uiText("пароль выдан")}</Tag>
                ) : (
                  <Tag>{uiText("нет пароля")}</Tag>
                ),
            },
            {
              title: uiText("Заходил"),
              key: 'last',
              width: 150,
              render: (_: unknown, r) =>
                r.lastLoginAt ? dayjs(r.lastLoginAt).format('DD.MM.YYYY HH:mm') : <span style={{ color: '#8c8c8c' }}>{uiText("ещё не заходил")}</span>,
            },
          ]}
        />
      </Spin>
    </Modal>
  )
}
