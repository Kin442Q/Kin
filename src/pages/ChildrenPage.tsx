import { uiLanguage, uiText } from '../i18n/uiText'
import { useEffect, useMemo, useRef, useState } from 'react'
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
  InputNumber,
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
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  UploadOutlined,
  DownloadOutlined,
  PhoneOutlined,
  WomanOutlined,
  ManOutlined,
  TeamOutlined,
  KeyOutlined,
  LinkOutlined,
} from '@ant-design/icons'
import { Baby } from 'lucide-react'
import ChildParentsModal from '../components/ChildParentsModal'
import StudentAccountModal from '../components/StudentAccountModal'
import ClassLinksModal from '../components/ClassLinksModal'
import ImportStudentsModal from '../components/ImportStudentsModal'
import ClassFilter, {
  EMPTY_SELECTION,
  defaultSelection,
  selectedGroupIds,
  type ClassSelection,
} from '../components/ClassFilter'
import { motion } from 'framer-motion'
import dayjs from 'dayjs'

import { SP, SproutPageHeader, SproutEmpty } from '../components/sprout'
import { useDataStore } from '../store/dataStore'
import { useAuthStore } from '../store/authStore'
import { useLabels } from '../hooks/useLabels'
import { useFeature } from '../hooks/useFeature'
import { cap } from '../lib/labels'
import { calcAge, formatDate, formatMoney } from '../lib/format'
import { exportRows } from '../lib/exportXlsx'
import { plural } from '../lib/classes'
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
  // Фильтр класса: параллель → буква. Пока он не задан и нет поиска, список пуст.
  const [sel, setSel] = useState<ClassSelection>(EMPTY_SELECTION)
  const selTouched = useRef(false)
  const changeSel = (n: ClassSelection) => {
    selTouched.current = true
    setSel(n)
  }
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Child | null>(null)
  const [photoList, setPhotoList] = useState<UploadFile[]>([])
  const [form] = Form.useForm()
  const [parentsModal, setParentsModal] = useState<Child | null>(null)
  // Вход ученика в свой кабинет: выдаёт админ или классный руководитель его класса
  const [accountFor, setAccountFor] = useState<Child | null>(null)
  const portalOn = useFeature('portal')
  const canGiveAccess = (c: Child) =>
    portalOn &&
    (isAdmin || (isTeacher && !!user?.homeroomGroups?.some((g) => g.id === c.groupId)))
  const [importOpen, setImportOpen] = useState(false)
  const [linksOpen, setLinksOpen] = useState(false)
  const isAdmin = user?.role === 'admin' || user?.role === 'SUPER_ADMIN'
  // Роль с бэкенда приходит в верхнем регистре (TEACHER); поддерживаем оба.
  const isTeacher = user?.role === 'TEACHER' || user?.role === 'teacher'
  const L = useLabels()
  const isSchool = L.isSchool
  const homeroomIds = user?.homeroomGroups?.map((g) => g.id) ?? []
  // Класс для печати ссылок — тот, что выбран в фильтре «параллель → буква»
  const pickedGroupId = sel.groupId ?? undefined
  const linksGroupId = isAdmin
    ? pickedGroupId
    : isTeacher
      ? pickedGroupId && homeroomIds.includes(pickedGroupId)
        ? pickedGroupId
        : homeroomIds[0]
      : undefined
  const linksGroup = linksGroupId
    ? { id: linksGroupId, name: groups.find((g) => g.id === linksGroupId)?.name ?? '' }
    : null
  const canClassLinks = portalOn && (isAdmin || (isTeacher && homeroomIds.length > 0))
  // Плата за обучение — часть раздела «Оплата»: выключен — нигде не показываем.
  const showFees = useFeature('payments') && !isTeacher

  // Класс по умолчанию: у учителя — его класс, если класс в школе один — он.
  useEffect(() => {
    if (selTouched.current || groups.length === 0) return
    const d = defaultSelection(groups, isTeacher ? user?.groupId : null)
    if (d.grade !== null) setSel(d)
  }, [groups, isTeacher, user?.groupId])

  const selectedIds = useMemo(() => selectedGroupIds(groups, sel), [groups, sel, uiLanguage()])
  const query = search.trim().toLowerCase()
  const hasFilter = query.length > 0 || selectedIds.length > 0

  // Сколько учеников в каждом классе — мелкие числа на плашках фильтра
  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const c of children) if (c.groupId) m[c.groupId] = (m[c.groupId] ?? 0) + 1
    return m
  }, [children, uiLanguage()])

  const scopedChildren = useMemo(
    () => (user?.role === 'teacher' ? children.filter((c) => c.groupId === user.groupId) : children),
    [children, user, uiLanguage()],
  )

  // Таблица показывает только то, что попало под фильтр: имя и/или класс.
  const visibleChildren = useMemo(() => {
    if (!hasFilter) return []
    let res = scopedChildren
    if (selectedIds.length > 0) {
      const set = new Set(selectedIds)
      res = res.filter((c) => !!c.groupId && set.has(c.groupId))
    }
    if (query) {
      res = res.filter(
        (c) =>
          c.firstName.toLowerCase().includes(query) ||
          c.lastName.toLowerCase().includes(query) ||
          `${c.lastName} ${c.firstName}`.toLowerCase().includes(query) ||
          (c.motherName || '').toLowerCase().includes(query) ||
          (c.fatherName || '').toLowerCase().includes(query),
      )
    }
    return res
  }, [scopedChildren, hasFilter, selectedIds, query, uiLanguage()])

  const resetFilters = () => {
    selTouched.current = true
    setSearch('')
    setSel(EMPTY_SELECTION)
  }

  const exportToExcel = () => {
    const list = hasFilter ? visibleChildren : scopedChildren
    if (list.length === 0) {
      message.warning(uiText("Нет данных для экспорта"))
      return
    }
    const rows = list.map((c) => ({
      Фамилия: c.lastName,
      Имя: c.firstName,
      Отчество: c.middleName || '',
      'Дата рождения': c.birthDate || '',
      Пол: c.gender === 'female' ? uiText("Ж") : uiText("М"),
      [uiText("Класс")]:
        groups.find((g) => g.id === c.groupId)?.name || '',
      'Мать (ФИО)': c.motherName || '',
      'Телефон мамы': c.motherPhone || '',
      'Отец (ФИО)': c.fatherName || '',
      'Телефон папы': c.fatherPhone || '',
      Адрес: c.address || '',
    }))
    exportRows('ucheniki', rows, uiText("Список"))
    message.success(uiText("Экспортировано: {0}", rows.length))
  }

  const openCreate = () => {
    setEditing(null)
    setPhotoList([])
    form.resetFields()
    form.setFieldsValue({
      gender: 'male',
      groupId: user?.role === 'teacher' ? user.groupId : groups[0]?.id,
      motherPhone: '+992 ',
      fatherPhone: '+992 ',
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
      message.error(uiText("Нет прав на удаление"))
      return
    }
    try {
      await http.delete(`/v1/students/${childId}`)
      message.success(uiText("Удалено"))
      refreshTenantData()
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        uiText("Не удалось удалить ребёнка")
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
        message.error(uiText("Вам не назначена группа. Обратитесь к администратору."))
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
        // InputNumber возвращает number или null. Если null/0 — отправляем
        // null чтобы сбросить индивидуальную плату (бэк подставит групповую).
        monthlyFee:
          values.monthlyFee != null && values.monthlyFee !== ''
            ? Number(values.monthlyFee)
            : null,
      }

      if (editing) {
        await http.patch(`/v1/students/${editing.id}`, body)
        message.success(uiText("Ребёнок обновлён"))
      } else {
        await http.post('/v1/students', body)
        message.success(uiText("Ребёнок добавлен"))
      }

      setDrawerOpen(false)
      refreshTenantData()
    } catch (err: any) {
      if (err?.errorFields) return
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        uiText("Не удалось сохранить ребёнка")
      message.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const columns = [
    {
      title: uiText("Ребёнок"),
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
                    ? 'linear-gradient(135deg,#D9709B,#FFB020)'
                    : 'linear-gradient(135deg,#3B8FBF,#1BA6A0)',
              }}
            />
          )}
          <div>
            <div style={{ fontWeight: 600 }}>
              {c.lastName} {c.firstName}
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {calcAge(c.birthDate)} {" " + uiText("л. ·") + " "}{formatDate(c.birthDate)}
            </Text>
          </div>
        </Space>
      ),
      fixed: 'left' as const,
    },
    {
      title: uiText("Группа"),
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
      title: uiText("Пол"),
      dataIndex: 'gender',
      key: 'gender',
      render: (v: Gender) =>
        v === 'female' ? <Tag color="magenta">{uiText("Девочка")}</Tag> : <Tag color="blue">{uiText("Мальчик")}</Tag>,
    },
    {
      title: uiText("Родители"),
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
      title: uiText("Плата"),
      dataIndex: 'monthlyFee',
      key: 'fee',
      render: (v: number | undefined, c: Child) => {
        const g = groups.find((x) => x.id === c.groupId)
        return formatMoney(v ?? g?.monthlyFee ?? 0)
      },
    },
    {
      title: uiText("Действия"),
      key: 'actions',
      fixed: 'right' as const,
      render: (_: unknown, c: Child) => {
        // Учитель может действовать только с детьми своей группы.
        const canModify =
          user?.role !== 'teacher' || c.groupId === user.groupId
        return (
          <Space>
            {isAdmin && (
              <Tooltip title={uiText("Родители")}>
                <Button
                  size="small"
                  type="text"
                  icon={<TeamOutlined />}
                  onClick={() => setParentsModal(c)}
                />
              </Tooltip>
            )}
            {canGiveAccess(c) && (
              <Tooltip title={uiText("Личная ссылка ученика")}>
                <Button
                  size="small"
                  type="text"
                  icon={<KeyOutlined />}
                  onClick={() => setAccountFor(c)}
                />
              </Tooltip>
            )}
            <Tooltip title={canModify ? uiText("Редактировать") : uiText("Нет прав")}>
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                disabled={!canModify}
                onClick={() => openEdit(c)}
              />
            </Tooltip>
            <Popconfirm
              title={uiText("Удалить ученика?")}
              okText={uiText("Удалить")}
              cancelText={uiText("Отмена")}
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
      <SproutPageHeader
        title={L.students}
        icon={<Baby size={22} strokeWidth={2} />}
        iconAccent="blue"
        description={
          user?.role === 'teacher'
            ? uiText("Ученики вашего класса.")
            : uiText("Список всех учеников школы")
        }
        chip={
          <Tag
            style={{
              background: SP.primaryGhost,
              color: SP.primaryDeep,
              border: 'none',
              fontWeight: 600,
              fontSize: 11,
            }}
          >
            {hasFilter ? visibleChildren.length : scopedChildren.length}{' '}
            {pluralizeStudent(hasFilter ? visibleChildren.length : scopedChildren.length, isSchool)}
          </Tag>
        }
        actions={
          <Space>
            {canClassLinks && (
              <Tooltip title={linksGroup ? '' : uiText("Выберите класс в фильтре")}>
                <Button icon={<LinkOutlined />} disabled={!linksGroup} onClick={() => setLinksOpen(true)}>
                  {" " + uiText("Ссылки класса") + " "}</Button>
              </Tooltip>
            )}
            <Button
              icon={<DownloadOutlined />}
              onClick={exportToExcel}
              disabled={scopedChildren.length === 0}
            >
              {" " + uiText("Экспорт") + " "}</Button>
            <Button
              icon={<UploadOutlined />}
              onClick={() => setImportOpen(true)}
            >
              {" " + uiText("Импорт") + " "}</Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openCreate}
              disabled={user?.role === 'teacher' && !user.groupId}
            >
              {uiText("Добавить ученика")}
            </Button>
          </Space>
        }
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="glass" bordered={false}>
          <div className="flex flex-col gap-3 mb-3">
            <Row gutter={[12, 12]}>
              <Col xs={24} md={12}>
                <Input
                  allowClear
                  prefix={<SearchOutlined />}
                  placeholder={uiText("Поиск по имени {0} или родителю", L.student)}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </Col>
              <Col xs={24} md={12} className="flex items-center gap-2">
                {hasFilter && <Tag color="purple">{uiText("Найдено:") + " "}{visibleChildren.length}</Tag>}
                {hasFilter && (
                  <Button size="small" type="link" onClick={resetFilters}>
                    {" " + uiText("Сбросить") + " "}</Button>
                )}
              </Col>
            </Row>
            <ClassFilter groups={groups} value={sel} onChange={changeSel} allowAllLetters counts={counts} />
          </div>

          {!hasFilter ? (
            <SproutEmpty
              icon={<Baby size={28} strokeWidth={1.8} />}
              title={uiText("Выберите класс или начните поиск")}
              description={
                scopedChildren.length > 0
                  ? uiText("Список появится, когда вы выберете параллель и класс или введёте имя. Всего в школе: {0} {1}.", scopedChildren.length, plural(scopedChildren.length, [uiText("ученик"), uiText("ученика"), uiText("учеников")]))
                  : uiText("Учеников пока нет — добавьте первого кнопкой «Добавить ученика».")
              }
              minHeight={200}
            />
          ) : isMobile ? (
            <div className="flex flex-col gap-3">
              {visibleChildren.length === 0 && (
                <SproutEmpty
                  icon={<Baby size={28} strokeWidth={1.8} />}
                  title={uiText("Никого не нашли")}
                  description={uiText("Измените имя или выберите другой класс")}
                  minHeight={160}
                />
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
                      borderLeft: `4px solid ${g?.color || '#3B8FBF'}`,
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
                                ? 'linear-gradient(135deg,#D9709B,#FFB020)'
                                : 'linear-gradient(135deg,#3B8FBF,#1BA6A0)',
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
                          {calcAge(c.birthDate)} {" " + uiText("л. ·") + " "}{formatDate(c.birthDate)}
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
                        {c.gender === 'female' ? uiText("Девочка") : uiText("Мальчик")}
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

                    <div
                      className="flex items-center"
                      style={{ justifyContent: showFees ? 'space-between' : 'flex-end' }}
                    >
                      {showFees && (
                        <div>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {" " + uiText("Плата") + " "}</Text>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>
                            {formatMoney(fee)}{' '}
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {" " + uiText("сомони") + " "}</Text>
                          </div>
                        </div>
                      )}
                      <Space size={4}>
                        {isAdmin && (
                          <Button
                            size="middle"
                            icon={<TeamOutlined />}
                            onClick={() => setParentsModal(c)}
                          />
                        )}
                        {canGiveAccess(c) && (
                          <Button
                            size="middle"
                            icon={<KeyOutlined />}
                            onClick={() => setAccountFor(c)}
                          />
                        )}
                        <Button
                          size="middle"
                          icon={<EditOutlined />}
                          disabled={!canModify}
                          onClick={() => openEdit(c)}
                        />
                        <Popconfirm
                          title={uiText("Удалить ученика?")}
                          okText={uiText("Удалить")}
                          cancelText={uiText("Отмена")}
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
            columns={showFees ? columns : columns.filter((c) => c.key !== 'fee')}
            scroll={{ x: 800 }}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            size="middle"
            sticky
            expandable={{
              expandedRowRender: (c) => (
                <div className="text-sm space-y-1">
                  {c.address && (
                    <div>
                      <Text type="secondary">{uiText("Адрес:")}</Text> {c.address}
                    </div>
                  )}
                  {c.medicalNotes && (
                    <div>
                      <Text type="secondary">{uiText("Медицинская информация:")}</Text> {c.medicalNotes}
                    </div>
                  )}
                  {c.notes && (
                    <div>
                      <Text type="secondary">{uiText("Комментарии:")}</Text> {c.notes}
                    </div>
                  )}
                </div>
              ),
            }}
          />
          )}
        </Card>
      </motion.div>

      <Drawer
        title={
          editing
            ? uiText("Редактировать ученика")
            : uiText("Новый ученик")
        }
        open={drawerOpen}
        width={isMobile ? '100%' : 520}
        onClose={() => setDrawerOpen(false)}
        destroyOnClose
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>{uiText("Отмена")}</Button>
            <Button type="primary" loading={submitting} onClick={submit}>
              {" " + uiText("Сохранить") + " "}</Button>
          </Space>
        }
      >
        <Form layout="vertical" form={form}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="lastName" label={uiText("Фамилия")} rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="firstName" label={uiText("Имя")} rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="birthDate" label={uiText("Дата рождения")} rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="gender" label={uiText("Пол")} rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: 'male', label: uiText("Мальчик") },
                    { value: 'female', label: uiText("Девочка") },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="groupId"
            label={uiText("Группа")}
            rules={[{ required: true }]}
            extra={
              user?.role === 'teacher' ? (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {" " + uiText("Учитель может добавлять детей только в свою группу") + " "}</Text>
              ) : undefined
            }
          >
            <Select
              disabled={user?.role === 'teacher'}
              options={groups.map((g) => ({ value: g.id, label: g.name }))}
            />
          </Form.Item>

          <Form.Item label={uiText("Фото")}>
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
                  <div style={{ marginTop: 6 }}>{uiText("Загрузить")}</div>
                </div>
              )}
            </Upload>
          </Form.Item>

          <Form.Item name="medicalNotes" label={uiText("Медицинская информация")}>
            <Input.TextArea rows={2} placeholder={uiText("Аллергии, особенности здоровья")} />
          </Form.Item>
          <Form.Item name="notes" label={uiText("Комментарии")}>
            <Input.TextArea rows={2} />
          </Form.Item>

          <Typography.Title level={5}>{uiText("Родители")}</Typography.Title>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="motherName" label={uiText("Имя мамы")}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="motherPhone" label={uiText("Телефон мамы")}>
                <Input prefix={<PhoneOutlined />} placeholder="+992 XX XXX XX XX" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="fatherName" label={uiText("Имя папы")}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="fatherPhone" label={uiText("Телефон папы")}>
                <Input prefix={<PhoneOutlined />} placeholder="+992 XX XXX XX XX" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="address" label={uiText("Адрес")}>
            <Input />
          </Form.Item>
          <Form.Item name="extraContact" label={uiText("Доп. контакт")}>
            <Input />
          </Form.Item>
          {showFees && (
            <Form.Item
              name="monthlyFee"
              label={uiText("Индивидуальная плата (опц.)")}
              tooltip={uiText("Если задано — будет использоваться вместо платы группы/класса")}
            >
              <InputNumber
                min={0}
                step={50}
                style={{ width: '100%' }}
                addonAfter={uiText("сомони")}
                placeholder={uiText("например, 500")}
              />
            </Form.Item>
          )}
        </Form>
      </Drawer>

      <StudentAccountModal student={accountFor} onClose={() => setAccountFor(null)} />
      <ClassLinksModal group={linksOpen ? linksGroup : null} onClose={() => setLinksOpen(false)} />

      <ChildParentsModal
        open={!!parentsModal}
        onClose={() => setParentsModal(null)}
        childId={parentsModal?.id ?? null}
        childName={
          parentsModal
            ? `${parentsModal.firstName} ${parentsModal.lastName}`
            : ''
        }
      />

      <ImportStudentsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        groups={groups}
        isSchool={isSchool}
        onDone={refreshTenantData}
      />
    </div>
  )
}

function pluralizeStudent(n: number, isSchool: boolean): string {
  if (isSchool) {
    if (n === 1) return uiText("ученик")
    if (n >= 2 && n <= 4) return uiText("ученика")
    return uiText("учеников")
  }
  if (n === 1) return uiText("ребёнок")
  if (n >= 2 && n <= 4) return uiText("ребёнка")
  return uiText("детей")
}
