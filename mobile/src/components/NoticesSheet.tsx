import { Pressable, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { ChevronRight } from 'lucide-react-native'
import dayjs from 'dayjs'

import { uiText } from '../i18n/uiText'
import { Text } from './Text'
import BottomModal from './BottomModal'
import Btn from './Btn'
import PushStatusCard, { pushHasProblem } from './PushStatusCard'
import { SkeletonList } from './Skeleton'
import { colors } from '../theme/colors'
import { themedStyles } from '../theme/themedStyles'
import { useAuthStore } from '../store/authStore'
import { usePushStore } from '../lib/push'
import { noticeTarget } from '../lib/noticeRoute'
import type { NoticeDto } from '../api/notifications'

interface Props {
  visible: boolean
  onClose: () => void
  notices: NoticeDto[]
  loading: boolean
  failed: boolean
  onRetry: () => void
  /** Карточка «Уведомления на этом телефоне» всегда (профиль) или только когда есть проблема (колокольчик) */
  statusCard?: 'always' | 'problem'
}

/**
 * Окно «Оповещения»: список событий (сообщения, отсутствие ребёнка, оценки, ДЗ…), у каждого точка «не прочитано».
 * Строка, у которой есть куда перейти, открывает нужный экран. Пока данные грузятся — заглушка, при ошибке —
 * кнопка «Повторить», а не пустое окно.
 */
export default function NoticesSheet({ visible, onClose, notices, loading, failed, onRetry, statusCard = 'problem' }: Props) {
  const navigation = useNavigation<any>()
  const role = useAuthStore((s) => s.user?.role)
  const pushState = usePushStore((s) => s.state)
  const showStatus = statusCard === 'always' || pushHasProblem(pushState)

  const open = (n: NoticeDto) => {
    const target = noticeTarget(n.payload, role)
    if (!target) return
    onClose()
    navigation.navigate(target.name, target.params)
  }

  return (
    <BottomModal visible={visible} onClose={onClose} title={uiText("Оповещения")}>
      <View style={{ gap: 14 }}>
        {showStatus ? <PushStatusCard /> : null}

        {loading ? (
          <SkeletonList rows={4} />
        ) : failed && notices.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.muted}>{uiText("Не удалось загрузить оповещения")}</Text>
            <Btn size="sm" variant="secondary" onPress={onRetry}>
              {uiText("Повторить")}
            </Btn>
          </View>
        ) : notices.length === 0 ? (
          <Text style={styles.muted}>{uiText("Новых оповещений нет")}</Text>
        ) : (
          notices.map((n) => {
            const target = noticeTarget(n.payload, role)
            return (
              <Pressable
                key={n.id}
                onPress={() => open(n)}
                disabled={!target}
                accessibilityRole={target ? 'button' : undefined}
                style={styles.noticeRow}
              >
                <View style={[styles.dot, { backgroundColor: n.read ? colors.borderSoft : colors.coral }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.noticeTitle, !n.read && { fontWeight: '700' }]}>{n.title}</Text>
                  {n.description ? <Text style={styles.noticeText}>{n.description}</Text> : null}
                  <Text style={styles.noticeTime}>{dayjs(n.createdAt).format('DD.MM HH:mm')}</Text>
                </View>
                {target ? <ChevronRight size={16} color={colors.muted} style={{ marginTop: 4 }} /> : null}
              </Pressable>
            )
          })
        )}
      </View>
    </BottomModal>
  )
}

const styles = themedStyles(() => ({
  center: { alignItems: 'center', gap: 10, paddingVertical: 12 },
  muted: { fontSize: 14, color: colors.textMid, textAlign: 'center' },
  noticeRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  noticeTitle: { fontSize: 14, color: colors.text },
  noticeText: { fontSize: 13, color: colors.textMid, lineHeight: 18 },
  noticeTime: { fontSize: 12, color: colors.muted, marginTop: 2 },
}))
