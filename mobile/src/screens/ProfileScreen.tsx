import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import dayjs from 'dayjs'
import {
  LogOut,
  Settings,
  Shield,
  Bell,
  Baby,
  Receipt,
  CalendarHeart,
  ChevronRight,
  MessageCircle,
} from 'lucide-react-native'
import Constants from 'expo-constants'
import Screen from '../components/Screen'
import Card from '../components/Card'
import Btn from '../components/Btn'
import Avatar from '../components/Avatar'
import BottomModal from '../components/BottomModal'
import { colors, radius } from '../theme/colors'
import { http } from '../api/http'
import { useAuthStore } from '../store/authStore'
import { useLabels } from '../theme/useLabels'
import { cap } from '../theme/labels'

interface NotificationDto {
  id: string
  title: string
  body: string
  createdAt: string
  read: boolean
}

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigation = useNavigation<any>()
  const L = useLabels()

  const r = String(user?.role ?? '').toUpperCase()
  const isAdmin = r === 'ADMIN' || r === 'SUPER_ADMIN'
  const isParent = r === 'PARENT'
  const isTeacher = r === 'TEACHER'

  const [notifModal, setNotifModal] = useState(false)
  const [notifs, setNotifs] = useState<NotificationDto[]>([])
  const [notifLoading, setNotifLoading] = useState(false)

  const openNotifications = async () => {
    setNotifModal(true)
    setNotifLoading(true)
    try {
      const r2 = await http.get<NotificationDto[]>('/v1/notifications')
      setNotifs(r2.data)
      http.post('/v1/notifications/read-all', {}).catch(() => {})
    } catch {
      setNotifs([])
    } finally {
      setNotifLoading(false)
    }
  }

  const openSecurity = () => {
    Alert.alert(
      'Безопасность',
      'Вход защищён паролем. На приходе/уходе используется Face ID / Touch ID вашего телефона — биометрия не покидает устройство.\n\nЧтобы сменить пароль, обратитесь к администратору учреждения.',
    )
  }

  const openSettings = () => {
    const inst = user?.institution
    Alert.alert(
      'Настройки',
      `Учреждение: ${inst?.name ?? '—'}\n` +
        `Тип: ${inst?.type === 'SCHOOL' ? 'Школа' : 'Детский сад'}\n` +
        `Версия приложения: ${Constants.expoConfig?.version ?? '1.0.0'}\n\n` +
        'Push-уведомления включаются при первом входе. Если не приходят — проверьте разрешения в настройках телефона.',
    )
  }

  const onLogout = () => {
    Alert.alert('Выход', 'Точно выйти из системы?', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: () => logout() },
    ])
  }

  const roleLabel =
    r === 'SUPER_ADMIN'
      ? 'Супер-админ'
      : r === 'ADMIN'
        ? 'Администратор'
        : r === 'TEACHER'
          ? cap(L.teacher)
          : cap(L.parent)

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <Card padding={20} style={{ alignItems: 'center' }}>
          <Avatar name={user?.fullName ?? '?'} size={80} />
          <Text style={styles.name}>{user?.fullName}</Text>
          <Text style={styles.role}>{roleLabel}</Text>
          {user?.phone && <Text style={styles.phone}>{user.phone}</Text>}
          {user?.email && <Text style={styles.email}>{user.email}</Text>}
        </Card>

        {isAdmin && (
          <>
            <Text style={styles.section}>Управление</Text>
            <View style={styles.list}>
              <ListRow
                icon={<Baby size={18} color={colors.primaryDeep} />}
                bg={colors.primarySoft}
                title={L.students}
                onPress={() => navigation.navigate('AdminStudents')}
              />
              <ListRow
                icon={<Receipt size={18} color={colors.roseDeep} />}
                bg={colors.roseSoft}
                title="Расходы"
                onPress={() => navigation.navigate('AdminExpenses')}
              />
              <ListRow
                icon={<CalendarHeart size={18} color={colors.lilacDeep} />}
                bg={colors.lilacSoft}
                title="Собрания"
                onPress={() => navigation.navigate('AdminMeetings')}
                last
              />
            </View>
          </>
        )}

        {(isParent || isTeacher) && (
          <>
            <Text style={styles.section}>Общение</Text>
            <View style={styles.list}>
              <ListRow
                icon={<MessageCircle size={18} color={colors.blueDeep} />}
                bg={colors.blueSoft}
                title={isParent ? 'Чат с учителем' : 'Чат с родителями'}
                onPress={() =>
                  navigation.navigate(isParent ? 'ParentChat' : 'TeacherChat')
                }
                last
              />
            </View>
          </>
        )}

        <Text style={styles.section}>Аккаунт</Text>
        <View style={styles.list}>
          <ListRow
            icon={<Bell size={18} color={colors.blueDeep} />}
            bg={colors.blueSoft}
            title="Уведомления"
            onPress={openNotifications}
          />
          <ListRow
            icon={<Shield size={18} color={colors.primaryDeep} />}
            bg={colors.primaryGhost}
            title="Безопасность"
            onPress={openSecurity}
          />
          <ListRow
            icon={<Settings size={18} color={colors.muted} />}
            bg={colors.surfaceAlt}
            title="Настройки"
            onPress={openSettings}
            last
          />
        </View>

        <Btn
          block
          variant="secondary"
          icon={<LogOut size={18} color={colors.danger} />}
          onPress={onLogout}
          style={{ marginTop: 24 }}
        >
          <Text style={{ color: colors.danger, fontWeight: '700' }}>Выйти</Text>
        </Btn>
      </ScrollView>

      <BottomModal
        visible={notifModal}
        onClose={() => setNotifModal(false)}
        title="Уведомления"
      >
        {notifLoading ? (
          <View style={{ paddingVertical: 30, alignItems: 'center' }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : notifs.length === 0 ? (
          <Text style={styles.notifEmpty}>Уведомлений пока нет</Text>
        ) : (
          notifs.map((n) => (
            <View key={n.id} style={styles.notifRow}>
              <View style={styles.notifDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.notifTitle}>{n.title}</Text>
                <Text style={styles.notifBody}>{n.body}</Text>
                <Text style={styles.notifTime}>
                  {dayjs(n.createdAt).format('D MMM, HH:mm')}
                </Text>
              </View>
            </View>
          ))
        )}
      </BottomModal>
    </Screen>
  )
}

function ListRow({
  icon,
  bg,
  title,
  onPress,
  last,
}: {
  icon: React.ReactNode
  bg: string
  title: string
  onPress?: () => void
  last?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        last && { borderBottomWidth: 0 },
        pressed && { backgroundColor: colors.surfaceAlt },
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: bg }]}>{icon}</View>
      <Text style={styles.rowTitle}>{title}</Text>
      {onPress && <ChevronRight size={16} color={colors.muted} />}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12 },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginTop: 12,
    letterSpacing: -0.3,
  },
  role: {
    fontSize: 13,
    color: colors.primaryDeep,
    fontWeight: '600',
    marginTop: 2,
  },
  phone: { fontSize: 13, color: colors.textMid, marginTop: 8 },
  email: { fontSize: 12, color: colors.muted, marginTop: 2 },
  section: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 4,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  list: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  notifEmpty: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: 24,
  },
  notifRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  notifDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  notifTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  notifBody: { fontSize: 13, color: colors.textMid, marginTop: 2, lineHeight: 18 },
  notifTime: { fontSize: 11, color: colors.muted, marginTop: 4 },
})
