import { useState } from 'react'
import { Alert, View } from 'react-native'
import Btn from './Btn'
import { Field } from './Field'
import { useAuthStore } from '../store/authStore'

export const MIN_NEW_PASSWORD = 8

/** Проверка полей до запроса: возвращает текст ошибки или null. */
export function validateNewPassword(current: string, next: string, repeat: string): string | null {
  if (!current) return 'Введите текущий пароль'
  if (next.length < MIN_NEW_PASSWORD) return `Новый пароль — минимум ${MIN_NEW_PASSWORD} символов`
  if (next === current) return 'Новый пароль должен отличаться от текущего'
  if (next !== repeat) return 'Пароли не совпадают'
  return null
}

interface Props {
  onDone?: () => void
  submitText?: string
}

/** Смена своего пароля (нужен текущий). Другие устройства выходят, это остаётся в системе. */
export default function ChangePasswordForm({ onDone, submitText = 'Сменить пароль' }: Props) {
  const changePassword = useAuthStore((s) => s.changePassword)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    const problem = validateNewPassword(current, next, repeat)
    if (problem) {
      Alert.alert('Проверьте поля', problem)
      return
    }
    setSaving(true)
    try {
      await changePassword(current, next)
      setCurrent('')
      setNext('')
      setRepeat('')
      Alert.alert('Готово', 'Пароль изменён. На других устройствах нужно войти заново.')
      onDone?.()
    } catch (e: any) {
      Alert.alert('Не удалось сменить пароль', e?.response?.data?.message || 'Попробуйте ещё раз')
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={{ gap: 12 }}>
      <Field label="Текущий пароль" value={current} onChangeText={setCurrent} secureTextEntry autoCapitalize="none" />
      <Field
        label="Новый пароль"
        value={next}
        onChangeText={setNext}
        secureTextEntry
        autoCapitalize="none"
        hint={`Минимум ${MIN_NEW_PASSWORD} символов`}
      />
      <Field label="Повторите новый пароль" value={repeat} onChangeText={setRepeat} secureTextEntry autoCapitalize="none" />
      <Btn block size="lg" loading={saving} onPress={submit} style={{ marginTop: 6 }}>
        {submitText}
      </Btn>
    </View>
  )
}
