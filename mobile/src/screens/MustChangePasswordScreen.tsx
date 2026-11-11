import { uiText } from '../i18n/uiText'
import { ScrollView, Text, View } from 'react-native'
import { LogOut } from 'lucide-react-native'
import Screen from '../components/Screen'
import Btn from '../components/Btn'
import ChangePasswordForm from '../components/ChangePasswordForm'
import { colors } from '../theme/colors'
import { useAuthStore } from '../store/authStore'

import { themedStyles } from '../theme/themedStyles'
/**
 * Человек вошёл по временному паролю от администратора. Пока он не придумает свой,
 * дальше пускать нельзя: временный пароль знает админ.
 */
export default function MustChangePasswordScreen() {
  const logout = useAuthStore((s) => s.logout)

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{uiText("Придумайте свой пароль")}</Text>
        <Text style={styles.sub}>
          {" " + uiText("Вы вошли по временному паролю. Его знает администратор, поэтому его нужно заменить на свой.") + " "}</Text>
        <View style={{ marginTop: 20 }}>
          <ChangePasswordForm submitText={uiText("Сохранить и продолжить")} />
        </View>
        <Btn
          block
          variant="secondary"
          icon={<LogOut size={18} color={colors.danger} />}
          onPress={() => logout()}
          style={{ marginTop: 24 }}
        >
          <Text style={{ color: colors.danger, fontWeight: '700' }}>{uiText("Выйти")}</Text>
        </Btn>
      </ScrollView>
    </Screen>
  )
}

const styles = themedStyles(() => ({
  container: { padding: 24, paddingTop: 32 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
  sub: { fontSize: 14, color: colors.muted, marginTop: 8, lineHeight: 20 },
}))
