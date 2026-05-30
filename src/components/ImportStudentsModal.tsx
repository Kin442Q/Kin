import { useRef, useState } from 'react'
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
  if (['m', 'м', 'муж', 'male', 'мальчик', 'м.'].includes(s)) return 'MALE'
  if (['f', 'ж', 'жен', 'female', 'девочка', 'ж.'].includes(s)) return 'FEMALE'
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

  const groupLabel = isSchool ? 'класс' : 'группа'

  const resolveGroupId = (groupName?: string): string | undefined => {
    if (!groupName) return undefined
    const g = groups.find(
      (x) => x.name.trim().toLowerCase() === groupName.trim().toLowerCase(),
    )
    return g?.id
  }

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
        message.warning('Файл пустой')
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
      message.success(`Распознано строк: ${parsed.length}`)
    } catch (e: any) {
      message.error('Не удалось прочитать файл: ' + (e?.message || e))
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
        message.success(`AI распознал: ${parsed.length}`)
      } catch (e: any) {
        message.error(e?.response?.data?.message || 'Не удалось распознать фото')
      } finally {
        setScanning(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Фамилия', 'Имя', 'Отчество', 'Дата рождения', 'Пол', isSchool ? 'Класс' : 'Группа', 'Телефон мамы', 'Телефон папы'],
      ['Каримова', 'Айша', 'Ивановна', '2020-05-01', 'Ж', groups[0]?.name ?? '', '+992900112233', ''],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Ученики')
    XLSX.writeFile(wb, 'shablon_ucheniki.xlsx')
  }

  const submit = async () => {
    if (drafts.length === 0) {
      message.warning('Нет строк для создания')
      return
    }
    setCreating(true)
    try {
      const items = drafts.map((d) => ({
        lastName: d.lastName,
        firstName: d.firstName,
        middleName: d.middleName || undefined,
        birthDate: d.birthDate,
        gender: d.gender || 'MALE',
        groupId: d.groupId ?? defaultGroupId,
        motherPhone: d.motherPhone || undefined,
        fatherPhone: d.fatherPhone || undefined,
      }))
      const r = await http.post<{
        createdCount: number
        errorCount: number
        errors: Array<{ row: number; name: string; message: string }>
      }>('/v1/students/bulk', { items })

      const { createdCount, errorCount, errors } = r.data
      if (createdCount > 0) message.success(`Создано: ${createdCount}`)
      if (errorCount > 0) {
        message.warning(`С ошибками: ${errorCount} — оставлены в таблице`)
        // оставляем только ошибочные строки для исправления
        const errRows = new Set(errors.map((e) => e.row))
        setDrafts((d) => d.filter((_, i) => errRows.has(i)))
      } else {
        setDrafts([])
        onClose()
      }
      onDone()
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Ошибка импорта')
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
      title="Импорт учеников"
      open={open}
      onCancel={onClose}
      width={1100}
      destroyOnClose
      footer={[
        <Button key="c" onClick={onClose}>
          Закрыть
        </Button>,
        <Button
          key="s"
          type="primary"
          loading={creating}
          disabled={drafts.length === 0}
          onClick={submit}
        >
          Создать всех ({drafts.length})
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
          <Button icon={<FileExcelOutlined />}>Загрузить Excel/CSV</Button>
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
            Фото списка (AI)
          </Button>
        </Upload>

        <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>
          Шаблон Excel
        </Button>

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
          + Пустая строка
        </Button>
      </Space>

      <div style={{ marginBottom: 12 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {groupLabel[0].toUpperCase() + groupLabel.slice(1)} по умолчанию (если
          в строке не указан/не распознан):{' '}
        </Text>
        <Select
          size="small"
          allowClear
          style={{ minWidth: 200 }}
          placeholder={`Выберите ${groupLabel}`}
          value={defaultGroupId}
          onChange={setDefaultGroupId}
          options={groups.map((g) => ({ value: g.id, label: g.name }))}
        />
      </div>

      {drafts.length === 0 ? (
        <Alert
          type="info"
          showIcon
          icon={<InboxOutlined />}
          message="Загрузите Excel/CSV или сфотографируйте список — строки появятся здесь для проверки перед созданием."
        />
      ) : (
        <Table<Draft>
          size="small"
          rowKey="key"
          dataSource={drafts}
          pagination={false}
          scroll={{ y: 360, x: 980 }}
          columns={[
            { title: 'Фамилия', width: 130, render: (_, r) => cell(r.key, 'lastName') },
            { title: 'Имя', width: 120, render: (_, r) => cell(r.key, 'firstName') },
            { title: 'Отчество', width: 120, render: (_, r) => cell(r.key, 'middleName') },
            {
              title: 'Дата рожд.',
              width: 140,
              render: (_, r) => (
                <DatePicker
                  size="small"
                  style={{ width: '100%' }}
                  format="DD.MM.YYYY"
                  placeholder="дата"
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
              title: 'Пол',
              width: 80,
              render: (_, r) => (
                <Select
                  size="small"
                  style={{ width: '100%' }}
                  value={r.gender || undefined}
                  onChange={(v) => update(r.key, { gender: v })}
                  options={[
                    { value: 'MALE', label: 'М' },
                    { value: 'FEMALE', label: 'Ж' },
                  ]}
                />
              ),
            },
            {
              title: isSchool ? 'Класс' : 'Группа',
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
                          label: `${defGroup?.name ?? ''} (по умолч.)`,
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
            { title: 'Тел. мамы', width: 140, render: (_, r) => cell(r.key, 'motherPhone') },
            { title: 'Тел. папы', width: 140, render: (_, r) => cell(r.key, 'fatherPhone') },
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
        Проверьте данные перед созданием. Строки с ошибками после импорта
        останутся в таблице для исправления.
      </div>
    </Modal>
  )
}
