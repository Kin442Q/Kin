import { localizeCopy, uiText } from '../i18n/uiText'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  View,
} from 'react-native'
import { ArrowRight, BookOpen, Eye, EyeOff, GraduationCap, Link2, Lock, User, Users } from 'lucide-react-native'
import { Text, TextInput } from '../components/Text'
import Screen from '../components/Screen'
import Logo from '../components/Logo'
import { colors, shadow } from '../theme/colors'
import { useAuthStore } from '../store/authStore'
import { extractStudentToken } from '../lib/studentLink'
import { authApi } from '../api/auth'
import { notifyError } from '../lib/notify'

import { themedStyles } from '../theme/themedStyles'

type Role = 'teacher' | 'parent' | 'student'

const ROLES: { key: Role; label: string; Icon: typeof User }[] = localizeCopy([
  { key: 'teacher', label: 'Учитель', Icon: BookOpen },
  { key: 'parent', label: 'Родитель', Icon: Users },
  { key: 'student', label: 'Ученик', Icon: GraduationCap },
])

/**
 * Вход: заставка-макет «Вход». Сверху знак и название, заголовок «Хуш омадед!», ниже стеклянная карточка с выбором
 * «Учитель · Родитель · Ученик», полями и кнопкой «Войти». Сама роль берётся из аккаунта; вкладка меняет только
 * подпись поля (у ученика — логин) и доступные способы входа.
 */
