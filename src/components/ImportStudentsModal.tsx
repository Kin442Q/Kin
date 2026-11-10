import { uiLanguage, uiText } from '../i18n/uiText'
import { useMemo, useRef, useState } from 'react'
import {
  App as AntdApp,
  Button,
  DatePicker,
  Modal,
  Select,
  Space,
  Table,
  Input,
  Typography,
  Upload,
  Alert,
} from 'antd'
import dayjs from 'dayjs'
import {
  FileExcelOutlined,
  CameraOutlined,
  DownloadOutlined,
  DeleteOutlined,
  InboxOutlined,
} from '@ant-design/icons'
import * as XLSX from 'xlsx'

import { http } from '../api'
import { SP } from './sprout'
import type { Group } from '../types'
import { classKey, compactClassName, findClassByName } from '../lib/classes'

/** Цвета для классов, которые создаются автоматически при импорте. */
const AUTO_CLASS_COLORS = ['#0D7A7C', '#3B8FBF', '#FFB020', '#8B7BD4', '#FF8A65', '#D9709B', '#1BA6A0', '#075B5D']

const { Text } = Typography

interface Draft {
  key: string
  lastName: string
  firstName: string
  middleName: string
  birthDate: string
  gender: 'MALE' | 'FEMALE' | ''
  groupId?: string
  groupName?: string
  motherPhone: string
  fatherPhone: string
}

interface Props {
  open: boolean
  onClose: () => void
  groups: Group[]
  isSchool: boolean
  onDone: () => void
}

let seq = 0
const newKey = () => `d${Date.now()}_${seq++}`

const HEADER_MAP: Record<string, keyof Draft | 'monthlyFee'> = {
  фамилия: 'lastName',
  'last name': 'lastName',
  насаб: 'lastName',
  'first name': 'firstName',
  ном: 'firstName',
  patronymic: 'middleName',
  'номи падар': 'middleName',
  'date of birth': 'birthDate',
  'санаи таваллуд': 'birthDate',
  ҷинс: 'gender',
  синф: 'groupName',
  гурӯҳ: 'groupName',
  'mother’s phone': 'motherPhone',
  'father’s phone': 'fatherPhone',
  'телефони модар': 'motherPhone',
  'телефони падар': 'fatherPhone',
  имя: 'firstName',
  отчество: 'middleName',
  'дата рождения': 'birthDate',
  'дата рожд': 'birthDate',
  др: 'birthDate',
  birthdate: 'birthDate',
  пол: 'gender',
  gender: 'gender',
  группа: 'groupName',
  класс: 'groupName',
  group: 'groupName',
  class: 'groupName',
  'телефон мамы': 'motherPhone',
  'тел мамы': 'motherPhone',
  'телефон папы': 'fatherPhone',
  'тел папы': 'fatherPhone',
}

function normGender(v: unknown): 'MALE' | 'FEMALE' | '' {
  const s = String(v ?? '').trim().toLowerCase()
  if (['m', 'м', 'муж', 'male', 'писар', 'п', 'мальчик', 'м.'].includes(s)) return 'MALE'
  if (['f', 'ж', 'жен', 'female', 'духтар', 'д', 'девочка', 'ж.'].includes(s)) return 'FEMALE'
  return ''
}

function toDateStr(v: unknown): string {
  if (v == null || v === '') return ''
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10)
  }
  const s = String(v).trim()
  // ДД.ММ.ГГГГ → ГГГГ-ММ-ДД
  const m = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return s
}

