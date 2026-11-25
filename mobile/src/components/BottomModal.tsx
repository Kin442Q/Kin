import { ReactNode } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  View,
} from 'react-native'
import { uiText } from '../i18n/uiText'
import { Text } from './Text'
import NoticeHost from './NoticeHost'
import { X } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, radius, shadow } from '../theme/colors'

import { themedStyles } from '../theme/themedStyles'
interface Props {
  visible: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export default function BottomModal({ visible, onClose, title, children }: Props) {
  const insets = useSafeAreaInsets()
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable
          style={styles.backdropFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={uiText("Закрыть")}
        />
        {/* padding и на Android: при edge-to-edge окно само не сжимается, и клавиатура закрывала поля формы */}
        <KeyboardAvoidingView behavior="padding" style={[styles.sheet, shadow.lg]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable
              onPress={onClose}
              hitSlop={14}
              accessibilityRole="button"
              accessibilityLabel={uiText("Закрыть")}
            >
              <X size={20} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.body, { paddingBottom: 24 + insets.bottom }]}
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
        {/* Окно Modal лежит поверх всего приложения: плашка сообщений из корня под ним не видна, поэтому своя */}
        <NoticeHost />
      </View>
    </Modal>
  )
}

const styles = themedStyles(() => ({
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  backdropFill: { flex: 1 },
  sheet: {
    backgroundColor: colors.surfaceSolid,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '88%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  body: { padding: 20, paddingTop: 8, gap: 14, paddingBottom: 32 },
}))
