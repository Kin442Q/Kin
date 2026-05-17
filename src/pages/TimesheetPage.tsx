import { useEffect, useMemo, useState } from 'react'
import {
  Avatar,
  Button,
  Col,
  DatePicker,
  Drawer,
  Form,
  Grid,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
  App as AntdApp,
} from 'antd'
import {
  Clock,
  RefreshCw,
  Settings as SettingsIcon,
  Copy,
  KeyRound,
  Pencil,
  Trash2,
  RotateCcw,
  Power,
  Wallet,
  Cpu,
} from 'lucide-react'
import { motion } from 'framer-motion'
import dayjs from 'dayjs'

import {
  SP,
  SproutCard,
  SproutKPI,
  SproutEmpty,
  SproutPageHeader,
} from '../components/sprout'
import {
  timeService,
  terminalService,
  type TimeEntryDto,
  type TerminalSettings,
} from '../api'
import { formatMoneyCompact } from '../lib/format'

const { useBreakpoint } = Grid
const { Text } = Typography

interface TeacherRow {
  teacher: {
    id: string
    fullName: string
    avatarUrl: string | null
    groupId: string | null
    salaryMode: 'HOURLY' | 'FIXED'
    hourlyRate: number | null
    monthlySalaryFixed: number | null
    workNorm: number
  }
  totalMinutes: number
  totalHours: number
  estimatedSalary: number
  entries: TimeEntryDto[]
}

