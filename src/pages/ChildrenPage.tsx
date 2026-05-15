import { useMemo, useState } from 'react'
import {
  Avatar,
  Button,
  Card,
  Col,
  DatePicker,
  Drawer,
  Form,
  Grid,
  Input,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
  Popconfirm,
  App as AntdApp,
  Tooltip,
} from 'antd'
import type { UploadFile } from 'antd'
import {
  UserOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  UploadOutlined,
  PhoneOutlined,
  WomanOutlined,
  ManOutlined,
} from '@ant-design/icons'
import { motion } from 'framer-motion'
import dayjs from 'dayjs'

import PageHeader from '../components/PageHeader'
import { useDataStore } from '../store/dataStore'
import { useAuthStore } from '../store/authStore'
import { calcAge, formatDate, formatMoney } from '../lib/format'
import { refreshTenantData } from '../hooks/useTenantSync'
import { http } from '../api'
import type { Child, Gender } from '../types'

const { Text } = Typography
const { useBreakpoint } = Grid

export default function ChildrenPage() {
  const { message } = AntdApp.useApp()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const groups = useDataStore((s) => s.groups)
  const children = useDataStore((s) => s.children)
  const user = useAuthStore((s) => s.user)
  const [submitting, setSubmitting] = useState(false)

  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState<string | undefined>(
    user?.role === 'teacher' ? user.groupId : undefined,
  )
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Child | null>(null)
  const [photoList, setPhotoList] = useState<UploadFile[]>([])
  const [form] = Form.useForm()

  const visibleChildren = useMemo(() => {
    let res = children
    if (user?.role === 'teacher') res = res.filter((c) => c.groupId === user.groupId)
    if (groupFilter) res = res.filter((c) => c.groupId === groupFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      res = res.filter(
        (c) =>
          c.firstName.toLowerCase().includes(q) ||
          c.lastName.toLowerCase().includes(q) ||
          (c.motherName || '').toLowerCase().includes(q) ||
          (c.fatherName || '').toLowerCase().includes(q),
      )
    }
    return res
  }, [children, groupFilter, search, user])

  const openCreate = () => {
    setEditing(null)
    setPhotoList([])
    form.resetFields()
    form.setFieldsValue({
      gender: 'male',
      groupId: user?.role === 'teacher' ? user.groupId : groups[0]?.id,
    })
    setDrawerOpen(true)
  }

  const openEdit = (c: Child) => {
    setEditing(c)
    setPhotoList(
      c.photoUrl
        ? [{ uid: 'cur', name: 'photo', url: c.photoUrl, status: 'done' } as UploadFile]
        : [],
    )
    form.setFieldsValue({
      ...c,
      birthDate: c.birthDate ? dayjs(c.birthDate) : null,
    })
    setDrawerOpen(true)
  }

  const removeChild = async (childId: string, canModify: boolean) => {
    if (!canModify) {
      message.error('Нет прав на удаление')
      return
    }
    try {
      await http.delete(`/v1/students/${childId}`)
      message.success('Удалено')
      refreshTenantData()
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Не удалось удалить ребёнка'
      message.error(msg)
    }
  }

  const submit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)

      const photoUrl =
        photoList[0]?.url ||
        (photoList[0]?.originFileObj
          ? URL.createObjectURL(photoList[0].originFileObj as Blob)
          : undefined)

      // Учитель не может ставить ребёнку чужую группу — принудительно своя.
      const enforcedGroupId =
        user?.role === 'teacher' ? user.groupId : values.groupId
      if (user?.role === 'teacher' && !user.groupId) {
        message.error('Вам не назначена группа. Обратитесь к администратору.')
        return
      }

      // Backend ожидает gender в uppercase (MALE/FEMALE)
      const genderApi = values.gender === 'female' ? 'FEMALE' : 'MALE'

      const body: Record<string, unknown> = {
        firstName: values.firstName,
        lastName: values.lastName,
        middleName: values.middleName || undefined,
        birthDate: dayjs(values.birthDate).format('YYYY-MM-DD'),
        gender: genderApi,
        groupId: enforcedGroupId,
        photoUrl: photoUrl,
        medicalNotes: values.medicalNotes || undefined,
        notes: values.notes || undefined,
        motherName: values.motherName || undefined,
        motherPhone: values.motherPhone || undefined,
        fatherName: values.fatherName || undefined,
        fatherPhone: values.fatherPhone || undefined,
        address: values.address || undefined,
        extraContact: values.extraContact || undefined,
        telegram: values.telegram || undefined,
        whatsapp: values.whatsapp || undefined,
        monthlyFee: values.monthlyFee ? Number(values.monthlyFee) : undefined,
      }

      if (editing) {
        await http.patch(`/v1/students/${editing.id}`, body)
        message.success('Ребёнок обновлён')
      } else {
        await http.post('/v1/students', body)
        message.success('Ребёнок добавлен')
      }

      setDrawerOpen(false)
      refreshTenantData()
    } catch (err: any) {
      if (err?.errorFields) return
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Не удалось сохранить ребёнка'
      message.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const columns = [
    {
      title: 'Ребёнок',
      key: 'name',
      render: (_: unknown, c: Child) => (
        <Space>
          {c.photoUrl ? (
            <Avatar src={c.photoUrl} size={36} />
          ) : (
            <Avatar
              size={36}
              icon={c.gender === 'female' ? <WomanOutlined /> : <ManOutlined />}
              style={{
                background:
                  c.gender === 'female'
                    ? 'linear-gradient(135deg,#ec4899,#f97316)'
                    : 'linear-gradient(135deg,#6366f1,#06b6d4)',
              }}
            />
          )}
          <div>
            <div style={{ fontWeight: 600 }}>
              {c.lastName} {c.firstName}
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {calcAge(c.birthDate)} л. · {formatDate(c.birthDate)}
            </Text>
          </div>
        </Space>
      ),
      fixed: 'left' as const,
    },
    {
      title: 'Группа',
      dataIndex: 'groupId',
      key: 'group',
      filters: groups.map((g) => ({ text: g.name, value: g.id })),
      onFilter: (v: React.Key | boolean, c: Child) => c.groupId === v,
      render: (groupId: string) => {
        const g = groups.find((x) => x.id === groupId)
        if (!g) return <Tag>—</Tag>
        return <Tag color={undefined} style={{ background: g.color + '22', color: g.color, border: `1px solid ${g.color}55` }}>{g.name}</Tag>
      },
    },
    {
      title: 'Пол',
      dataIndex: 'gender',
      key: 'gender',
      render: (v: Gender) =>
        v === 'female' ? <Tag color="magenta">Девочка</Tag> : <Tag color="blue">Мальчик</Tag>,
    },
    {
      title: 'Родители',
      key: 'parents',
      render: (_: unknown, c: Child) => (
        <div>
          {c.motherName && (
            <div>
              <Text>👩 {c.motherName}</Text>{' '}
              {c.motherPhone && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <PhoneOutlined /> {c.motherPhone}
                </Text>
              )}
            </div>
          )}
          {c.fatherName && (
            <div>
              <Text>👨 {c.fatherName}</Text>{' '}
              {c.fatherPhone && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <PhoneOutlined /> {c.fatherPhone}
                </Text>
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Плата',
      dataIndex: 'monthlyFee',
      key: 'fee',
      render: (v: number | undefined, c: Child) => {
        const g = groups.find((x) => x.id === c.groupId)
        return formatMoney(v ?? g?.monthlyFee ?? 0)
      },
    },
    {
      title: 'Действия',
      key: 'actions',
      fixed: 'right' as const,
      render: (_: unknown, c: Child) => {
        // Учитель может действовать только с детьми своей группы.
        const canModify =
          user?.role !== 'teacher' || c.groupId === user.groupId
        return (
          <Space>
            <Tooltip title={canModify ? 'Редактировать' : 'Нет прав'}>
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                disabled={!canModify}
                onClick={() => openEdit(c)}
              />
            </Tooltip>
            <Popconfirm
              title="Удалить ребёнка?"
              okText="Удалить"
              cancelText="Отмена"
              disabled={!canModify}
              onConfirm={() => removeChild(c.id, canModify)}
            >
              <Button
                size="small"
                type="text"
                danger
                icon={<DeleteOutlined />}
                disabled={!canModify}
              />
            </Popconfirm>
          </Space>
        )
      },
    },
  ]

  return (
    <div>
      <PageHeader
        title="Дети"
        icon={<UserOutlined />}
        description={
          user?.role === 'teacher'
            ? 'Дети вашей группы. Вы можете добавлять и удалять только своих воспитанников.'
            : 'Список всех воспитанников детского сада'
        }
        actions={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreate}
            disabled={user?.role === 'teacher' && !user.groupId}
          >
            Добавить ребёнка
          </Button>
        }
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="glass" bordered={false}>
          <Row gutter={[12, 12]} className="mb-3">
            <Col xs={24} md={10}>
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder="Поиск по имени ребёнка или родителю"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Col>
            <Col xs={24} md={8}>
              <Select
                allowClear
                style={{ width: '100%' }}
                placeholder="Все группы"
                value={groupFilter}
                onChange={setGroupFilter}
                disabled={user?.role === 'teacher'}
                options={groups.map((g) => ({ value: g.id, label: g.name }))}
              />
            </Col>
            <Col xs={24} md={6} className="flex items-center">
              <Tag color="purple">Найдено: {visibleChildren.length}</Tag>
            </Col>
          </Row>

          {isMobile ? (
            <div className="flex flex-col gap-3">
              {visibleChildren.length === 0 && (
                <div className="text-center py-6">
                  <Text type="secondary">Нет детей</Text>
                </div>
              )}
              {visibleChildren.map((c) => {
                const g = groups.find((x) => x.id === c.groupId)
                const canModify =
                  user?.role !== 'teacher' || c.groupId === user.groupId
                const fee = c.monthlyFee ?? g?.monthlyFee ?? 0
                return (
                  <Card
                    key={c.id}
                    size="small"
                    style={{
                      borderRadius: 12,
                      borderLeft: `4px solid ${g?.color || '#6366f1'}`,
                    }}
                    styles={{ body: { padding: 12 } }}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      {c.photoUrl ? (
                        <Avatar src={c.photoUrl} size={44} />
                      ) : (
                        <Avatar
                          size={44}
                          icon={
                            c.gender === 'female' ? (
                              <WomanOutlined />
                            ) : (
                              <ManOutlined />
                            )
                          }
                          style={{
                            background:
                              c.gender === 'female'
                                ? 'linear-gradient(135deg,#ec4899,#f97316)'
                                : 'linear-gradient(135deg,#6366f1,#06b6d4)',
                          }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: 15,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {c.lastName} {c.firstName}
                        </div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {calcAge(c.birthDate)} л. · {formatDate(c.birthDate)}
                        </Text>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-2">
                      {g && (
                        <Tag
                          style={{
                            background: g.color + '22',
                            color: g.color,
                            border: `1px solid ${g.color}55`,
                            margin: 0,
                          }}
                        >
                          {g.name}
                        </Tag>
                      )}
                      <Tag
                        color={c.gender === 'female' ? 'magenta' : 'blue'}
                        style={{ margin: 0 }}
                      >
                        {c.gender === 'female' ? 'Девочка' : 'Мальчик'}
                      </Tag>
                    </div>

                    {(c.motherName || c.fatherName) && (
                      <div
                        style={{
                          fontSize: 13,
                          background: 'rgba(0,0,0,0.02)',
                          padding: 8,
                          borderRadius: 8,
                          marginBottom: 8,
                        }}
                      >
                        {c.motherName && (
                          <div>
                            👩 {c.motherName}
                            {c.motherPhone && (
                              <Text
                                type="secondary"
                                style={{ fontSize: 12, marginLeft: 6 }}
                              >
                                <PhoneOutlined /> {c.motherPhone}
                              </Text>
                            )}
                          </div>
                        )}
                        {c.fatherName && (
                          <div>
                            👨 {c.fatherName}
                            {c.fatherPhone && (
                              <Text
                                type="secondary"
                                style={{ fontSize: 12, marginLeft: 6 }}
                              >
                                <PhoneOutlined /> {c.fatherPhone}
                              </Text>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          Плата
                        </Text>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>
                          {formatMoney(fee)}{' '}
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            сомони
                          </Text>
                        </div>
                      </div>
                      <Space size={4}>
                        <Button
                          size="middle"
                          icon={<EditOutlined />}
                          disabled={!canModify}
                          onClick={() => openEdit(c)}
                        />
                        <Popconfirm
                          title="Удалить ребёнка?"
                          okText="Удалить"
                          cancelText="Отмена"
                          disabled={!canModify}
                          onConfirm={() => removeChild(c.id, canModify)}
                        >
                          <Button
                            size="middle"
                            danger
                            icon={<DeleteOutlined />}
                            disabled={!canModify}
                          />
                        </Popconfirm>
                      </Space>
                    </div>
                  </Card>
                )
              })}
            </div>
          ) : (
          <Table
            rowKey="id"
            dataSource={visibleChildren}
            columns={columns}
            scroll={{ x: 800 }}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            size="middle"
            sticky
            expandable={{
              expandedRowRender: (c) => (
                <div className="text-sm space-y-1">
                  {c.address && (
                    <div>
                      <Text type="secondary">Адрес:</Text> {c.address}
                    </div>
                  )}
                  {c.medicalNotes && (
                    <div>
                      <Text type="secondary">Медицинская информация:</Text> {c.medicalNotes}
                    </div>
                  )}
                  {c.notes && (
                    <div>
                      <Text type="secondary">Комментарии:</Text> {c.notes}
                    </div>
                  )}
                  <div className="flex gap-3">
                    {c.telegram && (
                      <Text type="secondary">
                        Telegram: <Text copyable>{c.telegram}</Text>
                      </Text>
                    )}
                    {c.whatsapp && (
                      <Text type="secondary">
                        WhatsApp: <Text copyable>{c.whatsapp}</Text>
                      </Text>
                    )}
                  </div>
                </div>
              ),
            }}
          />
          )}
        </Card>
      </motion.div>

      <Drawer
        title={editing ? 'Редактировать ребёнка' : 'Новый ребёнок'}
        open={drawerOpen}
        width={isMobile ? '100%' : 520}
        onClose={() => setDrawerOpen(false)}
        destroyOnClose
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>Отмена</Button>
            <Button type="primary" loading={submitting} onClick={submit}>
              Сохранить
            </Button>
          </Space>
        }
      >
        <Form layout="vertical" form={form}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="lastName" label="Фамилия" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="firstName" label="Имя" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="birthDate" label="Дата рождения" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="gender" label="Пол" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: 'male', label: 'Мальчик' },
                    { value: 'female', label: 'Девочка' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="groupId"
            label="Группа"
            rules={[{ required: true }]}
            extra={
              user?.role === 'teacher' ? (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Учитель может добавлять детей только в свою группу
                </Text>
              ) : undefined
            }
          >
            <Select
              disabled={user?.role === 'teacher'}
              options={groups.map((g) => ({ value: g.id, label: g.name }))}
            />
          </Form.Item>

          <Form.Item label="Фото">
            <Upload
              listType="picture-card"
              maxCount={1}
              fileList={photoList}
              beforeUpload={() => false}
              onChange={({ fileList }) => setPhotoList(fileList)}
            >
              {photoList.length === 0 && (
                <div>
                  <UploadOutlined />
                  <div style={{ marginTop: 6 }}>Загрузить</div>
                </div>
              )}
            </Upload>
          </Form.Item>

          <Form.Item name="medicalNotes" label="Медицинская информация">
            <Input.TextArea rows={2} placeholder="Аллергии, особенности здоровья" />
          </Form.Item>
          <Form.Item name="notes" label="Комментарии">
            <Input.TextArea rows={2} />
          </Form.Item>

          <Typography.Title level={5}>Родители</Typography.Title>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="motherName" label="Имя мамы">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="motherPhone" label="Телефон мамы">
                <Input prefix={<PhoneOutlined />} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="fatherName" label="Имя папы">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="fatherPhone" label="Телефон папы">
                <Input prefix={<PhoneOutlined />} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="address" label="Адрес">
            <Input />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="telegram" label="Telegram (@username)">
                <Input placeholder="@username" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="whatsapp" label="WhatsApp">
                <Input placeholder="+992 …" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="extraContact" label="Доп. контакт">
            <Input />
          </Form.Item>
          <Form.Item name="monthlyFee" label="Индивидуальная плата (опц.)">
            <Input type="number" suffix="сомони" />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  )
}
