import { uiText } from '../i18n/uiText'
import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  App as AntdApp,
  Avatar,
  Button,
  Card,
  Cascader,
  Drawer,
  Form,
  Grid,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
  BankOutlined,
  PlusOutlined,
  TeamOutlined,
  UserOutlined,
  AppstoreOutlined,
  EditOutlined,
  DeleteOutlined,
  MailOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
  SendOutlined,
} from '@ant-design/icons'
import { motion } from 'framer-motion'

import { School } from 'lucide-react'
import { SproutPageHeader } from '../components/sprout'
import { http } from '../api'
import FeaturesModal from '../components/FeaturesModal'
import AccessResultModal from '../components/AccessResultModal'
import AlertsCheckButton from '../components/AlertsCheckButton'
import type { AccessGrant } from '../api/accessApi'
import { regionsApi, geoName, type AreaValue, type RegionNode } from '../api/regionsApi'
import { useLangStore } from '../i18n'

const { Text } = Typography
const { useBreakpoint } = Grid

/** Ответ POST /v1/kindergartens: директору всегда уходит приглашение со ссылкой, пароля нет. */
interface CreateSchoolResponse {
  kindergarten: { id: string }
  invite: AccessGrant
}

interface KindergartenApi {
  id: string
  slug: string
  name: string
  address: string | null
  phone: string | null
  isActive: boolean
  createdAt: string
  /** FIVE — пятибалльная, TEN — десятибалльная. */
  gradeScale: 'FIVE' | 'TEN'
  /** null — район не указан (школа создана до появления справочника). */
  districtId: string | null
  district: { id: string; nameRu: string; nameTg: string; nameEn: string } | null
  region: { id: string; nameRu: string; nameTg: string; nameEn: string } | null
  stats: {
    usersCount: number
    groupsCount: number
    studentsCount: number
  }
}

/** Приглашение директору школы ещё раз (или ссылка для смены пароля, если он уже входил). */
const resendOwnerInvite = (kindergartenId: string) =>
  http.post<AccessGrant>(`/v1/kindergartens/${kindergartenId}/resend-invite`).then((r) => r.data)