export default function ImportStudentsModal({
  open,
  onClose,
  groups,
  isSchool,
  onDone,
}: Props) {
  const { message } = AntdApp.useApp()
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [scanning, setScanning] = useState(false)
  const [creating, setCreating] = useState(false)
  const [defaultGroupId, setDefaultGroupId] = useState<string | undefined>()
  const fileRef = useRef<HTMLInputElement>(null)

  const groupLabel = uiText("класс")

  const resolveGroupId = (groupName?: string): string | undefined => {
    return findClassByName(groups, groupName)?.id
  }

  // Классы из файла, которых ещё нет в школе: создадутся при импорте сами.
  const missingClasses = useMemo(() => {
    const seen = new Map<string, string>()
    for (const d of drafts) {
      if (!d.groupId && d.groupName?.trim()) {
        const k = classKey(d.groupName)
        if (!seen.has(k)) seen.set(k, compactClassName(d.groupName))
      }
    }
    return Array.from(seen.values())
  }, [drafts, uiLanguage()])

  const update = (key: string, patch: Partial<Draft>) =>
    setDrafts((d) => d.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const removeRow = (key: string) =>
    setDrafts((d) => d.filter((r) => r.key !== key))

  // ─── Excel / CSV ───────────────────────────────────────────────────
  const parseExcel = async (file: File) => {
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { cellDates: true })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: '',
      })
      if (rows.length === 0) {
        message.warning(uiText("Файл пустой"))
        return
      }
      const parsed: Draft[] = rows.map((row) => {
        const d: Draft = {
          key: newKey(),
          lastName: '',
          firstName: '',
          middleName: '',
          birthDate: '',
          gender: '',
          motherPhone: '',
          fatherPhone: '',
        }
        for (const [rawKey, val] of Object.entries(row)) {
          const field = HEADER_MAP[rawKey.trim().toLowerCase()]
          if (!field || field === 'monthlyFee') continue
          if (field === 'gender') d.gender = normGender(val)
          else if (field === 'birthDate') d.birthDate = toDateStr(val)
          else (d as any)[field] = String(val ?? '').trim()
        }
        d.groupId = resolveGroupId(d.groupName)
        return d
      })
      setDrafts((prev) => [...prev, ...parsed])
      message.success(uiText("Распознано строк: {0}", parsed.length))
    } catch (e: any) {
      message.error(uiText("Не удалось прочитать файл:") + (e?.message || e))
    }
  }

  // ─── Фото (AI) ──────────────────────────────────────────────────────
  const scanPhoto = (file: File) => {
    const reader = new FileReader()
    reader.onload = async () => {
      setScanning(true)
      try {
        const r = await http.post<{ items: any[] }>('/v1/students/scan', {
          image: reader.result,
        })
        const items = r.data.items ?? []
        const parsed: Draft[] = items.map((it) => ({
          key: newKey(),
          lastName: it.lastName ?? '',
          firstName: it.firstName ?? '',
          middleName: it.middleName ?? '',
          birthDate: toDateStr(it.birthDate),
          gender: normGender(it.gender),
          groupName: it.groupName ?? '',
          groupId: resolveGroupId(it.groupName),
          motherPhone: it.motherPhone ?? '',
          fatherPhone: it.fatherPhone ?? '',
        }))
        setDrafts((prev) => [...prev, ...parsed])
        message.success(uiText("AI распознал: {0}", parsed.length))
      } catch (e: any) {
        message.error(e?.response?.data?.message || uiText("Не удалось распознать фото"))
      } finally {
        setScanning(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      [uiText("Фамилия"), uiText("Имя"), uiText("Отчество"), uiText("Дата рождения"), uiText("Пол"), uiText("Класс"), uiText("Телефон мамы"), uiText("Телефон папы")],
      [uiText("Каримова"), uiText("Айша"), uiText("Ивановна"), '2020-05-01', uiText("Ж"), groups[0]?.name ?? '', '+992900112233', ''],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, uiText("Ученики"))
    XLSX.writeFile(wb, 'shablon_ucheniki.xlsx')
  }

  const submit = async () => {
    if (drafts.length === 0) {
      message.warning(uiText("Нет строк для создания"))
      return
    }
    setCreating(true)
    try {
      // Сначала создаём недостающие классы, чтобы ученики попали в свои классы
      const needed = new Map<string, string>()
      for (const d of drafts) {
        if (!d.groupId && d.groupName?.trim()) {
          const k = classKey(d.groupName)
          if (!needed.has(k)) needed.set(k, compactClassName(d.groupName))
        }
      }
      const createdIds = new Map<string, string>()
      let colorIdx = groups.length
      for (const [k, name] of needed) {
        try {
          const res = await http.post<{ id: string }>('/v1/groups', {
            name,
            color: AUTO_CLASS_COLORS[colorIdx % AUTO_CLASS_COLORS.length],
          })
          createdIds.set(k, res.data.id)
          colorIdx++
        } catch (e: any) {
          throw new Error(
            uiText("Не удалось создать класс «{0}»: {1}", name, e?.response?.data?.message || e?.message || uiText("ошибка")),
          )
        }
      }
      const classIdOf = (d: Draft) =>
        d.groupId ?? (d.groupName?.trim() ? createdIds.get(classKey(d.groupName)) : undefined)

      const items = drafts.map((d) => ({
        lastName: d.lastName,
        firstName: d.firstName,
        middleName: d.middleName || undefined,
        birthDate: d.birthDate,
        gender: d.gender || 'MALE',
        groupId: classIdOf(d) ?? defaultGroupId,
        motherPhone: d.motherPhone || undefined,
        fatherPhone: d.fatherPhone || undefined,
      }))
      const r = await http.post<{
        createdCount: number
        errorCount: number
        errors: Array<{ row: number; name: string; message: string }>
      }>('/v1/students/bulk', { items })

      const { createdCount, errorCount, errors } = r.data
      if (createdCount > 0) message.success(uiText("Создано: {0}", createdCount))
      if (errorCount > 0) {
        message.warning(uiText("С ошибками: {0} — оставлены в таблице", errorCount))
        // оставляем только ошибочные строки для исправления
        const errRows = new Set(errors.map((e) => e.row))
        // Созданные классы запоминаем в строках, чтобы повторная отправка не создала их заново
        setDrafts((d) =>
          d.filter((_, i) => errRows.has(i)).map((r) => ({ ...r, groupId: classIdOf(r) ?? r.groupId })),
        )
      } else {
        setDrafts([])
        onClose()
      }
      onDone()
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || uiText("Ошибка импорта"))
    } finally {
      setCreating(false)
    }
  }

  const cell = (key: string, field: keyof Draft, placeholder?: string) => (
    <Input
      size="small"
      value={(drafts.find((d) => d.key === key)?.[field] as string) ?? ''}
      placeholder={placeholder}
      onChange={(e) => update(key, { [field]: e.target.value } as Partial<Draft>)}
    />
  )

  return (
    <Modal
      title={uiText("Импорт учеников")}
      open={open}
      onCancel={onClose}
      width={1100}
      destroyOnClose
      footer={[
        <Button key="c" onClick={onClose}>
          {" " + uiText("Закрыть") + " "}</Button>,
        <Button
          key="s"
          type="primary"
          loading={creating}
          disabled={drafts.length === 0}
          onClick={submit}
        >
          {" " + uiText("Создать всех (")}{drafts.length})
        </Button>,
      ]}
    >
      <Space wrap style={{ marginBottom: 12 }}>
        <Upload
          accept=".xlsx,.xls,.csv"
          showUploadList={false}
          beforeUpload={(f) => {
            parseExcel(f)
            return false
          }}
        >
          <Button icon={<FileExcelOutlined />}>{uiText("Загрузить Excel/CSV")}</Button>
        </Upload>

        <Upload
          accept="image/*"
          showUploadList={false}
          beforeUpload={(f) => {
            scanPhoto(f)
            return false
          }}
        >
          <Button icon={<CameraOutlined />} loading={scanning}>
            {" " + uiText("Фото списка (AI)") + " "}</Button>
        </Upload>

        <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>
          {" " + uiText("Шаблон Excel") + " "}</Button>

        <Button
          onClick={() =>
            setDrafts((d) => [
              ...d,
              {
                key: newKey(),
                lastName: '',
                firstName: '',
                middleName: '',
                birthDate: '',
                gender: '',
                motherPhone: '',
                fatherPhone: '',
              },
            ])
          }
        >
          {" " + uiText("+ Пустая строка") + " "}</Button>
      </Space>

      <div style={{ marginBottom: 12 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {groupLabel[0].toUpperCase() + groupLabel.slice(1)} {" " + uiText("по умолчанию (если в строке не указан/не распознан):")}{' '}
        </Text>
        <Select
          size="small"
          allowClear
          style={{ minWidth: 200 }}
          placeholder={uiText("Выберите {0}", groupLabel)}
          value={defaultGroupId}
          onChange={setDefaultGroupId}
          options={groups.map((g) => ({ value: g.id, label: g.name }))}
        />
      </div>

      {drafts.length > 0 && missingClasses.length > 0 && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message={uiText("Новые классы: {0}", missingClasses.join(', '))}
          description={uiText("Этих классов ещё нет в школе. При создании учеников они появятся автоматически, и каждый ученик попадёт в свой класс.")}
        />
      )}

      {drafts.length === 0 ? (
        <Alert
          type="info"
          showIcon
          icon={<InboxOutlined />}
          message={uiText("Загрузите Excel/CSV или сфотографируйте список — строки появятся здесь для проверки перед созданием.")}
        />
      ) : (
        <Table<Draft>
          size="small"
          rowKey="key"
          dataSource={drafts}
          pagination={false}
          scroll={{ y: 360, x: 980 }}
          columns={[
            { title: uiText("Фамилия"), width: 130, render: (_, r) => cell(r.key, 'lastName') },
            { title: uiText("Имя"), width: 120, render: (_, r) => cell(r.key, 'firstName') },
            { title: uiText("Отчество"), width: 120, render: (_, r) => cell(r.key, 'middleName') },
            {
              title: uiText("Дата рожд."),
              width: 140,
              render: (_, r) => (
                <DatePicker
                  size="small"
                  style={{ width: '100%' }}
                  format="DD.MM.YYYY"
                  placeholder={uiText("дата")}
                  value={
                    r.birthDate && dayjs(r.birthDate).isValid()
                      ? dayjs(r.birthDate)
                      : null
                  }
                  onChange={(d) =>
                    update(r.key, { birthDate: d ? d.format('YYYY-MM-DD') : '' })
                  }
                />
              ),
            },
            {
              title: uiText("Пол"),
              width: 80,
              render: (_, r) => (
                <Select
                  size="small"
                  style={{ width: '100%' }}
                  value={r.gender || undefined}
                  onChange={(v) => update(r.key, { gender: v })}
                  options={[
                    { value: 'MALE', label: uiText("М") },
                    { value: 'FEMALE', label: uiText("Ж") },
                  ]}
                />
              ),
            },
            {
              title: uiText("Класс"),
              width: 160,
              render: (_, r) => {
                // Если задан класс по умолчанию — колонка disabled и показывает
                // дефолт (строки без своей группы попадут в него при создании).
                const defGroup = groups.find((g) => g.id === defaultGroupId)
                if (defaultGroupId && !r.groupId) {
                  return (
                    <Select
                      size="small"
                      style={{ width: '100%' }}
                      disabled
                      value={defaultGroupId}
                      options={[
                        {
                          value: defaultGroupId,
                          label: uiText("{0} (по умолч.)", defGroup?.name ?? ''),
                        },
                      ]}
                    />
                  )
                }
                return (
                  <Select
                    size="small"
                    style={{ width: '100%' }}
                    allowClear
                    status={!r.groupId && !defaultGroupId ? 'warning' : undefined}
                    placeholder={r.groupName || '—'}
                    value={r.groupId}
                    onChange={(v) => update(r.key, { groupId: v })}
                    options={groups.map((g) => ({ value: g.id, label: g.name }))}
                  />
                )
              },
            },
            { title: uiText("Тел. мамы"), width: 140, render: (_, r) => cell(r.key, 'motherPhone') },
            { title: uiText("Тел. папы"), width: 140, render: (_, r) => cell(r.key, 'fatherPhone') },
            {
              title: '',
              width: 40,
              render: (_, r) => (
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removeRow(r.key)}
                />
              ),
            },
          ]}
        />
      )}
      <input ref={fileRef} type="file" hidden />
      <div style={{ marginTop: 8, fontSize: 11, color: SP.muted }}>
        {" " + uiText("Проверьте данные перед созданием. Строки с ошибками после импорта останутся в таблице для исправления.") + " "}</div>
    </Modal>
  )
}
