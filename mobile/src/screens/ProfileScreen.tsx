import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { LogOut, Settings, Shield, Bell } from 'lucide-react-native'
import Screen from '../components/Screen'
import Card from '../components/Card'
import Btn from '../components/Btn'
import Avatar from '../components/Avatar'
import { colors, radius } from '../theme/colors'
import { useAuthStore } from '../store/authStore'

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const onLogout = () => {
    Alert.alert('Выход', 'Точно выйти из системы?', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: () => logout() },
    ])
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <Card padding={20} style={{ alignItems: 'center' }}>
          <Avatar name={user?.fullName ?? '?'} size={80} />
          <Text style={styles.name}>{user?.fullName}</Text>
          <Text style={styles.role}>
            {user?.role === 'TEACHER' || user?.role === 'teacher'
              ? 'Воспитатель'
              : user?.role === 'SUPER_ADMIN'
                ? 'Супер-админ'
                : 'Администратор'}
          </Text>
          {user?.phone && <Text style={styles.phone}>{user.phone}</Text>}
          {user?.email && <Text style={styles.email}>{user.email}</Text>}
        </Card>

        <View style={styles.list}>
          <ListRow icon={<Bell size={18} color={colors.blueDeep} />} bg={colors.blueSoft} title="Уведомления" />
          <ListRow icon={<Shield size={18} color={colors.primaryDeep} />} bg={colors.primaryGhost} title="Безопасность" />
          <ListRow icon={<Settings size={18} color={colors.muted} />} bg={colors.surfaceAlt} title="Настройки" />
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
}: {
  icon: React.ReactNode
  bg: string
  title: string
}) {
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: bg }]}>{icon}</View>
      <Text style={styles.rowTitle}>{title}</Text>
    </View>
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
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
})
