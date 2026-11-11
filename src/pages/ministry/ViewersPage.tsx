import { useMemo, useState } from 'react'
import { Alert, App as AntdApp, Button, Card, Cascader, Form, Input, Modal, Popconfirm, Skeleton, Space, Switch, Table, Tag } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Landmark, Mail, Pencil, Plus, Power } from 'lucide-react'
import type { ColumnsType } from 'antd/es/table'

import { uiText } from '../../i18n/uiText'
import { useLangStore } from '../../i18n'
import { SproutPageHeader } from '../../components/sprout'
import AccessResultModal from '../../components/AccessResultModal'
import { geoName, regionsApi } from '../../api/regionsApi'
import { ministryApi, type Viewer } from '../../api/ministryApi'
import type { AccessGrant } from '../../api/accessApi'

interface FormValues {
  fullName: string
  email: string
  organization: string
  allSchools: boolean
  /** Пути каскада: [область] — вся область, [область, район] — один район. */
  area?: string[][]
}

/** Охват наблюдателя в виде пути каскада: целые области и отдельные районы. */
export function scopeToPaths(v: Pick<Viewer, 'regions' | 'districts'>): string[][] {
  return [...v.regions.map((r) => [r.id]), ...v.districts.map((d) => [d.regionId, d.id])]
}

/** Пути каскада обратно в списки областей и районов для сервера. */
export function pathsToScope(paths: string[][] | undefined): { regionIds: string[]; districtIds: string[] } {
  const list = paths ?? []
  return {
    regionIds: list.filter((p) => p.length === 1).map((p) => p[0]),
    districtIds: list.filter((p) => p.length >= 2).map((p) => p[1]),
  }
}

/**
 * Министерство и районные отделы образования: учётные записи наблюдателей. Только владелец платформы.
 * Пароль никто не задаёт: человеку уходит письмо со ссылкой, по которой он придумывает его сам.
 */
