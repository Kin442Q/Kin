import { useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Leaf } from 'lucide-react-native'
import Screen from '../components/Screen'
import Btn from '../components/Btn'
import { colors, radius, font, shadow } from '../theme/colors'
import { useAuthStore } from '../store/authStore'

type Tab = 'admin' | 'teacher'

export default function LoginScreen() {
  const login = useAuthStore((s) => s.login)
  const loading = useAuthStore((s) => s.loading)

  const [tab, setTab] = useState<Tab>('teacher')
  const [emailOrPhone, setEmailOrPhone] = useState('+992 ')
  const [password, setPassword] = useState('')

  const onSubmit = async () => {
    if (!emailOrPhone.trim() || !password) {
      Alert.alert('Заполните поля', 'Введите телефон/email и пароль')
      return
    }
    try {
      const creds =
        tab === 'teacher'
          ? { phone: emailOrPhone.trim(), password }
          : { email: emailOrPhone.trim().toLowerCase(), password }
      await login(creds)
    } catch (e: any) {
      Alert.alert(
        'Ошибка входа',
        e?.response?.data?.message || 'Проверьте логин и пароль',
      )
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {/* Логотип */}
          <View style={styles.logoBlock}>
            <View style={styles.logoIcon}>
              <Leaf size={26} color="#fff" strokeWidth={2.2} />
            </View>
            <View>
              <Text style={styles.logoTitle}>Maktab</Text>
              <Text style={styles.logoSub}>school & kindergarten OS</Text>
            </View>
          </View>

          {/* Hero */}
          <Text style={styles.heroTitle}>
            Управляйте садиком{'\n'}
            как <Text style={{ color: colors.primaryDeep, fontStyle: 'italic' }}>растущим садом</Text>
          </Text>
          <Text style={styles.heroSub}>
            Войдите чтобы продолжить
          </Text>

          {/* Tabs */}
          <View style={styles.tabBar}>
            {(
              [
                ['teacher', '👨‍🏫 Воспитатель'],
                ['admin', '👤 Администратор'],
              ] as const
            ).map(([k, label]) => {
              const active = tab === k
              return (
                <Pressable
                  key={k}
                  onPress={() => {
                    setTab(k)
                    // Для входа учителя сразу подставляем код страны +992
                    setEmailOrPhone(k === 'teacher' ? '+992 ' : '')
                  }}
                  style={[
                    styles.tabBtn,
                    active && styles.tabBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabText,
                      { color: active ? colors.text : colors.muted },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          {/* Form */}
          <Text style={styles.label}>
            {tab === 'teacher' ? 'Номер телефона' : 'Email'}
          </Text>
          <TextInput
            value={emailOrPhone}
            onChangeText={setEmailOrPhone}
            placeholder={
              tab === 'teacher' ? '+992 90 123 45 67' : 'admin@kindergarten.tj'
            }
            keyboardType={tab === 'teacher' ? 'phone-pad' : 'email-address'}
            autoCapitalize="none"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />

          <Text style={[styles.label, { marginTop: 14 }]}>Пароль</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />

          <Btn
            block
            size="lg"
            loading={loading}
            onPress={onSubmit}
            style={{ marginTop: 22 }}
          >
            Войти →
          </Btn>

          <Text style={styles.hint}>
            Учитель входит по номеру телефона.{'\n'}
            Администратор — по email.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 16,
  },
  logoBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 28,
  },
  logoIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.md,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
  },
  logoTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
    lineHeight: 24,
  },
  logoSub: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '500',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 34,
    letterSpacing: -0.6,
  },
  heroSub: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 6,
    marginBottom: 22,
  },
  tabBar: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    marginBottom: 20,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  tabBtnActive: {
    backgroundColor: colors.surface,
    ...shadow.sm,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  label: {
    fontSize: 13,
    color: colors.textMid,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: font.size.base,
    color: colors.text,
    minHeight: 48,
  },
  hint: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 18,
  },
})
