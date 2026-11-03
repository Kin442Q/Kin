import { useCallback, useEffect, useState } from 'react'
import { Alert, App as AntdApp, Button, Form, Input, Modal, Popconfirm, Space, Spin, Tag, Typography } from 'antd'
import { CopyOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

import {
  studentAccountApi,
  type IssuedAccount,
  type StudentAccount,
} from '../api/schoolApi'

const { Text } = Typography

interface Props {
  student: { id: string; firstName: string; lastName: string } | null
  onClose: () => void
}

/**
 * Вход ученика в свой кабинет. Админ или классный руководитель создаёт
 * аккаунт и передаёт ученику логин и пароль. Пароль показывается один
 * раз — на сервере хранится только хеш.
 */
export default function StudentAccountModal({ student, onClose }: Props) {
  const { message } = AntdApp.useApp()
  const [account, setAccount] = useState<StudentAccount | null>(null)
  const [issued, setIssued] = useState<IssuedAccount | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form] = Form.useForm()

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
    setIssued(null)
    setAccount(null)
    form.resetFields()
    if (student) load()
  }, [student, load, form])

  const run = async (fn: () => Promise<IssuedAccount | void>, okText: string) => {
    setBusy(true)
    try {
      const r = await fn()
      if (r) {
        setIssued(r)
        setAccount(r.account)
      } else {
        setAccount(null)
        setIssued(null)
      }
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

  const create = async () => {
    if (!student) return
    const v = await form.validateFields()
    await run(
      () =>
        studentAccountApi.create(student.id, {
          login: v.login?.trim() || undefined,
          password: v.password || undefined,
        }),
      'Доступ создан',
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
        {issued && (
          <Alert
            type="success"
            showIcon
            style={{ marginBottom: 16 }}
            message="Передайте ученику эти данные — пароль больше не будет показан"
            description={
              <div style={{ marginTop: 6 }}>
                <div>
                  Логин: <Text strong code>{issued.account.login}</Text>{' '}
                  <Button size="small" type="text" icon={<CopyOutlined />} onClick={() => copy(issued.account.login)} />
                </div>
                <div>
                  Пароль: <Text strong code>{issued.password}</Text>{' '}
                  <Button size="small" type="text" icon={<CopyOutlined />} onClick={() => copy(issued.password)} />
                </div>
              </div>
            }
          />
        )}

        {account ? (
          <div>
            <p style={{ marginTop: 0 }}>
              Логин: <Text strong code>{account.login}</Text>{' '}
              <Tag color={account.isActive ? 'green' : 'red'}>{account.isActive ? 'активен' : 'отключён'}</Tag>
            </p>
            <p style={{ color: '#8c8c8c' }}>
              {account.lastLoginAt
                ? `Последний вход: ${dayjs(account.lastLoginAt).format('DD.MM.YYYY HH:mm')}`
                : 'Ещё ни разу не входил'}
            </p>
            <Space wrap>
              <Popconfirm
                title="Сбросить пароль?"
                description="Старый пароль перестанет работать, ученика выкинет из всех сессий."
                okText="Сбросить"
                cancelText="Отмена"
                onConfirm={() => run(() => studentAccountApi.resetPassword(student!.id), 'Пароль сброшен')}
              >
                <Button loading={busy}>Сбросить пароль</Button>
              </Popconfirm>
              <Popconfirm
                title="Отобрать доступ?"
                description="Аккаунт удалится, ученик и его оценки останутся."
                okText="Отобрать"
                okButtonProps={{ danger: true }}
                cancelText="Отмена"
                onConfirm={() =>
                  run(async () => {
                    await studentAccountApi.remove(student!.id)
                  }, 'Доступ отобран')
                }
              >
                <Button danger loading={busy}>
                  Отобрать доступ
                </Button>
              </Popconfirm>
            </Space>
          </div>
        ) : (
          !loading && (
            <Form form={form} layout="vertical">
              <p style={{ marginTop: 0 }}>
                У ученика пока нет входа. Логин и пароль можно не заполнять — они придумаются сами.
              </p>
              <Form.Item
                name="login"
                label="Логин (необязательно)"
                tooltip="Латиница, цифры, точка, дефис. Например: ali.karimov"
              >
                <Input placeholder="придумается автоматически" />
              </Form.Item>
              <Form.Item
                name="password"
                label="Пароль (необязательно)"
                rules={[{ min: 6, message: 'Минимум 6 символов' }]}
              >
                <Input.Password placeholder="сгенерируется автоматически" />
              </Form.Item>
              <Button type="primary" loading={busy} onClick={create}>
                Создать доступ
              </Button>
            </Form>
          )
        )}
      </Spin>
    </Modal>
  )
}
