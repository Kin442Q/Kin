import { uiText } from '../i18n/uiText'
import { useEffect, useState } from 'react'
import { Alert, Button, Input, Modal, Space, Tag, Typography } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'

import { studentsBulkApi, type BulkDeleteStudentsResult } from '../api/schoolApi'
import { useDataStore } from '../store/dataStore'
import type { Child } from '../types'

const { Text } = Typography

/** Больше стольких учеников стереть можно только введя слово: чтобы случайно не удалить всех. */
export const BULK_DELETE_WORD_THRESHOLD = 5
/** Сколько имён показываем в списке «будут удалены». */
const PREVIEW = 8

const fullName = (c: Child) => `${c.lastName} ${c.firstName}`.trim()

interface Props {
  open: boolean
  /** Выбранные ученики (уже только те, что видны на странице). */
  students: Child[]
  onClose: () => void
  /** Сервер что-то удалил: страница обновляет список и снимает выделение. */
  onDeleted: (result: BulkDeleteStudentsResult) => void
}

/**
 * Подтверждение пакетного удаления учеников. Удаление настоящее и необратимое — то же, что у корзины
 * в строке таблицы: ученик пропадает вместе с оценками, посещаемостью, оплатами и личным входом.
 * Если выбрано больше 5 учеников, кнопка «Удалить навсегда» включается только после ввода слова «УДАЛИТЬ».
 * После ответа сервера окно показывает итог: сколько удалено и что не удалось (с причинами).
 */
export default function BulkDeleteStudentsModal({ open, students, onClose, onDeleted }: Props) {
  const groups = useDataStore((s) => s.groups)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BulkDeleteStudentsResult | null>(null)
  // Список на момент удаления: после обновления страницы удалённые из `students` пропадут,
  // а имена тех, кого не удалось удалить, в итоге ещё нужны.
  const [snapshot, setSnapshot] = useState<Child[]>([])

  useEffect(() => {
    if (!open) return
    setTyped('')
    setBusy(false)
    setError(null)
    setResult(null)
    setSnapshot([])
  }, [open])

  const count = students.length
  const needsWord = count > BULK_DELETE_WORD_THRESHOLD
  const word = uiText("УДАЛИТЬ")
  const wordOk =
    !needsWord || [word, 'УДАЛИТЬ'].some((w) => typed.trim().toLocaleUpperCase() === w.toLocaleUpperCase())

  const confirm = async () => {
    if (busy || count === 0 || !wordOk) return
    setBusy(true)
    setError(null)
    setSnapshot(students)
    try {
      const r = await studentsBulkApi.remove(students.map((c) => c.id))
      setResult(r)
      onDeleted(r)
    } catch (e: any) {
      setError(
        e?.response?.data?.message ||
          uiText("Не удалось выполнить удаление. Обновите список и проверьте, кто остался."),
      )
    } finally {
      setBusy(false)
    }
  }

  const groupOf = (c: Child) => groups.find((g) => g.id === c.groupId)?.name
  const nameById = (id: string) => {
    const c = snapshot.find((x) => x.id === id)
    return c ? fullName(c) : id
  }

  const shown = students.slice(0, PREVIEW)
  return (
    <Modal
      open={open}
      title={result ? uiText("Удаление завершено") : uiText("Удалить учеников: {0}", count)}
      onCancel={busy ? undefined : onClose}
      closable={!busy}
      maskClosable={false}
      keyboard={!busy}
      width={520}
      footer={
        result ? (
          <Button type="primary" onClick={onClose}>
            {uiText("Закрыть")}
          </Button>
        ) : (
          <Space>
            <Button onClick={onClose} disabled={busy}>
              {uiText("Отмена")}
            </Button>
            <Button
              type="primary"
              danger
              icon={<DeleteOutlined />}
              loading={busy}
              disabled={count === 0 || !wordOk}
              onClick={confirm}
            >
              {uiText("Удалить навсегда: {0}", count)}
            </Button>
          </Space>
        )
      }
    >
      {result ? (
        // ── Итог ──
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            type={result.deleted > 0 ? 'success' : 'warning'}
            showIcon
            message={uiText("Удалено: {0}", result.deleted)}
          />
          {result.failed.length > 0 && (
            <div>
              <Alert type="warning" showIcon message={uiText("Не удалось удалить: {0}", result.failed.length)} />
              <ul style={{ margin: '8px 0 0', paddingLeft: 20, maxHeight: 220, overflow: 'auto' }}>
                {result.failed.map((f) => (
                  <li key={f.id}>
                    <Text strong>{nameById(f.id)}</Text>
                    {' — '}
                    <Text type="secondary">{uiText(f.reason)}</Text>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Space>
      ) : (
        // ── Подтверждение ──
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            type="error"
            showIcon
            message={uiText("Удаление необратимо")}
            description={uiText("Ученики будут удалены навсегда вместе с их оценками, посещаемостью, оплатами, заметками и личным входом ученика. Родительские аккаунты останутся, но будут отвязаны от удалённых учеников. Восстановить удалённое нельзя.")}
          />
          <div>
            <Text type="secondary">{uiText("Будут удалены:")}</Text>
            <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
              {shown.map((c) => (
                <li key={c.id}>
                  {fullName(c)} {groupOf(c) && <Tag style={{ marginInlineEnd: 0 }}>{groupOf(c)}</Tag>}
                </li>
              ))}
            </ul>
            {count > shown.length && <Text type="secondary">{uiText("и ещё {0}", count - shown.length)}</Text>}
          </div>
          {needsWord && (
            <div>
              <div style={{ marginBottom: 6 }}>
                {uiText("Чтобы подтвердить, введите слово")} <Text strong code>{word}</Text>
              </div>
              <Input
                autoFocus
                value={typed}
                placeholder={word}
                onChange={(e) => setTyped(e.target.value)}
                onPressEnter={confirm}
                disabled={busy}
                aria-label={uiText("Слово для подтверждения")}
              />
            </div>
          )}
          {error && <Alert type="error" showIcon message={error} />}
        </Space>
      )}
    </Modal>
  )
}
