import { Segmented } from 'antd'
import type { ParentKid } from '../../api/parentApi'

interface Props {
  kids: ParentKid[]
  value: string | null
  onChange: (kidId: string) => void
}

/**
 * Переключатель между детьми родителя.
 * Не показывается, если ребёнок один.
 */
export default function KidSwitcher({ kids, value, onChange }: Props) {
  if (kids.length <= 1) return null
  return (
    <Segmented
      value={value ?? kids[0].id}
      onChange={(v) => onChange(String(v))}
      options={kids.map((k) => ({
        value: k.id,
        label: k.firstName,
      }))}
      style={{ marginBottom: 14 }}
    />
  )
}