export default function LoginScreen() {
  const login = useAuthStore((s) => s.login)
  const loginWithLink = useAuthStore((s) => s.loginWithLink)
  const loading = useAuthStore((s) => s.loading)

  const [emailOrPhone, setEmailOrPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [focused, setFocused] = useState<'login' | 'password' | null>(null)
  const [role, setRole] = useState<Role>('parent')
  // Ученик может войти и по личной ссылке от классного руководителя вместо логина и пароля
  const [linkMode, setLinkMode] = useState(false)
  const [linkText, setLinkText] = useState('')
  // «Забыли пароль»: ссылка для нового пароля приходит на почту
  const [forgotMode, setForgotMode] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)

  const onSubmit = async () => {
    if (!emailOrPhone.trim() || !password) {
      Alert.alert(uiText("Заполните поля"), uiText("Введите email, телефон или логин и пароль"))
      return
    }
    try {
      // Вкладка «Ученик» — всегда логин. Иначе: есть «@» — email; только цифры и «+» — телефон; остальное — логин.
      const v = emailOrPhone.trim()
      const creds =
        role === 'student'
          ? { login: v.toLowerCase(), password }
          : v.includes('@')
            ? { email: v.toLowerCase(), password }
            : /^[+\d(][\d\s()-]*$/.test(v)
              ? { phone: v, password }
              : { login: v.toLowerCase(), password }
      await login(creds)
    } catch (e: any) {
      // нет связи — красивая плашка; ответ сервера (неверный пароль) — как раньше
      if (!e?.response) notifyError(e)
      else Alert.alert(uiText("Ошибка входа"), e?.response?.data?.message || uiText("Проверьте логин и пароль"))
    }
  }

  const onSubmitForgot = async () => {
    const v = emailOrPhone.trim()
    if (!v) {
      Alert.alert(uiText("Укажите email"), uiText("Введите email, под которым вы входите, — на него придёт ссылка."))
      return
    }
    try {
      setForgotLoading(true)
      const res = await authApi.forgotPassword(v.includes('@') ? { email: v.toLowerCase() } : { phone: v })
      Alert.alert(uiText("Проверьте почту"), res.message)
      setForgotMode(false)
    } catch (e: any) {
      if (!e?.response) notifyError(e)
      else Alert.alert(uiText("Не получилось"), e?.response?.data?.message || uiText("Не удалось отправить запрос. Попробуйте позже."))
    } finally {
      setForgotLoading(false)
    }
  }

  const onSubmitLink = async () => {
    const token = extractStudentToken(linkText)
    if (!token) {
      Alert.alert(
        uiText("Это не ссылка ученика"),
        uiText("Вставьте ссылку целиком — она начинается с https:// и содержит /s/. Её выдаёт классный руководитель."),
      )
      return
    }
    try {
      await loginWithLink(token)
    } catch (e: any) {
      if (!e?.response) notifyError(e)
      else
        Alert.alert(
          uiText("Не получилось войти"),
          e?.response?.data?.message || uiText("Ссылка не работает. Попросите классного руководителя выдать новую."),
        )
    }
  }

  /** Большая бирюзовая кнопка макета: высота 56, скругление 18, стрелка справа от надписи. */
  const SubmitButton = ({ label, onPress, busy }: { label: string; onPress: () => void; busy: boolean }) => (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      style={({ pressed }) => [styles.submit, shadow.lg, pressed && { opacity: 0.9 }]}
    >
      {busy ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <>
          <Text style={styles.submitText}>{label}</Text>
          <ArrowRight size={20} color="#FFFFFF" strokeWidth={2.2} />
        </>
      )}
    </Pressable>
  )

  const inputRow = (
    icon: React.ReactNode,
    field: 'login' | 'password',
    props: React.ComponentProps<typeof TextInput>,
    right?: React.ReactNode,
  ) => (
    <View style={[styles.inputWrap, focused === field && styles.inputWrapFocus]}>
      <View style={styles.inputIcon}>{icon}</View>
      <TextInput
        {...props}
        placeholderTextColor={colors.muted}
        onFocus={() => setFocused(field)}
        onBlur={() => setFocused(null)}
        style={styles.input}
      />
      {right}
    </View>
  )

  return (
    <Screen variant="scenic">
      {/* На обеих платформах «padding»: при сквозном режиме Android (edge-to-edge) окно само не сжимается */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.logoBlock}>
            <Logo size={17} />
            <LanguageSwitcher />
          </View>

          <Text style={styles.heroTitle}>{uiText("Добро пожаловать!")}</Text>
          <Text style={styles.heroSub}>{uiText("Один вход для учителей, родителей и учеников")}</Text>

          <View style={styles.card}>
            {forgotMode ? (
              <>
                <Text style={styles.sectionTitle}>{uiText("Забыли пароль")}</Text>
                <Text style={styles.sectionSub}>{uiText("Пришлём ссылку для нового пароля на почту. Если в аккаунте нет email, запрос получит администратор школы.")}</Text>

                <Text style={styles.label}>Email</Text>
                {inputRow(<User size={22} color={colors.primary} />, 'login', {
                  value: emailOrPhone,
                  onChangeText: setEmailOrPhone,
                  placeholder: uiText("email, под которым вы входите"),
                  keyboardType: 'email-address',
                  autoCapitalize: 'none',
                  autoCorrect: false,
                  autoComplete: 'username',
                  textContentType: 'username',
                  onSubmitEditing: onSubmitForgot,
                  returnKeyType: 'send',
                })}

                <SubmitButton label={uiText("Отправить ссылку")} onPress={onSubmitForgot} busy={forgotLoading} />

                <Pressable onPress={() => setForgotMode(false)} accessibilityRole="button">
                  <Text style={styles.link}>{uiText("Вернуться ко входу")}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.roles} accessibilityRole="tablist" accessibilityLabel={uiText("Кто входит")}>
                  {ROLES.map(({ key, label, Icon }) => {
                    const on = role === key
                    return (
                      <Pressable
                        key={key}
                        onPress={() => {
                          setRole(key)
                          setLinkMode(false)
                        }}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: on }}
                        style={[styles.roleBtn, on && styles.roleBtnOn]}
                      >
                        <Icon size={18} color={on ? '#FFFFFF' : colors.muted} />
                        <Text style={[styles.roleText, on && styles.roleTextOn]}>{label}</Text>
                      </Pressable>
                    )
                  })}
                </View>

                {role === 'student' && linkMode ? (
                  <>
                    <Text style={styles.label}>{uiText("Ссылка от классного руководителя")}</Text>
                    {inputRow(<Link2 size={22} color={colors.primary} />, 'login', {
                      value: linkText,
                      onChangeText: setLinkText,
                      placeholder: 'https://…/s/…',
                      keyboardType: 'url',
                      autoCapitalize: 'none',
                      autoCorrect: false,
                      onSubmitEditing: onSubmitLink,
                      returnKeyType: 'go',
                    })}

                    <SubmitButton label={uiText("Войти")} onPress={onSubmitLink} busy={loading} />

                    <Pressable onPress={() => setLinkMode(false)} accessibilityRole="button">
                      <Text style={styles.link}>{uiText("Войти по логину и паролю")}</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <View style={styles.field}>
                      <Text style={styles.label}>{role === 'student' ? uiText("Логин ученика") : uiText("Телефон или email")}</Text>
                      {inputRow(<User size={22} color={colors.primary} />, 'login', {
                        value: emailOrPhone,
                        onChangeText: setEmailOrPhone,
                        placeholder: role === 'student' ? uiText("например, st4k9x2m") : '+992 90 123 45 67',
                        keyboardType: role === 'student' ? 'default' : 'email-address',
                        autoCapitalize: 'none',
                        autoCorrect: false,
                        autoComplete: 'username',
                        textContentType: 'username',
                      })}
                    </View>

                    <View style={styles.field}>
                      <Text style={styles.label}>{uiText("Пароль")}</Text>
                      {inputRow(
                        <Lock size={22} color={colors.primary} />,
                        'password',
                        {
                          value: password,
                          onChangeText: setPassword,
                          placeholder: '••••••••',
                          secureTextEntry: !showPassword,
                          autoCapitalize: 'none',
                          autoCorrect: false,
                          autoComplete: 'current-password',
                          textContentType: 'password',
                          onSubmitEditing: onSubmit,
                          returnKeyType: 'go',
                        },
                        <Pressable
                          onPress={() => setShowPassword((v) => !v)}
                          hitSlop={10}
                          style={styles.eye}
                          accessibilityRole="button"
                          accessibilityLabel={showPassword ? uiText("Скрыть пароль") : uiText("Показать пароль")}
                        >
                          {showPassword ? <EyeOff size={22} color="#7A8C8E" /> : <Eye size={22} color="#7A8C8E" />}
                        </Pressable>,
                      )}
                    </View>

                    <SubmitButton label={uiText("Войти")} onPress={onSubmit} busy={loading} />

                    {role === 'student' ? (
                      <Pressable onPress={() => setLinkMode(true)} accessibilityRole="button">
                        <Text style={styles.link}>{uiText("Войти по личной ссылке")}</Text>
                      </Pressable>
                    ) : (
                      <Pressable onPress={() => setForgotMode(true)} accessibilityRole="button">
                        <Text style={styles.link}>{uiText("Забыли пароль?")}</Text>
                      </Pressable>
                    )}
                  </>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = themedStyles(() => ({
  container: { paddingHorizontal: 16, paddingTop: 22, paddingBottom: 40 },
  logoBlock: { paddingHorizontal: 8, marginBottom: 36 },
  heroTitle: { paddingHorizontal: 8, fontSize: 34, fontWeight: '800', letterSpacing: -1, lineHeight: 37, color: colors.text },
  heroSub: { paddingHorizontal: 8, marginTop: 10, marginBottom: 40, fontSize: 15, fontWeight: '500', lineHeight: 22, color: colors.muted },
  card: {
    padding: 20,
    borderRadius: 30,
    gap: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  roles: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 16, backgroundColor: 'rgba(16,40,42,0.06)' },
  roleBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  roleBtnOn: {
    backgroundColor: '#0D7A7C',
    shadowColor: '#075B5D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  roleText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  roleTextOn: { color: '#FFFFFF', fontWeight: '800' },
  field: { gap: 8 },
  label: { fontSize: 13, fontWeight: '700', color: colors.muted },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(16,40,42,0.1)',
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  inputWrapFocus: { borderColor: '#0D7A7C' },
  inputIcon: { position: 'absolute', left: 14, top: 0, bottom: 0, justifyContent: 'center' },
  input: { flex: 1, fontSize: 16, fontWeight: '600', color: '#10282A', paddingVertical: 16, paddingLeft: 48, paddingRight: 46 },
  eye: { position: 'absolute', right: 8, top: 8, width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  submit: {
    height: 56,
    borderRadius: 18,
    backgroundColor: '#0D7A7C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  link: { textAlign: 'center', fontSize: 14, fontWeight: '700', color: '#0D7A7C', paddingVertical: 4 },
  sectionTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  sectionSub: { fontSize: 14, lineHeight: 20, color: colors.muted, marginTop: -8 },
}))
