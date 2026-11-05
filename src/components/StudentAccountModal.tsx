import { useCallback, useEffect, useState } from 'react'
import { Alert, App as AntdApp, Button, Input, Modal, Popconfirm, Space, Spin, Tag, Typography } from 'antd'
import { CopyOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

import { studentAccountApi, type StudentAccount } from '../api/schoolApi'
import { qrDataUrl } from '../lib/studentCards'

const { Text } = Typography

interface Props {
  student: { id: string; firstName: string; lastName: string } | null
  onClose: () => void
}

/**
 * Вход ученика в свой кабинет. Логина и пароля у ученика нет: админ или классный
 * руководитель выдаёт личную ссылку (её можно скопировать или показать QR-кодом).
 * Перевыпуск убивает старую ссылку сразу, «Отключить доступ» удаляет аккаунт.
 */
export default function StudentAccountModal({ student, onClose }: Props) {
  const { message } = AntdApp.useApp()
  const [account, setAccount] = useState<StudentAccount | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  const errorText = (e: any, fallback: string) => e?.response?.data?.message || fallback

  const load = useCallback(async () => {
    if (!student) return
    setLoading(true)
    try {
      setAccount(await studentAccountApi.get(student.id))
    } catch (e) {
      message.error(errorText(e, 'Не удалось загрузить доступ'))
    } finally {
      setLoading(false)
    }
  }, [student, message])

  useEffect(() => {
    setAccount(null)
    if (student) load()
  }, [student, load])

  // QR рисуется в браузере из самой ссылки
  const link = account?.link ?? null
  useEffect(() => {
    let cancelled = false
    setQr(null)
    if (link) {
      qrDataUrl(link).then(
        (url) => {
          if (!cancelled) setQr(url)
        },
        () => {
          /* QR не обязателен: ссылка остаётся доступной текстом */
        },
      )
    }
    return () => {
      cancelled = true
    }
  }, [link])

  const run = async (fn: () => Promise<StudentAccount | void>, okText: string) => {
    setBusy(true)
    try {
      const r = await fn()
      setAccount(r ?? null)
      message.success(okText)
    } catch (e) {
      message.error(errorText(e, 'Не удалось выполнить'))
    } finally {
      setBusy(false)
    }
  }

  const copy = (value: string) => {
    navigator.clipboard?.writeText(value).then(
      () => message.success('Скопировано'),
      () => message.error('Не удалось скопировать'),
    )
  }

  return (
    <Modal
      open={!!student}
      onCancel={onClose}
      footer={<Button onClick={onClose}>Закрыть</Button>}
      title={student ? `Доступ в кабинет: ${student.lastName} ${student.firstName}` : 'Доступ'}
      destroyOnClose
    >
      <Spin spinning={loading}>
        {account?.link ? (
          <div>
            <p style={{ marginTop: 0 }}>
              Личная ссылка ученика{' '}
              <Tag color={account.isActive ? 'green' : 'red'}>{account.isActive ? 'работает' : 'отключена'}</Tag>
            </p>
            <Space.Compact style={{ width: '100%' }}>
              <Input readOnly value={account.link} aria-label="Личная ссылка ученика" onFocus={(e) => e.target.select()} />
              <Button icon={<CopyOutlined />} onClick={() => copy(account.link!)}>
                Скопировать
              </Button>
            </Space.Compact>

            {qr && (
              <div style={{ textAlign: 'center', margin: '16px 0 4px' }}>
                <img src={qr} alt="QR-код ссылки" width={168} height={168} />
                <div style={{ color: '#8c8c8c', fontSize: 13 }}>Наведите камеру телефона на код</div>
              </div>
            )}

            <Alert
              type="info"
              showIcon
              style={{ margin: '12px 0' }}
              message="Ссылка личная: кто её откроет, тот попадёт в кабинет ученика. Передайте её только ему."
            />
            <p style={{ color: '#8c8c8c' }}>
              {account.lastLoginAt
                ? `Заходил: ${dayjs(account.lastLoginAt).format('DD.MM.YYYY HH:mm')}`
                : 'Ещё не заходил'}
            </p>
            <Space wrap>
              <Popconfirm
                title="Перевыпустить ссылку?"
                description="Старая ссылка сразу перестанет работать, ученик выйдет на всех устройствах."
                okText="Перевыпустить"
                cancelText="Отмена"
                onConfirm={() => run(() => studentAccountApi.regenerate(student!.id), 'Новая ссылка готова')}
              >
                <Button loading={busy}>Перевыпустить</Button>
              </Popconfirm>
              <Popconfirm
                title="Отключить доступ?"
                description="Ссылка перестанет работать. Ученик и его оценки останутся."
                okText="Отключить"
                okButtonProps={{ danger: true }}
                cancelText="Отмена"
                onConfirm={() =>
                  run(async () => {
                    await studentAccountApi.remove(student!.id)
                  }, 'Доступ отключён')
                }
              >
                <Button danger loading={busy}>
                  Отключить доступ
                </Button>
              </Popconfirm>
            </Space>
          </div>
        ) : (
          !loading && (
            <div>
              <p style={{ marginTop: 0 }}>
                У ученика пока нет доступа в кабинет. Выдайте <Text strong>личную ссылку</Text> — по ней он войдёт
                сам, логин и пароль не нужны.
              </p>
              <Button type="primary" loading={busy} onClick={() => run(() => studentAccountApi.issue(student!.id), 'Ссылка выдана')}>
                Выдать ссылку
              </Button>
            </div>
          )
        )}
      </Spin>
    </Modal>
  )
}
