import { useState } from 'react'
import { Linking, View } from 'react-native'
import { BellRing, BellOff, CheckCircle2 } from 'lucide-react-native'

import { uiText } from '../i18n/uiText'
import { Text } from './Text'
import Btn from './Btn'
import { colors } from '../theme/colors'
import { themedStyles } from '../theme/themedStyles'
import { notifyError } from '../lib/notify'
import { sendTestPush, setupPush, usePushStore, type PushState } from '../lib/push'

/** Состояние, при котором push на этом телефоне не работают (нужно действие). */
export const pushHasProblem = (s: PushState) =>
  s.kind === 'denied' || s.kind === 'no-fcm' || s.kind === 'error' || (s.kind === 'ready' && !s.serverOk)

function describe(s: PushState): { title: string; hint: string } {
  switch (s.kind) {
    case 'ready':
      return s.serverOk
        ? {
            title: uiText("Push-уведомления включены"),
            hint: uiText("Телефон зарегистрирован: сообщения и отметки придут сразу, даже если приложение закрыто."),
          }
        : {
            title: uiText("Сервер не принял телефон"),
            hint: uiText("Проверьте интернет и нажмите «Проверить уведомления»."),
          }
    case 'denied':
      return {
        title: uiText("Уведомления выключены в телефоне"),
        hint: uiText("Разрешите уведомления для «Мактаби ман» — без этого они не придут."),
      }
    case 'no-fcm':
      return {
        title: uiText("Эта версия приложения не настроена для push"),
        hint: uiText("Нужна обновлённая версия приложения. Сообщите об этом администратору школы."),
      }
    case 'simulator':
      return { title: uiText("Эмулятор"), hint: uiText("На эмуляторе push-уведомления не работают.") }
    case 'error':
      return {
        title: uiText("Не удалось включить уведомления"),
        hint: s.message.slice(0, 160),
      }
    default:
      return { title: uiText("Проверяем уведомления…"), hint: '' }
  }
}

/** Человеческий итог тестового уведомления. */
function testMessage(r: Awaited<ReturnType<typeof sendTestPush>>): { ok: boolean; text: string } {
  if (!r.registered) {
    return {
      ok: false,
      text: uiText("Сервер не знает этот телефон. Закройте приложение, откройте снова и разрешите уведомления."),
    }
  }
  if (r.error) {
    if (r.error.code === 'InvalidCredentials') {
      return {
        ok: false,
        text: uiText("Сервер не смог отправить: у приложения нет ключа Firebase (FCM). Нужна новая сборка."),
      }
    }
    if (r.error.code === 'DeviceNotRegistered') {
      return { ok: false, text: uiText("Телефон больше не принимает уведомления. Откройте приложение заново.") }
    }
    return { ok: false, text: uiText("Ошибка отправки: {0}", r.error.code) }
  }
  return { ok: true, text: uiText("Тест отправлен: уведомление придёт через несколько секунд.") }
}

/**
 * Карточка «Уведомления на этом телефоне»: показывает, почему push могут не приходить, и позволяет проверить
 * доставку. Без неё причина (нет разрешения, нет ключа Firebase, нет связи с сервером) была невидимой.
 */
export default function PushStatusCard() {
  const state = usePushStore((s) => s.state)
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const { title, hint } = describe(state)
  const problem = pushHasProblem(state)
  const Icon = problem ? BellOff : state.kind === 'ready' ? CheckCircle2 : BellRing

  const runTest = async () => {
    setTesting(true)
    setResult(null)
    try {
      // Сначала повторно зарегистрируем телефон: вдруг разрешение выдали только что
      await setupPush()
      setResult(testMessage(await sendTestPush()))
    } catch (e) {
      notifyError(e, { fallback: uiText("Не удалось отправить тест") })
    } finally {
      setTesting(false)
    }
  }

  return (
    <View style={[styles.card, problem && styles.cardProblem]}>
      <View style={styles.head}>
        <Icon size={20} color={problem ? colors.danger : colors.primary} />
        <Text style={styles.title}>{title}</Text>
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      {state.kind === 'denied' && (
        <Btn
          size="sm"
          onPress={() => {
            // Если система ещё разрешает спросить — спросим; иначе только через настройки телефона
            if (state.canAskAgain) setupPush().catch(() => {})
            else Linking.openSettings().catch(() => {})
          }}
        >
          {state.canAskAgain ? uiText("Разрешить") : uiText("Открыть настройки")}
        </Btn>
      )}
      {state.kind !== 'no-fcm' && state.kind !== 'simulator' && (
        <Btn size="sm" variant="secondary" loading={testing} onPress={runTest}>
          {uiText("Проверить уведомления")}
        </Btn>
      )}
      {result ? (
        <Text style={[styles.result, { color: result.ok ? colors.primaryDeep : colors.danger }]}>{result.text}</Text>
      ) : null}
    </View>
  )
}

const styles = themedStyles(() => ({
  card: {
    padding: 14,
    borderRadius: 18,
    gap: 10,
    backgroundColor: colors.primaryGhost,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'stretch',
  },
  cardProblem: { backgroundColor: colors.roseSoft },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 14, fontWeight: '800', color: colors.text },
  hint: { fontSize: 13, lineHeight: 18, color: colors.textMid },
  result: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
}))