export default function SchoolsPage() {
  const { message } = AntdApp.useApp()
  const screens = useBreakpoint()
  const isMobile = !screens.md

  const [items, setItems] = useState<KindergartenApi[]>([])
  const [loading, setLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<KindergartenApi | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()
  const lang = useLangStore((s) => s.lang)

  // Справочник областей и районов для каскада «область → район».
  const [regions, setRegions] = useState<RegionNode[]>([])
  useEffect(() => {
    regionsApi.tree().then(setRegions).catch(() => setRegions([]))
  }, [])
  const areaOptions = useMemo(
    () =>
      regions.map((r) => ({
        value: r.id,
        label: geoName(r, lang),
        children: r.districts.map((d) => ({ value: d.id, label: geoName(d, lang) })),
      })),
    [regions, lang],
  )

  // Итог приглашения директору: письмо ушло или не ушло (тогда можно отправить ещё раз)
  const [access, setAccess] = useState<{ grant: AccessGrant; kindergartenId: string } | null>(null)

  // Школа, чьи разделы редактируются в модалке
  const [featuresFor, setFeaturesFor] = useState<KindergartenApi | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      const res = await http.get<KindergartenApi[]>('/v1/kindergartens')
      setItems(res.data)
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        uiText("Не удалось загрузить школы")
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ phone: '+992 ', gradeScale: 'FIVE' })
    setDrawerOpen(true)
  }

  const openEdit = (k: KindergartenApi) => {
    setEditing(k)
    form.setFieldsValue({
      name: k.name,
      address: k.address,
      phone: k.phone,
      area: k.region && k.district ? [k.region.id, k.district.id] : undefined,
      gradeScale: k.gradeScale ?? 'FIVE',
    })
    setDrawerOpen(true)
  }

  const submit = async () => {
    try {
      const v = await form.validateFields()
      setSubmitting(true)

      if (editing) {
        await http.patch(`/v1/kindergartens/${editing.id}`, {
          name: v.name,
          address: v.address || undefined,
          phone: v.phone || undefined,
          // район не выбран при правке — оставляем как есть
          districtId: (v.area as AreaValue | undefined)?.[1],
          gradeScale: v.gradeScale,
        })
        message.success(uiText("Школа обновлена"))
      } else {
        const ownerEmail = v.ownerEmail.trim().toLowerCase()
        const res = await http.post<CreateSchoolResponse>('/v1/kindergartens', {
          name: v.name,
          address: v.address || undefined,
          phone: v.phone || undefined,
          districtId: (v.area as AreaValue)[1],
          gradeScale: v.gradeScale,
          // Пароль не задаётся: директору уйдёт письмо со ссылкой, и он придумает его сам.
          owner: { fullName: v.ownerFullName, email: ownerEmail },
        })
        const created = res.data
        if (created?.invite && created.kindergarten?.id) {
          setAccess({ grant: created.invite, kindergartenId: created.kindergarten.id })
        }
        message.success(uiText("Школа создана"))
      }

      setDrawerOpen(false)
      await load()
    } catch (err: any) {
      if (err?.errorFields) return
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        uiText("Не удалось сохранить")
      message.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const resendInvite = async (k: KindergartenApi) => {
    try {
      const grant = await resendOwnerInvite(k.id)
      setAccess({ grant, kindergartenId: k.id })
    } catch (err: any) {
      message.error(err?.response?.data?.message || uiText("Не удалось отправить письмо"))
    }
  }

  const remove = async (k: KindergartenApi) => {
    try {
      await http.delete(`/v1/kindergartens/${k.id}`)
      message.success(uiText("«{0}» удалено", k.name))
      await load()
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        uiText("Не удалось удалить")
      message.error(msg)
    }
  }

  return (
    <div>
      <SproutPageHeader
        title={uiText("Школы")}
        icon={<School size={22} strokeWidth={2} />}
        iconAccent="blue"
        description={uiText("Управление всеми школами платформы. Каждая школа изолирована: свои классы, ученики и данные.")}
        actions={
          <Space wrap>
            <AlertsCheckButton />
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              {isMobile ? uiText("Новая") : uiText("Новая школа")}
            </Button>
          </Space>
        }
      />

      <Alert
        type="info"
        showIcon
        message={uiText("Вы — владелец платформы")}
        description={uiText("Создавайте школы и назначайте им директоров. Разделами каждой школы (кнопка «Разделы» в строке) вы управляете сами.")}
        style={{ marginBottom: 16 }}
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="glass" bordered={false}>
          <Table<KindergartenApi>
            rowKey="id"
            loading={loading}
            dataSource={items}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 700 }}
            columns={[
              {
                title: uiText("Название"),
                key: 'name',
                render: (_, k) => (
                  <Space>
                    <Avatar
                      icon={<BankOutlined />}
                      style={{ background: 'linear-gradient(135deg,#3B8FBF,#3B8FBF)' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {k.name}
                      </div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        slug: <code>{k.slug}</code>
                      </Text>
                    </div>
                  </Space>
                ),
              },
              {
                title: uiText("Район"),
                key: 'district',
                render: (_, k) =>
                  k.district && k.region ? (
                    <div>
                      <div style={{ fontWeight: 500 }}>{geoName(k.district, lang)}</div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {geoName(k.region, lang)}
                      </Text>
                    </div>
                  ) : (
                    <Tag>{uiText("Не указан")}</Tag>
                  ),
              },
              {
                title: uiText("Адрес"),
                key: 'address',
                render: (_, k) =>
                  k.address ? (
                    <Text>
                      <EnvironmentOutlined /> {k.address}
                    </Text>
                  ) : (
                    '—'
                  ),
              },
              {
                title: uiText("Телефон"),
                key: 'phone',
                render: (_, k) =>
                  k.phone ? (
                    <Text>
                      <PhoneOutlined /> {k.phone}
                    </Text>
                  ) : (
                    '—'
                  ),
              },
              {
                title: uiText("Статистика"),
                key: 'stats',
                render: (_, k) => (
                  <Space wrap size={4}>
                    <Tag color="blue" icon={<UserOutlined />}>
                      {k.stats.usersCount}
                    </Tag>
                    <Tag color="purple" icon={<AppstoreOutlined />}>
                      {k.stats.groupsCount}
                    </Tag>
                    <Tag color="cyan" icon={<TeamOutlined />}>
                      {k.stats.studentsCount}
                    </Tag>
                  </Space>
                ),
              },
              {
                title: uiText("Статус"),
                dataIndex: 'isActive',
                render: (active: boolean) =>
                  active ? (
                    <Tag color="green">{uiText("Активен")}</Tag>
                  ) : (
                    <Tag color="red">{uiText("Отключён")}</Tag>
                  ),
              },
              {
                title: '',
                key: 'actions',
                render: (_, k) => (
                  <Space>
                    <Tooltip title={uiText("Разделы")}>
                      <Button
                        size="small"
                        type="text"
                        icon={<AppstoreOutlined />}
                        onClick={() => setFeaturesFor(k)}
                      />
                    </Tooltip>
                    <Popconfirm
                      title={uiText("Отправить директору ссылку?")}
                      description={uiText("Директору уйдёт письмо со ссылкой: он сам задаст пароль. Вам пароль не показывается.")}
                      okText={uiText("Отправить")}
                      cancelText={uiText("Отмена")}
                      onConfirm={() => resendInvite(k)}
                    >
                      <Tooltip title={uiText("Отправить директору ссылку для пароля")}>
                        <Button
                          size="small"
                          type="text"
                          icon={<SendOutlined />}
                          aria-label={uiText("Отправить директору ссылку для пароля")}
                        />
                      </Tooltip>
                    </Popconfirm>
                    <Tooltip title={uiText("Редактировать")}>
                      <Button
                        size="small"
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => openEdit(k)}
                      />
                    </Tooltip>
                    <Popconfirm
                      title={uiText("Удалить «{0}»?", k.name)}
                      description={uiText("Все данные школы (классы, ученики, оценки, домашние задания, платежи) удалятся безвозвратно!")}
                      okText={uiText("Удалить")}
                      okButtonProps={{ danger: true }}
                      cancelText={uiText("Отмена")}
                      onConfirm={() => remove(k)}
                    >
                      <Button
                        size="small"
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                      />
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      </motion.div>

      <Drawer
        title={editing ? uiText("Редактировать школу") : uiText("Новая школа")}
        width={isMobile ? '100%' : 480}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        destroyOnClose
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>{uiText("Отмена")}</Button>
            <Button type="primary" loading={submitting} onClick={submit}>
              {editing ? uiText("Сохранить") : uiText("Создать")}
            </Button>
          </Space>
        }
      >
        <Form layout="vertical" form={form}>
          <Typography.Title level={5}>{uiText("📍 Информация о школе")}</Typography.Title>

          <Form.Item
            name="name"
            label={uiText("Название")}
            rules={[{ required: true, message: uiText("Введите название") }]}
          >
            <Input
              placeholder={uiText("Например, Школа №42")}
            />
          </Form.Item>

          <Form.Item
            name="area"
            label={uiText("Область и район")}
            // при создании район обязателен; у старых школ без района при правке можно не выбирать
            rules={editing ? [] : [{ required: true, message: uiText("Выберите область и район") }]}
            extra={
              <Text type="secondary" style={{ fontSize: 12 }}>
                {uiText("Нужно для региональной статистики министерства и районных отделов.")}
              </Text>
            }
          >
            <Cascader
              options={areaOptions}
              expandTrigger="click"
              showSearch={{
                filter: (input, path) =>
                  path.some((o) => String(o.label).toLowerCase().includes(input.trim().toLowerCase())),
              }}
              placeholder={uiText("Выберите область, затем район")}
              allowClear={!!editing}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item name="address" label={uiText("Адрес")}>
            <Input prefix={<EnvironmentOutlined />} placeholder={uiText("Город, улица")} />
          </Form.Item>

          <Form.Item
            name="gradeScale"
            label={uiText("Шкала оценок школы")}
            extra={
              <Text type="secondary" style={{ fontSize: 12 }}>
                {uiText("Нужна, чтобы сравнивать школы с разной системой оценок.")}
              </Text>
            }
          >
            <Select
              options={[
                { value: 'FIVE', label: uiText("Пятибалльная (1–5)") },
                { value: 'TEN', label: uiText("Десятибалльная (1–10)") },
              ]}
            />
          </Form.Item>

          <Form.Item name="phone" label={uiText("Телефон")}>
            <Input prefix={<PhoneOutlined />} placeholder="+992 …" />
          </Form.Item>

          {!editing && (
            <>
              <Typography.Title level={5} style={{ marginTop: 24 }}>
                {" " + uiText("👤 Первый администратор") + " "}</Typography.Title>

              <Alert
                type="info"
                showIcon
                message={uiText("Это будет директор школы")}
                description={uiText("Ему придёт письмо со ссылкой на 48 часов: по ней он сам придумает пароль и войдёт. Пароль вы не задаёте, не видите и не передаёте.")}
                style={{ marginBottom: 12 }}
              />

              <Form.Item
                name="ownerFullName"
                label={uiText("ФИО владельца")}
                rules={[{ required: true, message: uiText("Введите ФИО") }]}
              >
                <Input placeholder={uiText("Например, Шерамардов Кутбиддин")} />
              </Form.Item>

              <Form.Item
                name="ownerEmail"
                label="Email"
                rules={[
                  { required: true, message: uiText("Введите email") },
                  { type: 'email', message: uiText("Некорректный email") },
                ]}
              >
                <Input prefix={<MailOutlined />} placeholder="owner@example.com" />
              </Form.Item>

            </>
          )}
        </Form>
      </Drawer>

      <AccessResultModal
        grant={access?.grant ?? null}
        onRetry={access ? () => resendOwnerInvite(access.kindergartenId) : undefined}
        onClose={() => setAccess(null)}
      />

      <FeaturesModal school={featuresFor} onClose={() => setFeaturesFor(null)} />
    </div>
  )
}
