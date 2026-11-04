import { useState } from 'react'
import { App as AntdApp, Button, Form, Input, Modal, Popconfirm, Table } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'

import { examTrackApi, type ExamTrack } from '../api/learningApi'
import { useAuthStore } from '../store/authStore'

interface Props {
  tracks: ExamTrack[]
  onChanged: () => void
}

/**
 * Направления подготовки к экзаменам. Название задаёт школа («ЕГЭ»,
 * «Вступительные», «Олимпиады»…) — ничего не зашито в программу.
 */
export default function ExamTracksPanel({ tracks, onChanged }: Props) {
  const { message } = AntdApp.useApp()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'admin' || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'
  const [editing, setEditing] = useState<ExamTrack | null>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<{ name: string; description?: string }>()

  const errorText = (e: any, fallback: string) => e?.response?.data?.message || fallback
  const canManage = (t: ExamTrack) => isAdmin || t.authorId === user?.id

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setOpen(true)
  }

  const openEdit = (t: ExamTrack) => {
    setEditing(t)
    form.setFieldsValue({ name: t.name, description: t.description ?? undefined })
    setOpen(true)
  }

  const save = async () => {
    const v = await form.validateFields()
    setSaving(true)
    try {
      const body = { name: v.name.trim(), description: v.description?.trim() || null }
      if (editing) await examTrackApi.update(editing.id, body)
      else await examTrackApi.create(body)
      message.success(editing ? 'Направление обновлено' : 'Направление создано')
      setOpen(false)
      onChanged()
    } catch (e: any) {
      // название уникально в школе — сервер отвечает 409
      message.error(e?.response?.status === 409 ? 'Направление с таким названием уже есть' : errorText(e, 'Не удалось сохранить'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (t: ExamTrack) => {
    try {
      await examTrackApi.remove(t.id)
      message.success('Направление удалено, квизы остались без направления')
      onChanged()
    } catch (e) {
      message.error(errorText(e, 'Не удалось удалить'))
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--sp-muted)', fontSize: 13 }}>
          Создайте направления с любым названием и привязывайте к ним квизы в редакторе квиза.
        </span>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Новое направление
        </Button>
      </div>

      <Table<ExamTrack>
        rowKey="id"
        size="middle"
        dataSource={tracks}
        pagination={false}
        locale={{ emptyText: 'Направлений пока нет. Например: «ЕГЭ», «Вступительные экзамены»' }}
        columns={[
          { title: 'Название', dataIndex: 'name', render: (n: string, t) => (<><b>{n}</b>{t.description ? <div style={{ fontSize: 12, color: 'var(--sp-muted)' }}>{t.description}</div> : null}</>) },
          { title: 'Квизов', dataIndex: 'quizzesCount', width: 90, align: 'center' },
          { title: 'Автор', key: 'author', width: 180, render: (_, t) => t.author?.fullName ?? '—' },
          {
            title: '',
            key: 'actions',
            width: 100,
            render: (_, t) =>
              canManage(t) ? (
                <>
                  <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEdit(t)} />
                  <Popconfirm
                    title={`Удалить «${t.name}»?`}
                    description="Квизы не удалятся, но потеряют направление."
                    okText="Удалить"
                    cancelText="Отмена"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => remove(t)}
                  >
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </>
              ) : null,
          },
        ]}
      />

      <Modal
        open={open}
        title={editing ? 'Редактировать направление' : 'Новое направление'}
        onCancel={() => setOpen(false)}
        onOk={save}
        okText={editing ? 'Сохранить' : 'Создать'}
        cancelText="Отмена"
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Название" rules={[{ required: true, message: 'Введите название' }]}>
            <Input maxLength={100} placeholder="Например: ЕГЭ" />
          </Form.Item>
          <Form.Item name="description" label="Описание (необязательно)">
            <Input.TextArea rows={3} maxLength={1000} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