export default function TimesheetPage() {
  const { message } = AntdApp.useApp()
  const screens = useBreakpoint()
  const isMobile = !screens.md

  const [month, setMonth] = useState<string>(dayjs().format('YYYY-MM'))
  const [rows, setRows] = useState<TeacherRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherRow | null>(null)
  const [entryDrawerOpen, setEntryDrawerOpen] = useState(false)
  const [salaryModalOpen, setSalaryModalOpen] = useState(false)
  const [terminalDrawerOpen, setTerminalDrawerOpen] = useState(false)

  const [salaryForm] = Form.useForm()
  const [entryForm] = Form.useForm()
  const [editingEntry, setEditingEntry] = useState<TimeEntryDto | null>(null)

  const reload = async () => {
    try {
      setLoading(true)
      const data = await timeService.allTeachers(month)
      setRows(data)
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Не удалось загрузить')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month])

  // Сводка
  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        totalHours: acc.totalHours + r.totalHours,
        totalSalary: acc.totalSalary + r.estimatedSalary,
        teachers: acc.teachers + 1,
        working: acc.working + r.entries.filter((e) => !e.checkOut).length,
      }),
      { totalHours: 0, totalSalary: 0, teachers: 0, working: 0 },
    )
  }, [rows])

  // ─── Действия ────────────────────────────────────────────────────

  const openTeacherDetail = (row: TeacherRow) => {
    setSelectedTeacher(row)
    setEntryDrawerOpen(true)
  }

  const openSalary = (row: TeacherRow) => {
    setSelectedTeacher(row)
    salaryForm.setFieldsValue({
      salaryMode: row.teacher.salaryMode,
      hourlyRate: row.teacher.hourlyRate,
      monthlySalaryFixed: row.teacher.monthlySalaryFixed,
      workNorm: row.teacher.workNorm,
    })
    setSalaryModalOpen(true)
  }

  const saveSalary = async () => {
    if (!selectedTeacher) return
    try {
      const v = await salaryForm.validateFields()
      await timeService.setTeacherSalary(selectedTeacher.teacher.id, v)
      message.success('Ставка обновлена')
      setSalaryModalOpen(false)
      reload()
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.response?.data?.message || 'Ошибка сохранения')
    }
  }

  const openEditEntry = (entry: TimeEntryDto) => {
    setEditingEntry(entry)
    entryForm.setFieldsValue({
      checkIn: dayjs(entry.checkIn),
      checkOut: entry.checkOut ? dayjs(entry.checkOut) : null,
      note: entry.note,
    })
  }

  const saveEntry = async () => {
    if (!editingEntry) return
    try {
      const v = await entryForm.validateFields()
      await timeService.updateEntry(editingEntry.id, {
        checkIn: v.checkIn?.toISOString(),
        checkOut: v.checkOut ? v.checkOut.toISOString() : null,
        note: v.note,
      })
      message.success('Запись обновлена')
      setEditingEntry(null)
      reload()
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.response?.data?.message || 'Ошибка')
    }
  }

  const deleteEntry = async (entry: TimeEntryDto) => {
    try {
      await timeService.removeEntry(entry.id)
      message.success('Запись удалена')
      reload()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Ошибка')
    }
  }

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <div>
      <SproutPageHeader
        title="Табель и зарплаты"
        icon={<Clock size={22} strokeWidth={2} />}
        iconAccent="lilac"
        description="Учёт рабочих часов, расчёт зарплаты, настройка терминала контроля доступа"
        actions={
          <Space wrap>
            <DatePicker
              picker="month"
              value={dayjs(month + '-01')}
              onChange={(d) => d && setMonth(d.format('YYYY-MM'))}
              allowClear={false}
              format="MMMM YYYY"
            />
            <Button
              icon={<RefreshCw size={14} />}
              onClick={reload}
              loading={loading}
            >
              Обновить
            </Button>
            <Button
              type="primary"
              icon={<Cpu size={14} />}
              onClick={() => setTerminalDrawerOpen(true)}
            >
              Терминал
            </Button>
          </Space>
        }
      />

      {/* KPIs */}
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <SproutKPI
            label="Учителей"
            value={String(totals.teachers)}
            accent="mint"
            icon={<Clock size={18} />}
            hint={`${totals.working} сейчас на работе`}
            delay={0}
          />
        </Col>
        <Col xs={12} md={6}>
          <SproutKPI
            label="Часов в сумме"
            value={`${Math.round(totals.totalHours)}ч`}
            accent="blue"
            icon={<Clock size={18} />}
            hint="за выбранный месяц"
            delay={0.05}
          />
        </Col>
        <Col xs={12} md={6}>
          <SproutKPI
            label="Фонд оплаты труда"
            value={formatMoneyCompact(totals.totalSalary)}
            accent="yellow"
            icon={<Wallet size={18} />}
            hint="за месяц"
            delay={0.1}
          />
        </Col>
        <Col xs={12} md={6}>
          <SproutKPI
            label="Средняя зарплата"
            value={formatMoneyCompact(
              totals.teachers > 0 ? totals.totalSalary / totals.teachers : 0,
            )}
            accent="lilac"
            icon={<Wallet size={18} />}
            hint="на одного учителя"
            delay={0.15}
          />
        </Col>
      </Row>

      {/* Table / Cards */}
      <SproutCard style={{ marginTop: 16 }} delay={0.2}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: SP.text }}>
            Учителя · {dayjs(month + '-01').format('MMMM YYYY')}
          </div>
          <Tag
            style={{
              background: SP.surfaceAlt,
              color: SP.textMid,
              border: 'none',
            }}
          >
            Всего: {rows.length}
          </Tag>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <Spin size="large" />
          </div>
        ) : rows.length === 0 ? (
          <SproutEmpty
            icon={<Clock size={28} strokeWidth={1.8} />}
            title="Учителей пока нет"
            description="Сначала добавьте учителей на странице «Учителя»"
            minHeight={220}
          />
        ) : isMobile ? (
          // Mobile карточки
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {rows.map((r) => (
              <div key={r.teacher.id} className="sp-mcard">
                <div className="sp-mcard-header">
                  <Avatar
                    size={44}
                    style={{
                      background: `linear-gradient(135deg, ${SP.primary}, ${SP.primaryDeep})`,
                      fontWeight: 700,
                    }}
                  >
                    {r.teacher.fullName.slice(0, 1)}
                  </Avatar>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="sp-mcard-title">{r.teacher.fullName}</div>
                    <div className="sp-mcard-sub">
                      {r.teacher.salaryMode === 'HOURLY'
                        ? `${r.teacher.hourlyRate || 0} сом/ч`
                        : 'Фикс. оклад'}
                    </div>
                  </div>
                </div>
                <div className="sp-mcard-row">
                  <span className="label">Часов</span>
                  <span className="value sp-num">
                    {Math.round(r.totalHours)}ч / {r.teacher.workNorm}ч
                  </span>
                </div>
                <div className="sp-mcard-row">
                  <span className="label">К выплате</span>
                  <span className="value sp-num" style={{ color: SP.primaryDeep }}>
                    {formatMoneyCompact(r.estimatedSalary)}
                  </span>
                </div>
                <div className="sp-mcard-actions">
                  <Button size="small" onClick={() => openTeacherDetail(r)}>
                    Записи
                  </Button>
                  <Button
                    size="small"
                    icon={<Pencil size={12} />}
                    onClick={() => openSalary(r)}
                  >
                    Ставка
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Table
            rowKey={(r) => r.teacher.id}
            dataSource={rows}
            pagination={false}
            size="middle"
            columns={[
              {
                title: 'Учитель',
                key: 'teacher',
                render: (_, r) => (
                  <Space>
                    <Avatar
                      style={{
                        background: `linear-gradient(135deg, ${SP.primary}, ${SP.primaryDeep})`,
                        color: 'white',
                        fontWeight: 700,
                      }}
                    >
                      {r.teacher.fullName.slice(0, 1)}
                    </Avatar>
                    <div>
                      <div style={{ fontWeight: 600, color: SP.text }}>
                        {r.teacher.fullName}
                      </div>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {r.teacher.salaryMode === 'HOURLY'
                          ? `${r.teacher.hourlyRate || 0} сом/ч`
                          : `Оклад ${r.teacher.monthlySalaryFixed || 0}`}
                      </Text>
                    </div>
                  </Space>
                ),
              },
              {
                title: 'Часов',
                dataIndex: 'totalHours',
                sorter: (a, b) => a.totalHours - b.totalHours,
                render: (v: number, r) => (
                  <span className="sp-num" style={{ fontWeight: 600 }}>
                    {Math.round(v)}ч{' '}
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      / {r.teacher.workNorm}ч
                    </Text>
                  </span>
                ),
              },
              {
                title: 'Записей',
                key: 'entries',
                render: (_, r) => (
                  <Tag
                    style={{
                      background: SP.blueSoft,
                      color: SP.blueDeep,
                      border: 'none',
                    }}
                  >
                    {r.entries.length}
                  </Tag>
                ),
              },
              {
                title: 'Сейчас работает',
                key: 'working',
                render: (_, r) => {
                  const isWorking = r.entries.some((e) => !e.checkOut)
                  return isWorking ? (
                    <Tag
                      style={{
                        background: SP.primaryGhost,
                        color: SP.primaryDeep,
                        border: 'none',
                      }}
                    >
                      🟢 Да
                    </Tag>
                  ) : (
                    <Tag
                      style={{
                        background: SP.borderSoft,
                        color: SP.muted,
                        border: 'none',
                      }}
                    >
                      ⚪ Нет
                    </Tag>
                  )
                },
              },
              {
                title: 'К выплате',
                dataIndex: 'estimatedSalary',
                sorter: (a, b) => a.estimatedSalary - b.estimatedSalary,
                render: (v: number) => (
                  <span
                    className="sp-num"
                    style={{
                      fontWeight: 700,
                      color: SP.primaryDeep,
                    }}
                  >
                    {formatMoneyCompact(v)}
                  </span>
                ),
              },
              {
                title: '',
                key: 'actions',
                render: (_, r) => (
                  <Space>
                    <Tooltip title="Записи прихода/ухода">
                      <Button
                        size="small"
                        type="text"
                        icon={<Clock size={14} />}
                        onClick={() => openTeacherDetail(r)}
                      />
                    </Tooltip>
                    <Tooltip title="Ставка зарплаты">
                      <Button
                        size="small"
                        type="text"
                        icon={<Wallet size={14} />}
                        onClick={() => openSalary(r)}
                      />
                    </Tooltip>
                  </Space>
                ),
              },
            ]}
          />
        )}
      </SproutCard>

      {/* ─── Drawer: записи конкретного учителя ─── */}
      <Drawer
        title={
          selectedTeacher
            ? `Записи · ${selectedTeacher.teacher.fullName}`
            : 'Записи'
        }
        placement="right"
        open={entryDrawerOpen}
        onClose={() => setEntryDrawerOpen(false)}
        width={isMobile ? '100%' : 640}
      >
        {selectedTeacher && (
          <>
            <div
              style={{
                padding: 12,
                background: SP.primaryGhost,
                borderRadius: 12,
                marginBottom: 14,
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: SP.muted, fontWeight: 600 }}>
                  За месяц
                </div>
                <div
                  className="sp-num"
                  style={{ fontSize: 18, fontWeight: 700, color: SP.text }}
                >
                  {Math.round(selectedTeacher.totalHours)}ч
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: SP.muted, fontWeight: 600 }}>
                  К выплате
                </div>
                <div
                  className="sp-num"
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: SP.primaryDeep,
                  }}
                >
                  {formatMoneyCompact(selectedTeacher.estimatedSalary)}
                </div>
              </div>
            </div>
            {selectedTeacher.entries.length === 0 ? (
              <SproutEmpty
                title="Записей нет"
                description="Учитель ещё не отмечался в этом месяце"
                minHeight={200}
              />
            ) : (
              <Table
                rowKey="id"
                size="small"
                dataSource={selectedTeacher.entries}
                pagination={false}
                columns={[
                  {
                    title: 'Дата',
                    dataIndex: 'date',
                    render: (v: string) => dayjs(v).format('DD.MM'),
                  },
                  {
                    title: 'Приход',
                    dataIndex: 'checkIn',
                    render: (v: string) => dayjs(v).format('HH:mm'),
                  },
                  {
                    title: 'Уход',
                    dataIndex: 'checkOut',
                    render: (v: string | null) =>
                      v ? (
                        dayjs(v).format('HH:mm')
                      ) : (
                        <Tag
                          style={{
                            background: SP.primaryGhost,
                            color: SP.primaryDeep,
                            border: 'none',
                            fontSize: 10,
                          }}
                        >
                          сейчас
                        </Tag>
                      ),
                  },
                  {
                    title: 'Часов',
                    dataIndex: 'minutesWorked',
                    render: (v: number | null) =>
                      v != null
                        ? `${Math.floor(v / 60)}ч ${v % 60}м`
                        : '—',
                  },
                  {
                    title: '',
                    key: 'actions',
                    render: (_, e: TimeEntryDto) => (
                      <Space size={4}>
                        <Button
                          size="small"
                          type="text"
                          icon={<Pencil size={12} />}
                          onClick={() => openEditEntry(e)}
                        />
                        <Popconfirm
                          title="Удалить?"
                          okText="Да"
                          cancelText="Нет"
                          okButtonProps={{ danger: true }}
                          onConfirm={() => deleteEntry(e)}
                        >
                          <Button
                            size="small"
                            type="text"
                            danger
                            icon={<Trash2 size={12} />}
                          />
                        </Popconfirm>
                      </Space>
                    ),
                  },
                ]}
              />
            )}
          </>
        )}
      </Drawer>

      {/* ─── Modal: ставка ─── */}
      <Modal
        title={`Ставка · ${selectedTeacher?.teacher.fullName ?? ''}`}
        open={salaryModalOpen}
        onOk={saveSalary}
        onCancel={() => setSalaryModalOpen(false)}
        okText="Сохранить"
        cancelText="Отмена"
        destroyOnClose
      >
        <Form layout="vertical" form={salaryForm}>
          <Form.Item label="Режим" name="salaryMode">
            <Segmented
              block
              options={[
                { label: 'Почасовая', value: 'HOURLY' },
                { label: 'Фикс. оклад', value: 'FIXED' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Ставка в час" name="hourlyRate">
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              addonAfter="сом/ч"
            />
          </Form.Item>
          <Form.Item label="Фиксированный оклад" name="monthlySalaryFixed">
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              addonAfter="сом/мес"
            />
          </Form.Item>
          <Form.Item label="Норма часов в месяц" name="workNorm">
            <InputNumber
              style={{ width: '100%' }}
              min={1}
              addonAfter="ч"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* ─── Modal: правка записи ─── */}
      <Modal
        title="Коррекция записи"
        open={!!editingEntry}
        onOk={saveEntry}
        onCancel={() => setEditingEntry(null)}
        okText="Сохранить"
        cancelText="Отмена"
        destroyOnClose
      >
        <Form layout="vertical" form={entryForm}>
          <Form.Item label="Приход" name="checkIn" rules={[{ required: true }]}>
            <DatePicker
              showTime={{ format: 'HH:mm' }}
              format="DD.MM.YYYY HH:mm"
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item label="Уход" name="checkOut">
            <DatePicker
              showTime={{ format: 'HH:mm' }}
              format="DD.MM.YYYY HH:mm"
              style={{ width: '100%' }}
              allowClear
            />
          </Form.Item>
          <Form.Item label="Заметка" name="note">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ─── Drawer: терминал ─── */}
      <TerminalDrawer
        open={terminalDrawerOpen}
        onClose={() => setTerminalDrawerOpen(false)}
        teachers={rows}
        onTeacherUpdate={reload}
      />
    </div>
  )
}

