import { useEffect, useRef } from 'react'
import {
  NavigationContainer,
  DefaultTheme,
  createNavigationContainerRef,
} from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import * as Notifications from 'expo-notifications'
import {
  Home,
  Calendar,
  CreditCard,
  User,
  ClipboardCheck,
  LayoutGrid,
  BarChart3,
  BookOpen,
  GraduationCap,
  Library,
  type LucideIcon,
} from 'lucide-react-native'

import FloatingTabBar from '../components/FloatingTabBar'
import { useAuthStore } from '../store/authStore'
import { hasFeature, type FeatureKey } from '../lib/features'
import { colors } from '../theme/colors'
import { labels } from '../theme/labels'

import LoginScreen from '../screens/LoginScreen'
import TeacherHomeScreen from '../screens/TeacherHomeScreen'
import TeacherAttendanceScreen from '../screens/TeacherAttendanceScreen'
import ParentHomeScreen from '../screens/ParentHomeScreen'
import ParentSchedulePlaceholder from '../screens/ParentSchedulePlaceholder'
import ParentPaymentsPlaceholder from '../screens/ParentPaymentsPlaceholder'
import ProfileScreen from '../screens/ProfileScreen'
import MustChangePasswordScreen from '../screens/MustChangePasswordScreen'
import AdminDashboardScreen from '../screens/AdminDashboardScreen'
import AdminGroupsScreen from '../screens/AdminGroupsScreen'
import AdminPaymentsScreen from '../screens/AdminPaymentsScreen'
import AdminStudentsScreen from '../screens/AdminStudentsScreen'
import AdminExpensesScreen from '../screens/AdminExpensesScreen'
import AdminMeetingsScreen from '../screens/AdminMeetingsScreen'
import TeacherDiaryScreen from '../screens/TeacherDiaryScreen'
import TeacherGradesScreen from '../screens/TeacherGradesScreen'
import TeacherHomeworkScreen from '../screens/TeacherHomeworkScreen'
import ParentGradesScreen from '../screens/ParentGradesScreen'
import ParentChatScreen from '../screens/ParentChatScreen'
import TeacherChatScreen from '../screens/TeacherChatScreen'
import TeacherHomeroomScreen from '../screens/TeacherHomeroomScreen'
import TeacherHomeworkRosterScreen from '../screens/TeacherHomeworkRosterScreen'
import StudentHomeScreen from '../screens/StudentHomeScreen'
import StudentHomeworkScreen from '../screens/StudentHomeworkScreen'
import StudentGradesScreen from '../screens/StudentGradesScreen'
import StudentLearnScreen from '../screens/StudentLearnScreen'
import StudentLibraryScreen from '../screens/StudentLibraryScreen'
import StudentQuizzesScreen from '../screens/StudentQuizzesScreen'
import StudentQuizPlayScreen from '../screens/StudentQuizPlayScreen'
import StudentExamScreen from '../screens/StudentExamScreen'
import StudentGamesScreen from '../screens/StudentGamesScreen'
import StudentGameScreen from '../screens/StudentGameScreen'

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.surfaceSolid,
    text: colors.text,
    primary: colors.primary,
    border: colors.borderSoft,
  },
}

const AuthStack = createNativeStackNavigator()
function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  )
}

const Tab = createBottomTabNavigator()

interface TabConfig {
  name: string
  label: string
  icon: LucideIcon
  component: React.ComponentType
  /** Раздел платформы: вкладка скрыта, если он выключен для учреждения */
  feature?: FeatureKey
  /** Вкладка видна, если включён хотя бы один из разделов */
  anyFeature?: FeatureKey[]
}

type TabRole = 'admin' | 'teacher' | 'parent' | 'student'

