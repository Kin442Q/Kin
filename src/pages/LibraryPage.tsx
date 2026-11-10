import { uiText } from '../i18n/uiText'
import { useCallback, useEffect, useState } from 'react'
import {
  App as AntdApp,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Spin,
} from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { Library } from 'lucide-react'

import { SproutCard, SproutEmpty, SproutPageHeader } from '../components/sprout'
import LibraryCard from '../components/LibraryCard'
import { useAuthStore } from '../store/authStore'
import { http } from '../api'
import {
  LIBRARY_TYPES,
  libraryApi,
  type LibraryInput,
  type LibraryItem,
  type LibraryType,
} from '../api/learningApi'

interface SubjectDto {
  id: string
  name: string
  color: string
}

/** Библиотека школы для учителей и админа: добавлять и править материалы (ссылки). */
export default function LibraryPage() {
  const { message } = AntdApp.useApp()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'admin' || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'

  const [items, setItems] = useState<LibraryItem[]>([])
  const [subjects, setSubjects] = useState<SubjectDto[]>([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState<LibraryType | 'ALL'>('ALL')
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')

  const [editing, setEditing] = useState<LibraryItem | null>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<LibraryInput>()

  const errorText = (e: any, fallback: string) => {
    const m = e?.response?.data?.message
    return Array.isArray(m) ? m.join(', ') : m || fallback
  }

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  const load = useCallback(() => {
    setLoading(true)
    libraryApi
      .list({ type: type === 'ALL' ? undefined : type, q: query || undefined })
      .then(setItems)
      .catch((e) => message.error(errorText(e, uiText("Не удалось загрузить библиотеку"))))
      .finally(() => setLoading(false))
  }, [type, query, message])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    http
      .get<SubjectDto[]>('/v1/subjects')
      .then((r) => setSubjects(r.data))
      .catch(() => setSubjects([]))
  }, [])

  const canManage = (i: LibraryItem) => isAdmin || i.authorId === user?.id

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ type: 'LINK' })
    setOpen(true)
  }

  const openEdit = (i: LibraryItem) => {
    setEditing(i)
    form.setFieldsValue({
      title: i.title,
      description: i.description ?? undefined,
      type: i.type,
      url: i.url,
      subjectId: i.subjectId ?? undefined,
      gradeNumber: i.gradeNumber ?? undefined,
    })
    setOpen(true)
  }

  const save = async () => {
    const v = await form.validateFields()
    setSaving(true)
    try {
      const body: LibraryInput = {
        title: v.title.trim(),
        description: v.description?.trim() || null,
        type: v.type,
        url: v.url.trim(),
        subjectId: v.subjectId || null,
        gradeNumber: v.gradeNumber ?? null,
      }
      if (editing) await libraryApi.update(editing.id, body)
      else await libraryApi.create(body)
      message.success(editing ? uiText("Материал обновлён") : uiText("Материал добавлен"))
      setOpen(false)
      load()
    } catch (e) {
      message.error(errorText(e, uiText("Не удалось сохранить")))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (i: LibraryItem) => {
    try {
      await libraryApi.remove(i.id)
      message.success(uiText("Материал удалён"))
      load()
    } catch (e) {
      message.error(errorText(e, uiText("Не удалось удалить")))
    }
  }

  return (
    <div>
      <SproutPageHeader
        title={uiText("Библиотека")}
        icon={<Library size={22} strokeWidth={2} />}
        iconAccent="blue"
        description={uiText("Материалы для учеников: книги, статьи, видео и ссылки")}
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            {" " + uiText("Добавить материал") + " "}</Button>
        }
      />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <Input.Search
          allowClear
          placeholder={uiText("Поиск по названию и описанию")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ maxWidth: 340 }}
        />
        <Segmented
          value={type}
          onChange={(v) => setType(v as LibraryType | 'ALL')}
          options={[{ value: 'ALL', label: uiText("Все") }, ...LIBRARY_TYPES.map((t) => ({ value: t.value, label: `${t.emoji} ${t.label}` }))]}
        />
      </div>

      <Spin spinning={loading}>
        {items.length === 0 ? (
          <SproutCard>
            <SproutEmpty
              icon={<Library size={32} strokeWidth={1.8} />}
              title={uiText("Материалов нет")}
              description={uiText("Нажмите «Добавить материал» и вставьте ссылку на книгу, статью или видео")}
              minHeight={200}
            />
          </SproutCard>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {items.map((i) => (
              <LibraryCard
                key={i.id}
                item={i}
                actions={
                  canManage(i) ? (
                    <>
                      <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEdit(i)} />
                      <Popconfirm
                        title={uiText("Удалить материал?")}
                        okText={uiText("Удалить")}
                        cancelText={uiText("Отмена")}
                        okButtonProps={{ danger: true }}
                        onConfirm={() => remove(i)}
                      >
                        <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </>
                  ) : undefined
                }
              />
            ))}
          </div>
        )}
      </Spin>

      <Modal
        open={open}
        title={editing ? uiText("Редактировать материал") : uiText("Новый материал")}
        onCancel={() => setOpen(false)}
        onOk={save}
        okText={editing ? uiText("Сохранить") : uiText("Добавить")}
        cancelText={uiText("Отмена")}
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label={uiText("Название")} rules={[{ required: true, message: uiText("Введите название") }]}>
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item
            name="url"
            label={uiText("Ссылка на материал")}
            rules={[
              { required: true, message: uiText("Вставьте ссылку") },
              { pattern: /^https?:\/\/\S+$/i, message: uiText("Ссылка должна начинаться с http:// или https://") },
            ]}
            extra={uiText("Файлы не загружаются — укажите ссылку (Google Drive, YouTube, сайт школы…)")}
          >
            <Input placeholder="https://…" />
          </Form.Item>
          <Form.Item name="type" label={uiText("Тип")} rules={[{ required: true }]}>
            <Select options={LIBRARY_TYPES.map((t) => ({ value: t.value, label: `${t.emoji} ${t.label}` }))} />
          </Form.Item>
          <Form.Item name="description" label={uiText("Описание (необязательно)")}>
            <Input.TextArea rows={3} maxLength={2000} showCount />
          </Form.Item>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="subjectId" label={uiText("Предмет")} style={{ flex: 1 }}>
              <Select
                allowClear
                placeholder={uiText("Любой")}
                options={subjects.map((s) => ({ value: s.id, label: s.name }))}
              />
            </Form.Item>
            <Form.Item name="gradeNumber" label={uiText("Класс (параллель)")} style={{ width: 160 }}>
              <InputNumber min={1} max={12} placeholder={uiText("Для всех")} style={{ width: '100%' }} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
