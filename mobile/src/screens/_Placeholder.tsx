import { StyleSheet, Text, View } from 'react-native'
import { Sparkles } from 'lucide-react-native'
import Screen from '../components/Screen'
import { colors } from '../theme/colors'

interface Props {
  title: string
  sub: string
}

export function Placeholder({ title, sub }: Props) {
  return (
    <Screen>
      <View style={styles.box}>
        <View style={styles.iconWrap}>
          <Sparkles size={28} color={colors.primaryDeep} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{sub}</Text>
        <Text style={styles.note}>Экран в следующей итерации</Text>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryGhost,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  sub: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
  note: { fontSize: 11, color: colors.primaryDeep, marginTop: 10, fontWeight: '600' },
})
