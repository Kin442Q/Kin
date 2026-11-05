import { useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import { ArrowRight, Eye, EyeOff, Info, Link2, Lock, User } from 'lucide-react-native'
import { Text, TextInput } from '../components/Text'
import Screen from '../components/Screen'
import Btn from '../components/Btn'
import Card from '../components/Card'
import Logo from '../components/Logo'
import { colors, radius, font } from '../theme/colors'
import { useAuthStore } from '../store/authStore'
import { extractStudentToken } from '../lib/studentLink'
import { authApi } from '../api/auth'

export default function LoginScreen() {
  const login = useAuthStore((s) => s.login)
  const loginWithLink = useAuthStore((s) => s.loginWithLink)
  const loading = useAuthStore((s) => s.loading)

  const [emailOrPhone, setEmailOrPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [focused, setFocused] = useState<'login' | 'password' | null>(null)
  // Ученики входят не по паролю, а по личной ссылке от классного руководителя
  const [studentMode, setStudentMode] = useState(false)
  const [linkText, setLinkText] = useState('')
  // «Забыли пароль»: ссылка для нового пароля приходит на почту
  const [forgotMode, setForgotMode] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)

  const onSubmit = async () => {
    if (!emailOrPhone.trim() || !password) {
      Alert.alert('Заполните поля', 'Введите телефон/email и пароль')
      return
    }
    try {
      // Одна форма для всех ролей: роль берётся из аккаунта. Есть «@» — email, иначе телефон.
      const v = emailOrPhone.trim()
      const creds = v.includes('@')
        ? { email: v.toLowerCase(), password }
        : { phone: v, password }
      await login(creds)
    } catch (e: any) {
      Alert.alert(
        'Ошибка входа',
        e?.response?.data?.message || 'Проверьте логин и пароль',
      )
    }
  }

  const onSubmitForgot = async () => {
    const v = emailOrPhone.trim()
    if (!v) {
      Alert.alert('Укажите email', 'Введите email, под которым вы входите, — на него придёт ссылка.')
      return
    }
    try {
      setForgotLoading(true)
      const res = await authApi.forgotPassword(v.includes('@') ? { email: v.toLowerCase() } : { phone: v })
      Alert.alert('Проверьте почту', res.message)
      setForgotMode(false)
    } catch (e: any) {
      Alert.alert('Не получилось', e?.response?.data?.message || 'Не удалось отправить запрос. Попробуйте позже.')
    } finally {
      setForgotLoading(false)
    }
  }

  const onSubmitLink = async () => {
    const token = extractStudentToken(linkText)
    if (!token) {
      Alert.alert(
        'Это не ссылка ученика',
        'Вставьте ссылку целиком — она начинается с https:// и содержит /s/. Её выдаёт классный руководитель.',
      )
      return
    }
    try {
      await loginWithLink(token)
    } catch (e: any) {
      Alert.alert(
        'Не получилось войти',
        e?.response?.data?.message || 'Ссылка не работает. Попросите классного руководителя выдать новую.',
      )
    }
  }

  return (
    <Screen>
      {/* На обеих платформах «padding»: при сквозном режиме Android (edge-to-edge) окно само не сжимается */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoBlock}>
            <Logo size={22} />
          </View>

          <Text style={styles.heroTitle}>
            Хуш омадед!{'\n'}
            <Text style={{ color: colors.primaryDeep }}>Рады видеть вас снова</Text>
          </Text>
          <Text style={styles.heroSub}>
            Один вход для директора, учителей, родителей и учеников — система сама откроет нужный кабинет.
          </Text>

          <Card padding={22} style={styles.card}>
            {forgotMode ? (
              <>
                <Text style={styles.cardTitle}>Забыли пароль</Text>
                <Text style={styles.cardSub}>Пришлём ссылку для нового пароля на почту</Text>

                <Text style={styles.label}>Email</Text>
                <View style={[styles.inputWrap, focused === 'login' && styles.inputWrapFocus]}>
                  <User size={18} color={colors.muted} />
                  <TextInput
                    value={emailOrPhone}
                    onChangeText={setEmailOrPhone}
                    placeholder="email, под которым вы входите"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="username"
                    textContentType="username"
                    placeholderTextColor={colors.muted}
                    onFocus={() => setFocused('login')}
                    onBlur={() => setFocused(null)}
                    onSubmitEditing={onSubmitForgot}
                    returnKeyType="send"
                    style={styles.input}
                  />
                </View>

                <Btn
                  block
                  size="lg"
                  loading={forgotLoading}
                  onPress={onSubmitForgot}
                  icon={<ArrowRight size={18} color="#fff" strokeWidth={2.2} />}
                  style={{ marginTop: 22 }}
                >
                  Отправить ссылку
                </Btn>

                <View style={styles.hint}>
                  <Info size={18} color={colors.roseDeep} />
                  <Text style={styles.hintText}>
                    Ссылка действует ограниченное время и открывается один раз. Если письма нет во «Входящих», загляните в «Спам». Если в аккаунте нет email, запрос получит администратор школы.
                  </Text>
                </View>

                <Pressable onPress={() => setForgotMode(false)} accessibilityRole="button">
                  <Text style={styles.switchLink}>Вернуться ко входу</Text>
                </Pressable>
              </>
            ) : studentMode ? (
              <>
                <Text style={styles.cardTitle}>Вход для ученика</Text>
                <Text style={styles.cardSub}>По личной ссылке от классного руководителя</Text>

                <Text style={styles.label}>Ссылка</Text>
                <View style={[styles.inputWrap, focused === 'login' && styles.inputWrapFocus]}>
                  <Link2 size={18} color={colors.muted} />
                  <TextInput
                    value={linkText}
                    onChangeText={setLinkText}
                    placeholder="https://…/s/…"
                    keyboardType="url"
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholderTextColor={colors.muted}
                    onFocus={() => setFocused('login')}
                    onBlur={() => setFocused(null)}
                    onSubmitEditing={onSubmitLink}
                    returnKeyType="go"
                    style={styles.input}
                  />
                </View>

                <Btn
                  block
                  size="lg"
                  loading={loading}
                  onPress={onSubmitLink}
                  icon={<ArrowRight size={18} color="#fff" strokeWidth={2.2} />}
                  style={{ marginTop: 22 }}
                >
                  Войти
                </Btn>

                <View style={styles.hint}>
                  <Info size={18} color={colors.roseDeep} />
                  <Text style={styles.hintText}>
                    Вставьте личную ссылку, которую выдал классный руководитель. Если ссылка не работает, попросите выдать новую.
                  </Text>
                </View>

                <Pressable onPress={() => setStudentMode(false)} accessibilityRole="button">
                  <Text style={styles.switchLink}>Войти по почте и паролю</Text>
                </Pressable>
              </>
            ) : (
              <>
            <Text style={styles.cardTitle}>Вход в систему</Text>
            <Text style={styles.cardSub}>Директор, учитель или родитель</Text>

            <Text style={styles.label}>Email или телефон</Text>
            <View style={[styles.inputWrap, focused === 'login' && styles.inputWrapFocus]}>
              <User size={18} color={colors.muted} />
              <TextInput
                value={emailOrPhone}
                onChangeText={setEmailOrPhone}
                placeholder="email или +992 90 123 45 67"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                textContentType="username"
                placeholderTextColor={colors.muted}
                onFocus={() => setFocused('login')}
                onBlur={() => setFocused(null)}
                style={styles.input}
              />
            </View>

            <Text style={[styles.label, { marginTop: 14 }]}>Пароль</Text>
            <View style={[styles.inputWrap, focused === 'password' && styles.inputWrapFocus]}>
              <Lock size={18} color={colors.muted} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                placeholderTextColor={colors.muted}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                onSubmitEditing={onSubmit}
                returnKeyType="go"
                style={styles.input}
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={10}
                accessibilityLabel={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showPassword ? (
                  <EyeOff size={20} color={colors.muted} />
                ) : (
                  <Eye size={20} color={colors.muted} />
                )}
              </Pressable>
            </View>

            <Btn
              block
              size="lg"
              loading={loading}
              onPress={onSubmit}
              icon={<ArrowRight size={18} color="#fff" strokeWidth={2.2} />}
              style={{ marginTop: 22 }}
            >
              Войти
            </Btn>

            <View style={styles.hint}>
              <Info size={18} color={colors.roseDeep} />
              <Text style={styles.hintText}>
                Доступ приходит приглашением на вашу почту: откройте письмо, перейдите по ссылке и задайте свой пароль.
              </Text>
            </View>

            <Pressable onPress={() => setForgotMode(true)} accessibilityRole="button">
              <Text style={styles.switchLink}>Забыли пароль?</Text>
            </Pressable>

            <Pressable onPress={() => setStudentMode(true)} accessibilityRole="button">
              <Text style={styles.switchLink}>Я ученик: войти по ссылке</Text>
            </Pressable>
              </>
            )}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 22,
    paddingTop: 20,
    paddingBottom: 40,
  },
  logoBlock: {
    marginBottom: 26,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 38,
    letterSpacing: -0.6,
  },
  heroSub: {
    fontSize: 15,
    color: colors.textMid,
    lineHeight: 22,
    marginTop: 10,
    marginBottom: 22,
  },
  card: {
    borderRadius: radius.xl,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  cardSub: {
    fontSize: 14,
    color: colors.textMid,
    marginTop: 4,
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceSolid,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  inputWrapFocus: {
    borderColor: colors.primary,
  },
  input: {
    flex: 1,
    fontSize: font.size.md,
    color: colors.text,
    paddingVertical: 12,
  },
  switchLink: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryDeep,
    textAlign: 'center',
    marginTop: 22,
    paddingVertical: 8,
  },
  hint: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: colors.roseSoft,
    borderRadius: radius.md,
    padding: 14,
    marginTop: 18,
  },
  hintText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: colors.roseDeep,
  },
})