function buildTabs(role: TabRole): TabConfig[] {
  const L = labels()
  if (role === 'student') {
    // Ученик: Главная / ДЗ / Оценки / Учёба / Я (5)
    return [
      { name: 'StudentHome', label: 'Главная', icon: Home, component: StudentHomeScreen },
      { name: 'StudentHomework', label: 'ДЗ', icon: BookOpen, component: StudentHomeworkScreen, feature: 'homework' },
      { name: 'StudentGrades', label: 'Оценки', icon: GraduationCap, component: StudentGradesScreen, feature: 'grades' },
      {
        name: 'StudentLearn',
        label: 'Учёба',
        icon: Library,
        component: StudentLearnScreen,
        anyFeature: ['library', 'quiz', 'exam_prep', 'games'],
      },
      { name: 'Profile', label: 'Я', icon: User, component: ProfileScreen },
    ]
  }
  if (role === 'admin') {
    return [
      // «Сводка школы»: ученики, посещаемость, классы, на что обратить внимание.
      // Денежные плитки на ней показываются только при включённой «Аналитике».
      { name: 'AdminDashboard', label: 'Сводка', icon: BarChart3, component: AdminDashboardScreen },
      { name: 'AdminGroups', label: L.groups, icon: LayoutGrid, component: AdminGroupsScreen, feature: 'groups' },
      { name: 'AdminPayments', label: 'Оплаты', icon: CreditCard, component: AdminPaymentsScreen, feature: 'payments' },
      { name: 'Profile', label: 'Я', icon: User, component: ProfileScreen },
    ]
  }
  if (role === 'teacher') {
    // Учитель: Кабинет / Отметить / Журнал / ДЗ / Я (5)
    return [
      { name: 'TeacherHome', label: 'Кабинет', icon: LayoutGrid, component: TeacherHomeScreen },
      { name: 'TeacherAttendance', label: 'Отметить', icon: ClipboardCheck, component: TeacherAttendanceScreen, feature: 'attendance' },
      { name: 'TeacherGrades', label: 'Журнал', icon: GraduationCap, component: TeacherGradesScreen, feature: 'grades' },
      { name: 'TeacherHomework', label: 'ДЗ', icon: BookOpen, component: TeacherHomeworkScreen, feature: 'homework' },
      { name: 'Profile', label: 'Я', icon: User, component: ProfileScreen },
    ]
  }
  // Родитель: Главная / Расписание / Оценки / Оплата / Я (5)
  return [
    { name: 'ParentHome', label: 'Главная', icon: Home, component: ParentHomeScreen },
    { name: 'ParentSchedule', label: 'Расписание', icon: Calendar, component: ParentSchedulePlaceholder, feature: 'schedule' },
    { name: 'ParentGrades', label: 'Оценки', icon: GraduationCap, component: ParentGradesScreen, feature: 'grades' },
    { name: 'ParentPay', label: 'Оплата', icon: CreditCard, component: ParentPaymentsPlaceholder, feature: 'payments' },
    { name: 'Profile', label: 'Я', icon: User, component: ProfileScreen },
  ]
}

function MainTabs() {
  const user = useAuthStore((s) => s.user)
  const r = String(user?.role ?? '').toUpperCase()
  const role: TabRole =
    r === 'SUPER_ADMIN' || r === 'ADMIN'
      ? 'admin'
      : r === 'TEACHER'
        ? 'teacher'
        : r === 'STUDENT'
          ? 'student'
          : 'parent'

  // Вкладки выключенных для учреждения разделов не показываем.
  const tabs = buildTabs(role).filter(
    (t) =>
      (!t.feature || hasFeature(user, t.feature)) &&
      (!t.anyFeature || t.anyFeature.some((f) => hasFeature(user, f))),
  )

  // Иконки вкладок для плавающей панели (по имени маршрута).
  const icons = Object.fromEntries(tabs.map((t) => [t.name, t.icon])) as Record<string, LucideIcon>

  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(p) => <FloatingTabBar {...p} icons={icons} />}
    >
      {tabs.map((t) => (
        <Tab.Screen
          key={t.name}
          name={t.name}
          component={t.component}
          options={{ tabBarLabel: t.label }}
        />
      ))}
    </Tab.Navigator>
  )
}

