import { useEffect, useState } from 'react'
import { App as AntdApp, Button, Modal, Spin, Switch, Tag, Typography } from 'antd'
import { http } from '../api'

const { Text } = Typography

interface FeatureView {
  key: string
  label: string
  description: string
  group: string
  /** Раздел существует для типа этого учреждения (меню питания — только для садика). */
  applicable: boolean
  defaultEnabled: boolean
  enabled: boolean
  /** Владелец явно переопределил значение по умолчанию. */
  overridden: boolean
}

const GROUP_ORDER = ['composition', 'studying', 'finance', 'hr', 'communication']
const GROUP_TITLES: Record<string, string> = {
  composition: 'Состав',
  studying: 'Учебный процесс',
  finance: 'Финансы',
  hr: 'Персонал',
  communication: 'Общение',
}

interface Props {
  school: { id: string; name: string } | null
  onClose: () => void
}

/**
 * Разделы учреждения (только владелец платформы). Каждый переключатель
 * применяется сразу: бэкенд обновляет раздел, а у пользователей учреждения
 * меню обновится при следующей загрузке приложения.
 */
export default function FeaturesModal({ school, onClose }: Props) {
  const { message } = AntdApp.useApp()
  const [items, setItems] = useState<FeatureView[]>([])
  const [loading, setLoading] = useState(false)
  const [pendingKey, setPendingKey] = useState<string | null>(null)

  useEffect(() => {
    if (!school) return
    let cancelled = false
    setItems([])
    setLoading(true)
    http
      .get<FeatureView[]>(`/v1/kindergartens/${school.id}/features`)
      .then((r) => {
        if (!cancelled) setItems(r.data)
      })
      .catch((e) => {
        message.error(e?.response?.data?.message || 'Не удалось загрузить разделы')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [school, message])

  /** value: true/false — явно задать, null — вернуть значение по умолчанию. */
  const apply = async (key: string, value: boolean | null) => {
    if (!school) return
    setPendingKey(key)
    try {
      const r = await http.put<FeatureView[]>(`/v1/kindergartens/${school.id}/features`, {
        features: { [key]: value },
      })
      setItems(r.data)
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Не удалось изменить раздел')
    } finally {
      setPendingKey(null)
    }
  }

  return (
    <Modal
      open={!!school}
      onCancel={onClose}
      title={school ? `Разделы: ${school.name}` : 'Разделы'}
      footer={<Button onClick={onClose}>Закрыть</Button>}
      width={620}
      destroyOnClose
    >
      {loading && (
        <div style={{ textAlign: 'center', padding: 32 }}>
          <Spin />
        </div>
      )}

      {GROUP_ORDER.map((group) => {
        const rows = items.filter((f) => f.group === group)
        if (rows.length === 0) return null
        return (
          <div key={group} style={{ marginBottom: 18 }}>
            <Text strong style={{ fontSize: 13, textTransform: 'uppercase', opacity: 0.6 }}>
              {GROUP_TITLES[group] ?? group}
            </Text>
            {rows.map((f) => (
              <div
                key={f.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 0',
                  borderBottom: '1px solid rgba(0,0,0,0.06)',
                  opacity: f.applicable ? 1 : 0.5,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500 }}>
                    {f.label}{' '}
                    {!f.applicable && <Tag>не для этого типа</Tag>}
                    {f.applicable && f.overridden && <Tag color="blue">изменено</Tag>}
                    {f.applicable && !f.overridden && !f.defaultEnabled && (
                      <Tag>выключено по умолчанию</Tag>
                    )}
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {f.description}
                  </Text>
                </div>
                {f.applicable && f.overridden && (
                  <Button
                    size="small"
                    type="link"
                    disabled={pendingKey === f.key}
                    onClick={() => apply(f.key, null)}
                  >
                    Сбросить
                  </Button>
                )}
                <Switch
                  checked={f.enabled}
                  disabled={!f.applicable}
                  loading={pendingKey === f.key}
                  onChange={(checked) => apply(f.key, checked)}
                  aria-label={f.label}
                />
              </div>
            ))}
          </div>
        )
      })}
    </Modal>
  )
}
