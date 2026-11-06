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
 * Вход ученика в свой кабинет. Админ или классный руководитель выбирает способ:
 *  - личная ссылка (её можно скопировать или показать QR-кодом);
 *  - логин и пароль: пароль создаёт система, он виден один раз, ученик вводит его на сайте или в приложении.
 * Перевыпуск ссылки и новый пароль закрывают старые входы сразу, «Отключить доступ» удаляет аккаунт.
 */
export default function StudentAccountModal({ student, onClose }: Props) {
  const { message } = AntdApp.useApp()
  const [account, setAccount] = useState<StudentAccount | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  // Только что выданные логин и пароль: пароль виден лишь здесь и пока открыто окно
  const [issued, setIssued] = useState<{ login: string; password: string } | null>(null)

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
    setIssued(null)
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
      if (!r) setIssued(null)
      message.success(okText)
    } catch (e) {
      message.error(errorText(e, 'Не удалось выполнить'))
    } finally {
      setBusy(false)
    }
  }

  /** Выдать (или выдать заново) логин и пароль и показать их один раз. */
  const issuePassword = async (okText: string) => {
    if (!student) return
    setBusy(true)
    try {
      const r = await studentAccountApi.issuePassword(student.id)
      const { password, ...acc } = r
      setAccount(acc)
      setIssued({ login: acc.login ?? '', password })
      message.success(okText)
    } catch (e) {
      message.error(errorText(e, 'Не удалось выдать логин и пароль'))
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
            {account.link ? (
              <>
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
              </>
            ) : (
              <p style={{ color: '#8c8c8c' }}>Ссылки нет. Её можно выдать кнопкой «Перевыпустить».</p>
            )}

            <div style={{ margin: '4px 0 12px' }}>
              <p style={{ marginBottom: 6 }}>
                <Text strong>Логин и пароль</Text>{' '}
                {account.passwordIssued ? <Tag color="green">выданы</Tag> : <Tag>не выданы</Tag>}
              </p>

              {issued && (
                <Alert
                  type="success"
                  showIcon
                  style={{ marginBottom: 10 }}
                  message="Логин и пароль выданы"
                  description={
                    <div>
                      <div style={{ fontSize: 16, lineHeight: 1.9 }}>
                        Логин: <Text code>{issued.login}</Text>
                        <br />
                        Пароль: <Text code>{issued.password}</Text>
                      </div>
                      <Button
                        size="small"
                        icon={<CopyOutlined />}
                        style={{ margin: '6px 0' }}
                        onClick={() => copy(`Логин: ${issued.login}\nПароль: ${issued.password}`)}
                      >
                        Скопировать логин и пароль
                      </Button>
                      <div style={{ color: '#8c8c8c' }}>
                        Пароль виден только сейчас. Запишите его или скопируйте: потом его не показать, можно только выдать новый.
                      </div>
                    </div>
                  }
                />
              )}

              {!issued && account.passwordIssued && (
                <p style={{ color: '#8c8c8c', margin: '0 0 8px' }}>
                  Логин: <Text code>{account.login}</Text>. Пароль выдан, посмотреть его нельзя — только выдать новый.
                </p>
              )}

              <Space wrap>
                {account.passwordIssued ? (
                  <>
                    <Popconfirm
                      title="Выдать новый пароль?"
                      description="Старый пароль перестанет работать, ученик выйдет на всех устройствах."
                      okText="Выдать новый"
                      cancelText="Отмена"
                      onConfirm={() => issuePassword('Новый пароль выдан')}
                    >
                      <Button loading={busy}>Новый пароль</Button>
                    </Popconfirm>
                    <Popconfirm
                      title="Забрать пароль?"
                      description="Ученик будет входить только по личной ссылке."
                      okText="Забрать"
                      cancelText="Отмена"
                      onConfirm={() =>
                        run(async () => {
                          const r = await studentAccountApi.revokePassword(student!.id)
                          setIssued(null)
                          return r
                        }, 'Пароль забран')
                      }
                    >
                      <Button loading={busy}>Забрать пароль</Button>
                    </Popconfirm>
                  </>
                ) : (
                  <Button type="primary" loading={busy} onClick={() => issuePassword('Логин и пароль выданы')}>
                    Выдать логин и пароль
                  </Button>
                )}
              </Space>
            </div>

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
                description="Ссылка и пароль перестанут работать. Ученик и его оценки останутся."
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
              <p style={{ marginTop: 0 }}>У ученика пока нет доступа в кабинет. Выберите, как он будет входить:</p>
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <div>
                  <Button type="primary" loading={busy} onClick={() => run(() => studentAccountApi.issue(student!.id), 'Ссылка выдана')}>
                    Выдать ссылку
                  </Button>
                  <div style={{ color: '#8c8c8c', marginTop: 4 }}>Личная ссылка и QR-код: ученик входит одним касанием.</div>
                </div>
                <div>
                  <Button loading={busy} onClick={() => issuePassword('Логин и пароль выданы')}>
                    Выдать логин и пароль
                  </Button>
                  <div style={{ color: '#8c8c8c', marginTop: 4 }}>
                    Система создаст логин и короткий пароль: ученик вводит их на сайте или в приложении.
                  </div>
                </div>
              </Space>
            </div>
          )
        )}
      </Spin>
    </Modal>
  )
}