// ─── Компонент: Drawer настроек терминала ────────────────────────────

interface TerminalDrawerProps {
  open: boolean
  onClose: () => void
  teachers: TeacherRow[]
  onTeacherUpdate: () => void
}

function TerminalDrawer({
  open,
  onClose,
  teachers,
  onTeacherUpdate,
}: TerminalDrawerProps) {
  const { message } = AntdApp.useApp()
  const screens = useBreakpoint()
  const isMobile = !screens.md

  const [settings, setSettings] = useState<TerminalSettings | null>(null)
  const [loading, setLoading] = useState(false)
  const [teacherCodes, setTeacherCodes] = useState<Record<string, string>>({})

  const load = async () => {
    try {
      setLoading(true)
      const s = await terminalService.getSettings()
      setSettings(s)
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Ошибка')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) load()
  }, [open])

  const regenerate = async () => {
    try {
      const { apiKey } = await terminalService.regenerate()
      message.success('Новый ключ сгенерирован')
      setSettings((s) => (s ? { ...s, apiKey, hasApiKey: true } : s))
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Ошибка')
    }
  }

  const disable = async () => {
    try {
      await terminalService.disable()
      message.success('Терминал отключён')
      setSettings((s) => (s ? { ...s, apiKey: null, hasApiKey: false } : s))
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Ошибка')
    }
  }

  const copyKey = () => {
    if (!settings?.apiKey) return
    navigator.clipboard.writeText(settings.apiKey)
    message.success('Ключ скопирован')
  }

  const saveTeacherCode = async (teacherId: string) => {
    const code = teacherCodes[teacherId]
    try {
      await terminalService.setTeacherCode(teacherId, code || null)
      message.success('Код сохранён')
      onTeacherUpdate()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Ошибка')
    }
  }

  const webhookFullUrl = settings
    ? `${window.location.origin.replace('5173', '4000')}${settings.webhookUrl}`
    : ''

  return (
    <Drawer
      title="Терминал контроля доступа"
      placement="right"
      open={open}
      onClose={onClose}
      width={isMobile ? '100%' : 560}
    >
      {loading || !settings ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Spin />
        </div>
      ) : (
        <>
          {/* API key */}
          <div
            style={{
              padding: 16,
              background: SP.primaryGhost,
              borderRadius: 14,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 10,
              }}
            >
              <KeyRound size={18} color={SP.primaryDeep} />
              <strong style={{ color: SP.text }}>API ключ</strong>
              {settings.hasApiKey && (
                <Tag
                  style={{
                    background: SP.primary,
                    color: 'white',
                    border: 'none',
                    marginLeft: 'auto',
                  }}
                >
                  Активен
                </Tag>
              )}
            </div>

            {settings.apiKey ? (
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  value={settings.apiKey}
                  readOnly
                  style={{ fontFamily: 'monospace', fontSize: 12 }}
                />
                <Button icon={<Copy size={14} />} onClick={copyKey} />
              </Space.Compact>
            ) : (
              <div
                style={{
                  fontSize: 12,
                  color: SP.muted,
                  fontStyle: 'italic',
                }}
              >
                Ключ не сгенерирован. Терминал не сможет отправлять события.
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <Button
                size="small"
                icon={<RotateCcw size={12} />}
                onClick={regenerate}
              >
                {settings.hasApiKey ? 'Перегенерировать' : 'Сгенерировать'}
              </Button>
              {settings.hasApiKey && (
                <Popconfirm
                  title="Отключить терминал?"
                  description="После этого устройство не сможет отправлять события"
                  okText="Да"
                  cancelText="Нет"
                  okButtonProps={{ danger: true }}
                  onConfirm={disable}
                >
                  <Button size="small" danger icon={<Power size={12} />}>
                    Отключить
                  </Button>
                </Popconfirm>
              )}
            </div>
          </div>

          {/* Webhook URL */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: SP.muted,
                marginBottom: 6,
              }}
            >
              Webhook URL (укажите в настройках терминала)
            </div>
            <Input
              value={`https://kin-production-b330.up.railway.app${settings.webhookUrl}`}
              readOnly
              style={{ fontFamily: 'monospace', fontSize: 12 }}
              suffix={
                <Copy
                  size={14}
                  style={{ cursor: 'pointer', color: SP.muted }}
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `https://kin-production-b330.up.railway.app${settings.webhookUrl}`,
                    )
                    message.success('Скопировано')
                  }}
                />
              }
            />
            <div
              style={{
                fontSize: 11,
                color: SP.muted,
                marginTop: 6,
                lineHeight: 1.5,
              }}
            >
              Метод: POST · Header: <code>X-Terminal-Api-Key</code> · Body: <code>{'{ "employeeCode": "T001", "eventType": "auto" }'}</code>
            </div>
            <div style={{ fontSize: 11, color: SP.muted, marginTop: 4 }}>
              Также скрытый URL для localhost: <code>{webhookFullUrl}</code>
            </div>
          </div>

          {/* Коды учителей */}
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: SP.text,
              marginBottom: 10,
            }}
          >
            Коды учителей на терминале
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {teachers.map((t) => (
              <div
                key={t.teacher.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  background: SP.surfaceAlt,
                  borderRadius: 10,
                }}
              >
                <Avatar
                  size={28}
                  style={{
                    background: SP.primary,
                    color: 'white',
                    fontSize: 11,
                  }}
                >
                  {t.teacher.fullName.slice(0, 1)}
                </Avatar>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>
                  {t.teacher.fullName}
                </span>
                <Input
                  size="small"
                  placeholder="T001"
                  defaultValue={
                    (t.teacher as any).terminalCode || ''
                  }
                  style={{ width: 90, fontFamily: 'monospace' }}
                  onChange={(e) =>
                    setTeacherCodes((c) => ({
                      ...c,
                      [t.teacher.id]: e.target.value,
                    }))
                  }
                  onBlur={() => {
                    if (
                      teacherCodes[t.teacher.id] !== undefined &&
                      teacherCodes[t.teacher.id] !==
                        ((t.teacher as any).terminalCode || '')
                    ) {
                      saveTeacherCode(t.teacher.id)
                    }
                  }}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </Drawer>
  )
}

// Suppress unused (Cpu, SettingsIcon, Select used elsewhere conceptually)
void SettingsIcon
void Select
