import { useCallback, useEffect, useState } from 'react'
import { Alert, App as AntdApp, Button, Form, Input, Modal, Popconfirm, Progress, Select, Table, Tag } from 'antd'
import { DeleteOutlined, FileOutlined, LinkOutlined, PlusOutlined } from '@ant-design/icons'
import { FileText } from 'lucide-react'

import { SP, SproutCard, SproutPageHeader } from '../components/sprout'
import FileUploadField from '../components/FileUploadField'
import { useAuthStore } from '../store/authStore'
import { useDataStore } from '../store/dataStore'
import { http } from '../api'
import { filesApi, formatSize, openFileLink, type StorageUsage } from '../api/filesApi'
import {
  LESSON_MATERIAL_TTL_DAYS,
  buildMaterialInput,
  expiryText,
  lessonMaterialApi,
  type LessonMaterial,
  type MaterialFormValues,
} from '../api/lessonMaterialApi'

interface SubjectDto {
  id: string
  name: string
  color: string
}

/**
 * Материалы к уроку для учителя и админа: выложить классу файл, ссылку или
 * текст. Материал живёт 30 дней и удаляется сам вместе с файлом.
 */
export default function LessonMaterialsPage() {
  const { message } = AntdApp.useApp()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'admin' || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'
  const groups = useDataStore((s) => s.groups)

  const [items, setItems] = useState<LessonMaterial[]>([])
  const [subjects, setSubjects] = useState<SubjectDto[]>([])
  const [usage, setUsage] = useState<StorageUsage | null>(null)
  const [loading, setLoading] = useState(true)
  const [groupId, setGroupId] = useState<string | undefined>()

  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<MaterialFormValues>()

  const errorText = (e: any, fallback: string) => {
    const m = e?.response?.data?.message
    return Array.isArray(m) ? m.join(', ') : m || fallback
  }

  const loadUsage = useCallback(() => {
    if (!isAdmin) return
    filesApi.usage().then(setUsage).catch(() => setUsage(null))
  }, [isAdmin])

  const load = useCallback(() => {
    setLoading(true)
    lessonMaterialApi
      .list({ groupId })
      .then(setItems)
      .catch((e) => message.error(errorText(e, 'Не удалось загрузить материалы')))
      .finally(() => setLoading(false))
  }, [groupId, message])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    loadUsage()
  }, [loadUsage])

  useEffect(() => {
    http
      .get<SubjectDto[]>('/v1/subjects')
      .then((r) => setSubjects(r.data))
      .catch(() => setSubjects([]))
  }, [])

  const canManage = (m: LessonMaterial) => isAdmin || m.author?.id === user?.id

  const openCreate = () => {
    form.resetFields()
    // единственный класс выбираем сразу, иначе — тот, что открыт в фильтре
    const first = groupId ?? (groups.length === 1 ? groups[0].id : undefined)
    if (first) form.setFieldsValue({ groupId: first })
    setOpen(true)
  }

  const save = async () => {
    // неверная форма: antd уже подсветил поля, дальше не идём (и не оставляем необработанный reject)
    const v = await form.validateFields().catch(() => null)
    if (!v) return
    const built = buildMaterialInput(v)
    if ('error' in built) {
      message.warning(built.error)
      return
    }
    setSaving(true)
    try {
      await lessonMaterialApi.create(built.body)
      message.success(`Материал выложен. Он сам удалится через ${LESSON_MATERIAL_TTL_DAYS} дней`)
      setOpen(false)
      load()
      loadUsage()
    } catch (e) {
      message.error(errorText(e, 'Не удалось сохранить'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (m: LessonMaterial) => {
    try {
      await lessonMaterialApi.remove(m.id)
      message.success('Материал удалён')
      load()
      loadUsage()
    } catch (e) {
      message.error(errorText(e, 'Не удалось удалить'))
    }
  }

  const openFile = (m: LessonMaterial) =>
    openFileLink(() => lessonMaterialApi.fileLink(m.id)).catch((e) =>
      message.error(errorText(e, 'Не удалось открыть файл')),
    )

  const usedPercent = usage ? Math.min(100, Math.round((usage.usedBytes / usage.quotaBytes) * 100)) : 0

  return (
    <div>
      <SproutPageHeader
        title="Материалы к уроку"
        icon={<FileText size={22} strokeWidth={2} />}
        iconAccent="yellow"
        description={`Файл, ссылка или текст для вашего класса. Хранится ${LESSON_MATERIAL_TTL_DAYS} дней и удаляется сам`}
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Новый материал
          </Button>
        }
      />

      <SproutCard>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          <Select
            allowClear
            placeholder="Все классы"
            style={{ minWidth: 180 }}
            value={groupId}
            onChange={(v) => setGroupId(v)}
            options={groups.map((g) => ({ value: g.id, label: g.name }))}
          />
          {isAdmin && usage && (
            <div style={{ marginLeft: 'auto', minWidth: 240 }} data-testid="storage-usage">
              <div style={{ fontSize: 12, color: SP.muted }}>
                Занято {formatSize(usage.usedBytes)} из {formatSize(usage.quotaBytes)}
              </div>
              <Progress percent={usedPercent} size="small" showInfo={false} status={usedPercent >= 90 ? 'exception' : 'normal'} />
            </div>
          )}
        </div>

        <Table<LessonMaterial>
          rowKey="id"
          size="middle"
          loading={loading}
          dataSource={items}
          pagination={{ pageSize: 15, hideOnSinglePage: true }}
          scroll={{ x: 820 }}
          locale={{ emptyText: 'Материалов пока нет. Нажмите «Новый материал»' }}
          columns={[
            {
              title: 'Материал',
              key: 'title',
              render: (_, m) => (
                <div>
                  <b>{m.title}</b>
                  {m.description && (
                    <div style={{ fontSize: 12, color: SP.textMid, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.description}
                    </div>
                  )}
                  <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {m.file && (
                      <Button size="small" icon={<FileOutlined />} onClick={() => openFile(m)}>
                        {m.file.name} · {formatSize(m.file.size)}
                      </Button>
                    )}
                    {m.url && (
                      <Button size="small" icon={<LinkOutlined />} href={m.url} target="_blank" rel="noopener noreferrer">
                        Ссылка
                      </Button>
                    )}
                  </div>
                </div>
              ),
            },
            { title: 'Класс', key: 'group', width: 90, render: (_, m) => m.group.name },
            {
              title: 'Предмет',
              key: 'subject',
              width: 130,
              render: (_, m) =>
                m.subject ? <Tag style={{ background: m.subject.color, color: '#fff', border: 'none' }}>{m.subject.name}</Tag> : '—',
            },
            { title: 'Автор', key: 'author', width: 150, render: (_, m) => m.author?.fullName ?? '—' },
            {
              title: 'Срок',
              key: 'expires',
              width: 170,
              render: (_, m) => <Tag color={m.daysLeft <= 3 ? 'orange' : 'default'}>{expiryText(m.daysLeft)}</Tag>,
            },
            {
              title: '',
              key: 'actions',
              width: 60,
              render: (_, m) =>
                canManage(m) ? (
                  <Popconfirm
                    title={`Удалить «${m.title}»?`}
                    description={m.file ? 'Файл тоже удалится.' : undefined}
                    okText="Удалить"
                    cancelText="Отмена"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => remove(m)}
                  >
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label="Удалить материал" />
                  </Popconfirm>
                ) : null,
            },
          ]}
        />
      </SproutCard>

      <Modal
        open={open}
        title="Новый материал к уроку"
        onCancel={() => setOpen(false)}
        onOk={save}
        okText="Выложить"
        cancelText="Отмена"
        confirmLoading={saving}
        destroyOnClose
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 14 }}
          message={`Материал увидят ученики и родители класса. Через ${LESSON_MATERIAL_TTL_DAYS} дней он удалится сам вместе с файлом.`}
        />
        <Form form={form} layout="vertical">
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="groupId" label="Класс" rules={[{ required: true, message: 'Выберите класс' }]} style={{ flex: 1 }}>
              <Select placeholder="Класс" options={groups.map((g) => ({ value: g.id, label: g.name }))} />
            </Form.Item>
            <Form.Item name="subjectId" label="Предмет" style={{ flex: 1 }}>
              <Select allowClear placeholder="Любой" options={subjects.map((s) => ({ value: s.id, label: s.name }))} />
            </Form.Item>
          </div>
          <Form.Item name="title" label="Название" rules={[{ required: true, message: 'Введите название' }]}>
            <Input maxLength={200} placeholder="Например: Тема 5 — дроби" />
          </Form.Item>
          <Form.Item name="description" label="Текст (необязательно)">
            <Input.TextArea rows={3} maxLength={5000} showCount placeholder="Что прочитать, что повторить к уроку" />
          </Form.Item>
          <Form.Item
            name="url"
            label="Ссылка (необязательно)"
            rules={[{ pattern: /^https?:\/\/\S+$/i, message: 'Ссылка должна начинаться с http:// или https://' }]}
          >
            <Input placeholder="https://…" />
          </Form.Item>
          <Form.Item name="file" label="Файл (необязательно)">
            <FileUploadField upload={lessonMaterialApi.upload} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
