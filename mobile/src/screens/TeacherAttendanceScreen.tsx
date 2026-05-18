import { StyleSheet, Text, View } from 'react-native'
import Screen from '../components/Screen'
import { colors } from '../theme/colors'

export default function TeacherAttendanceScreen() {
  return (
    <Screen>
      <View style={styles.box}>
        <Text style={styles.title}>Посещаемость</Text>
        <Text style={styles.sub}>Экран в разработке — здесь будет список детей группы со свайпами «здесь / нет / болеет»</Text>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  box: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 8 },
  sub: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 },
})
