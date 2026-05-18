import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import {
  LogOut,
  Settings,
  Shield,
  Bell,
  Baby,
  Receipt,
  CalendarHeart,
  ChevronRight,
} from 'lucide-react-native'
import Screen from '../components/Screen'
import Card from '../components/Card'
import Btn from '../components/Btn'
import Avatar from '../components/Avatar'
import { colors, radius } from '../theme/colors'
import { useAuthStore } from '../store/authStore'
import { useLabels } from '../theme/useLabels'
import { cap } from '../theme/labels'

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigation = useNavigation<any>()
  const L = useLabels()

  const r = String(user?.role ?? '').toUpperCase()
  const isAdmin = r === 'ADMIN' || r === 'SUPER_ADMIN'

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

        {/* Школьные разделы (оценки/ДЗ) теперь в табах внизу — дублировать не нужно */}

        <Text style={styles.section}>Аккаунт</Text>
        <View style={styles.list}>
          <ListRow
            icon={<Bell size={18} color={colors.blueDeep} />}
            bg={colors.blueSoft}
            title="Уведомления"
          />
          <ListRow
            icon={<Shield size={18} color={colors.primaryDeep} />}
            bg={colors.primaryGhost}
            title="Безопасность"
          />
          <ListRow
            icon={<Settings size={18} color={colors.muted} />}
            bg={colors.surfaceAlt}
            title="Настройки"
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
})
