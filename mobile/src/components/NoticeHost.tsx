import { uiText } from '../i18n/uiText'
import { useEffect, useRef } from 'react'
import { Animated, Easing, Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CheckCircle2, CircleAlert, Info, WifiOff, X } from 'lucide-react-native'

import { Text } from './Text'
import { colors, radius, shadow } from '../theme/colors'
import { themedStyles } from '../theme/themedStyles'
import { useNoticeStore, type NoticeKind } from '../lib/notify'

const TONES: Record<NoticeKind, () => { bg: string; fg: string; Icon: typeof Info }> = {
  error: () => ({ bg: colors.roseSoft, fg: colors.roseDeep, Icon: CircleAlert }),
  offline: () => ({ bg: colors.yellowSoft, fg: colors.yellowDeep, Icon: WifiOff }),
  success: () => ({ bg: colors.primarySoft, fg: colors.primaryDeep, Icon: CheckCircle2 }),
  info: () => ({ bg: colors.blueSoft, fg: colors.blueDeep, Icon: Info }),
}

/**
 * Плашка сообщений вверху экрана: вместо системного окна «Ошибка — AxiosError: Network Error».
 * Съезжает сверху, сама исчезает, по нажатию закрывается. У ошибок связи может быть кнопка «Повторить».
 */
export default function NoticeHost() {
  const notice = useNoticeStore((s) => s.notice)
  const hide = useNoticeStore((s) => s.hide)
  const insets = useSafeAreaInsets()
  const slide = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!notice) return
    slide.setValue(0)
    Animated.timing(slide, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()
    const t = setTimeout(hide, notice.onAction ? 10000 : 6000)
    return () => clearTimeout(t)
  }, [notice, slide, hide])

  if (!notice) return null
  const tone = TONES[notice.kind]()
  const Icon = tone.Icon

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          top: insets.top + 8,
          opacity: slide,
          transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }],
        },
      ]}
    >
      <Pressable
        onPress={hide}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${notice.title}. ${notice.message ?? ''}`}
        style={styles.card}
      >
        <View style={[styles.icon, { backgroundColor: tone.bg }]}>
          <Icon size={22} color={tone.fg} strokeWidth={2.2} />
        </View>
        <View style={styles.body}>
          <Text style={styles.title}>{notice.title}</Text>
          {!!notice.message && <Text style={styles.message}>{notice.message}</Text>}
          {notice.onAction && (
            <Pressable
              onPress={() => {
                const run = notice.onAction
                hide()
                run?.()
              }}
              accessibilityRole="button"
              style={[styles.action, { backgroundColor: tone.bg }]}
            >
              <Text style={[styles.actionText, { color: tone.fg }]}>{notice.actionLabel ?? uiText("Повторить")}</Text>
            </Pressable>
          )}
        </View>
        <Pressable onPress={hide} hitSlop={10} accessibilityRole="button" accessibilityLabel={uiText("Закрыть")}>
          <X size={18} color={colors.muted} />
        </Pressable>
      </Pressable>
    </Animated.View>
  )
}

const styles = themedStyles(() => ({
  wrap: { position: 'absolute', left: 12, right: 12, zIndex: 1000, elevation: 1000 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: radius.xl - 6,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    ...shadow.md,
  },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '800', color: colors.text },
  message: { fontSize: 13, lineHeight: 18, color: colors.textMid },
  action: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill },
  actionText: { fontSize: 13, fontWeight: '800' },
}))
