import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { Bell } from 'lucide-react-native'

import { uiText } from '../i18n/uiText'
import NoticesSheet from './NoticesSheet'
import { colors } from '../theme/colors'
import { themedStyles } from '../theme/themedStyles'
import { useNotices } from '../lib/useNotices'

/**
 * Колокольчик «Оповещения» для шапки главной (учитель, родитель, ученик, директор): точка при непрочитанных и
 * окно со списком. Список сам обновляется, когда приходит push; при закрытии окна всё помечается прочитанным.
 */
export default function NoticeBell() {
  const { notices, unread, loading, failed, reload, markAllRead } = useNotices()
  const [open, setOpen] = useState(false)

  const close = () => {
    setOpen(false)
    if (unread) markAllRead()
  }

  return (
    <>
      <Pressable
        onPress={() => {
          setOpen(true)
          reload()
        }}
        accessibilityRole="button"
        accessibilityLabel={unread ? uiText("Оповещения: есть непрочитанные") : uiText("Оповещения")}
        style={styles.bell}
      >
        <Bell size={22} color={colors.text} />
        {unread && <View style={styles.dot} />}
      </Pressable>
      <NoticesSheet
        visible={open}
        onClose={close}
        notices={notices}
        loading={loading}
        failed={failed}
        onRetry={reload}
      />
    </>
  )
}

const styles = themedStyles(() => ({
  bell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { position: 'absolute', right: 9, top: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF8A65' },
}))