const RootStack = createNativeStackNavigator()

function MainNavigator() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="Tabs" component={MainTabs} />
      <RootStack.Screen
        name="AdminStudents"
        component={AdminStudentsScreen}
        options={{ presentation: 'card' }}
      />
      <RootStack.Screen
        name="AdminExpenses"
        component={AdminExpensesScreen}
        options={{ presentation: 'card' }}
      />
      <RootStack.Screen
        name="AdminMeetings"
        component={AdminMeetingsScreen}
        options={{ presentation: 'card' }}
      />
      <RootStack.Screen
        name="ParentChat"
        component={ParentChatScreen}
        options={{ presentation: 'card' }}
      />
      <RootStack.Screen
        name="TeacherChat"
        component={TeacherChatScreen}
        options={{ presentation: 'card' }}
      />
      <RootStack.Screen name="TeacherHomeroom" component={TeacherHomeroomScreen} />
      <RootStack.Screen name="TeacherHomeworkRoster" component={TeacherHomeworkRosterScreen} />
      <RootStack.Screen name="StudentLibrary" component={StudentLibraryScreen} />
      <RootStack.Screen name="StudentQuizzes" component={StudentQuizzesScreen} />
      <RootStack.Screen name="StudentQuizPlay" component={StudentQuizPlayScreen} />
      <RootStack.Screen name="StudentExam" component={StudentExamScreen} />
      <RootStack.Screen name="StudentGames" component={StudentGamesScreen} />
      <RootStack.Screen name="StudentGame" component={StudentGameScreen} />
    </RootStack.Navigator>
  )
}

const navRef = createNavigationContainerRef<any>()

/**
 * Куда переходить при тапе по уведомлению — на основе data.kind:
 *   meeting | payment | diary  → главная родителя
 *   homework | grade           → экран Оценки родителя (или Журнал учителя)
 */
function handleNotificationTap(data: unknown, role?: string) {
  if (!navRef.isReady() || !data || typeof data !== 'object') return
  const kind = (data as any).kind
  const r = String(role ?? '').toUpperCase()
  const isParent = r === 'PARENT'
  // Для родителя — главная (диари / оплата / собрание)
  if (
    isParent &&
    (kind === 'diary' || kind === 'payment' || kind === 'meeting')
  ) {
    navRef.navigate('Tabs', { screen: 'ParentHome' })
    return
  }
  // Школьные — оценки/домашка
  if (isParent && (kind === 'grade' || kind === 'homework')) {
    navRef.navigate('Tabs', { screen: 'ParentGrades' })
    return
  }
  // Учитель — журнал/ДЗ
  if (r === 'TEACHER' && kind === 'homework') {
    navRef.navigate('Tabs', { screen: 'TeacherHomework' })
  }
}

export default function RootNavigator() {
  const user = useAuthStore((s) => s.user)
  const responseListener = useRef<Notifications.Subscription | null>(null)

  useEffect(() => {
    // Холодный старт по уведомлению
    Notifications.getLastNotificationResponseAsync()
      .then((resp) => {
        if (resp?.notification.request.content.data) {
          // Дать времени NavigationContainer прогрузиться
          setTimeout(() => {
            handleNotificationTap(
              resp.notification.request.content.data,
              user?.role,
            )
          }, 500)
        }
      })
      .catch(() => {})

    // На лету (тап по баннеру, когда приложение открыто)
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((resp) => {
        handleNotificationTap(
          resp.notification.request.content.data,
          user?.role,
        )
      })
    return () => {
      if (responseListener.current) {
        responseListener.current.remove()
      }
    }
  }, [user?.role])

  return (
    <NavigationContainer theme={navTheme} ref={navRef}>
      {user ? user.mustChangePassword ? <MustChangePasswordScreen /> : <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  )
}