export default function ViewersPage() {
  const { message } = AntdApp.useApp()
  const lang = useLangStore((s) => s.lang)
  const queryClient = useQueryClient()
  const [form] = Form.useForm<FormValues>()
  const [editing, setEditing] = useState<Viewer | 'new' | null>(null)
  const [grant, setGrant] = useState<{ grant: AccessGrant; viewerId: string } | null>(null)

  const viewers = useQuery({ queryKey: ['ministry', 'viewers'], queryFn: ministryApi.viewers })
  const regions = useQuery({ queryKey: ['regions'], queryFn: regionsApi.tree, staleTime: Infinity })
  const allSchools = Form.useWatch('allSchools', form)

  const options = useMemo(
    () =>
      (regions.data ?? []).map((r) => ({
        value: r.id,
        label: geoName(r, lang),
        children: r.districts.map((d) => ({ value: d.id, label: geoName(d, lang) })),
      })),
    [regions.data, lang],
  )

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['ministry', 'viewers'] })
  const fail = (e: any) => message.error(e?.response?.data?.message || uiText('Не удалось сохранить. Попробуйте ещё раз.'))

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const scope = values.allSchools ? { regionIds: [], districtIds: [] } : pathsToScope(values.area)
      if (editing === 'new') {
        return ministryApi.createViewer({
          fullName: values.fullName,
          email: values.email,
          organization: values.organization,
          allSchools: values.allSchools,
          ...scope,
        })
      }
      await ministryApi.updateViewer((editing as Viewer).id, {
        fullName: values.fullName,
        organization: values.organization,
        allSchools: values.allSchools,
        ...scope,
      })
      return null
    },
    onSuccess: (created) => {
      setEditing(null)
      refresh()
      if (created) setGrant({ grant: created.invite, viewerId: created.viewer.id })
      else message.success(uiText('Изменения сохранены'))
    },
    onError: fail,
  })

  const toggle = useMutation({
    mutationFn: (v: Viewer) => ministryApi.updateViewer(v.id, { isActive: !v.isActive }),
    onSuccess: refresh,
    onError: fail,
  })

  const openForm = (v: Viewer | 'new') => {
    setEditing(v)
    form.resetFields()
    if (v === 'new') form.setFieldsValue({ allSchools: false, area: [] })
    else form.setFieldsValue({ fullName: v.fullName, email: v.email, organization: v.organization ?? '', allSchools: v.allSchools, area: scopeToPaths(v) })
  }

  const columns: ColumnsType<Viewer> = [
    {
      title: uiText('Кто'),
      key: 'who',
      render: (_, v) => (
        <div>
          <strong>{v.fullName}</strong>
          <div style={{ fontSize: 12, color: 'var(--sp-muted)' }}>{v.email}</div>
        </div>
      ),
    },
    { title: uiText('Организация'), dataIndex: 'organization', render: (v: string | null) => v ?? '—' },
    {
      title: uiText('Что видит'),
      key: 'scope',
      render: (_, v) =>
        v.allSchools ? (
          <Tag color="blue">{uiText('Все школы страны')}</Tag>
        ) : (
          <Space size={[4, 4]} wrap>
            {v.regions.map((r) => (
              <Tag key={r.id} color="cyan">{geoName(r, lang)}</Tag>
            ))}
            {v.districts.map((d) => (
              <Tag key={d.id}>{geoName(d, lang)}</Tag>
            ))}
          </Space>
        ),
    },
    {
      title: uiText('Статус'),
      key: 'status',
      render: (_, v) =>
        !v.isActive ? <Tag color="red">{uiText('Отключён')}</Tag> : v.lastLoginAt ? <Tag color="green">{uiText('Входил')}</Tag> : <Tag color="gold">{uiText('Ждёт, пока задаст пароль')}</Tag>,
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, v) => (
        <Space>
          <Button size="small" icon={<Pencil size={14} />} onClick={() => openForm(v)}>
            {uiText('Изменить')}
          </Button>
          {v.isActive && (
            <Button
              size="small"
              icon={<Mail size={14} />}
              onClick={async () => {
                try {
                  setGrant({ grant: await ministryApi.resendInvite(v.id), viewerId: v.id })
                } catch (e) {
                  fail(e)
                }
              }}
            >
              {uiText('Отправить письмо ещё раз')}
            </Button>
          )}
          <Popconfirm
            title={v.isActive ? uiText('Отключить доступ? Человек сразу выйдет из системы.') : uiText('Включить доступ снова?')}
            okText={uiText('Да')}
            cancelText={uiText('Отмена')}
            onConfirm={() => toggle.mutate(v)}
          >
            <Button size="small" danger={v.isActive} icon={<Power size={14} />}>
              {v.isActive ? uiText('Отключить') : uiText('Включить')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <SproutPageHeader
        title={uiText('Министерство и районы')}
        description={uiText('Наблюдатели видят сводную статистику школ своего охвата и ничего не меняют. Пароль человек задаёт сам по ссылке из письма.')}
        icon={<Landmark size={22} />}
        iconAccent="lilac"
        actions={
          <Button type="primary" icon={<Plus size={16} />} onClick={() => openForm('new')}>
            {uiText('Добавить наблюдателя')}
          </Button>
        }
      />

      {viewers.isError && <Alert type="error" showIcon style={{ marginBottom: 16 }} message={uiText('Не удалось загрузить список. Попробуйте обновить страницу.')} />}
      {viewers.isLoading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : (
        <Card styles={{ body: { padding: 0 } }}>
          <Table<Viewer> rowKey="id" columns={columns} dataSource={viewers.data ?? []} pagination={false} scroll={{ x: 'max-content' }} locale={{ emptyText: uiText('Наблюдателей пока нет') }} />
        </Card>
      )}

      <Modal
        open={editing !== null}
        title={editing === 'new' ? uiText('Новый наблюдатель') : uiText('Наблюдатель')}
        okText={editing === 'new' ? uiText('Создать и отправить приглашение') : uiText('Сохранить')}
        cancelText={uiText('Отмена')}
        confirmLoading={save.isPending}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        destroyOnClose
      >
        <Form<FormValues> form={form} layout="vertical" onFinish={(values) => save.mutate(values)} requiredMark={false}>
          <Form.Item name="fullName" label={uiText('ФИО')} rules={[{ required: true, message: uiText('Укажите ФИО') }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="email"
            label={uiText('Email')}
            extra={uiText('На этот адрес придёт приглашение: человек сам придумает пароль.')}
            rules={[{ required: true, type: 'email', message: uiText('Укажите настоящий email') }]}
          >
            <Input disabled={editing !== 'new'} />
          </Form.Item>
          <Form.Item name="organization" label={uiText('Организация')} rules={[{ required: true, message: uiText('Укажите организацию') }]}>
            <Input placeholder={uiText('Министерство образования, Отдел образования района Ашт…')} />
          </Form.Item>
          <Form.Item name="allSchools" label={uiText('Все школы страны')} valuePropName="checked">
            <Switch />
          </Form.Item>
          {!allSchools && (
            <Form.Item
              name="area"
              label={uiText('Какие области и районы видит')}
              extra={uiText('Отметьте область целиком или отдельные районы.')}
              rules={[{ required: true, type: 'array', min: 1, message: uiText('Выберите хотя бы одну область или район') }]}
            >
              <Cascader multiple showSearch options={options} showCheckedStrategy={Cascader.SHOW_PARENT} placeholder={uiText('Область и район')} style={{ width: '100%' }} />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <AccessResultModal
        grant={grant?.grant ?? null}
        onRetry={grant ? () => ministryApi.resendInvite(grant.viewerId) : undefined}
        onClose={() => setGrant(null)}
      />
    </div>
  )
}
