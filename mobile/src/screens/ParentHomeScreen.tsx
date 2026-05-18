import { ScrollView, StyleSheet, Text, View } from 'react-native'
import Screen from '../components/Screen'
import Card from '../components/Card'
import Avatar from '../components/Avatar'
import { colors, radius } from '../theme/colors'
import { useAuthStore } from '../store/authStore'

export default function ParentHomeScreen() {
  const user = useAuthStore((s) => s.user)
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.greeting}>Доброе утро,</Text>
        <Text style={styles.name}>{user?.fullName}</Text>

        <Card padding={20} style={{ marginTop: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar name="Айша Ахмедова" size={56} />
            <View>
              <Text style={styles.childName}>Айша</Text>
              <Text style={styles.childSub}>Группа «Солнышко»</Text>
            </View>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>🟢 В саду · с 8:15</Text>
          </View>
        </Card>

        <Text style={styles.section}>Сегодня в саду</Text>
        <Card>
          <Text style={styles.itemTitle}>9:00 — Развитие речи</Text>
          <Text style={styles.itemSub}>30 минут · Зарина Аминова</Text>
        </Card>
        <Card style={{ marginTop: 10 }}>
          <Text style={styles.itemTitle}>11:30 — Обед</Text>
          <Text style={styles.itemSub}>Каша гречневая, котлета, компот</Text>
        </Card>

        <Text style={styles.placeholder}>
          Это заглушка — основная разработка экрана в следующей фазе
        </Text>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  greeting: { fontSize: 14, color: colors.muted, fontWeight: '500' },
  name: { fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  childName: { fontSize: 18, fontWeight: '700', color: colors.text },
  childSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  statusBadge: {
    marginTop: 14,
    padding: 10,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  statusText: { color: colors.primaryDeep, fontWeight: '700', fontSize: 13 },
  section: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 24, marginBottom: 10 },
  itemTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  itemSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  placeholder: { fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 24, fontStyle: 'italic' },
})
