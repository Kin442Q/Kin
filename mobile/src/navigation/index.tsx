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
  type LucideIcon,
} from 'lucide-react-native'

import { useAuthStore } from '../store/authStore'
import { colors } from '../theme/colors'
import { labels } from '../theme/labels'

import LoginScreen from '../screens/LoginScreen'
import TeacherHomeScreen from '../screens/TeacherHomeScreen'
import TeacherAttendanceScreen from '../screens/TeacherAttendanceScreen'
import ParentHomeScreen from '../screens/ParentHomeScreen'
import ParentSchedulePlaceholder from '../screens/ParentSchedulePlaceholder'
import ParentPaymentsPlaceholder from '../screens/ParentPaymentsPlaceholder'
import ProfileScreen from '../screens/ProfileScreen'
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

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.surface,
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
}

function buildTabs(
  role: 'admin' | 'teacher' | 'parent',
  type?: 'KINDERGARTEN' | 'SCHOOL' | null,
): TabConfig[] {
  const L = labels(type)
  if (role === 'admin') {
    return [
      { name: 'AdminDashboard', label: 'Сводка', icon: BarChart3, component: AdminDashboardScreen },
      { name: 'AdminGroups', label: L.groups, icon: LayoutGrid, component: AdminGroupsScreen },
      { name: 'AdminPayments', label: 'Оплаты', icon: CreditCard, component: AdminPaymentsScreen },
      { name: 'Profile', label: 'Я', icon: User, component: ProfileScreen },
    ]
  }
  if (role === 'teacher') {
    // Учитель школы: Кабинет / Отметить / Журнал / ДЗ / Я (5)
    if (type === 'SCHOOL') {
      return [
        { name: 'TeacherHome', label: 'Кабинет', icon: LayoutGrid, component: TeacherHomeScreen },
        { name: 'TeacherAttendance', label: 'Отметить', icon: ClipboardCheck, component: TeacherAttendanceScreen },
        { name: 'TeacherGrades', label: 'Журнал', icon: GraduationCap, component: TeacherGradesScreen },
        { name: 'TeacherHomework', label: 'ДЗ', icon: BookOpen, component: TeacherHomeworkScreen },
        { name: 'Profile', label: 'Я', icon: User, component: ProfileScreen },
      ]
    }
    // Воспитатель садика: Группа / Отметить / Дневник / Я (4)
    return [
      { name: 'TeacherHome', label: L.group[0].toUpperCase() + L.group.slice(1), icon: LayoutGrid, component: TeacherHomeScreen },
      { name: 'TeacherAttendance', label: 'Отметить', icon: ClipboardCheck, component: TeacherAttendanceScreen },
      { name: 'TeacherDiary', label: 'Дневник', icon: BookOpen, component: TeacherDiaryScreen },
      { name: 'Profile', label: 'Я', icon: User, component: ProfileScreen },
    ]
  }
  // Родитель школы: Главная / Расписание / Оценки / Оплата / Я (5)
  if (type === 'SCHOOL') {
    return [
      { name: 'ParentHome', label: 'Главная', icon: Home, component: ParentHomeScreen },
      { name: 'ParentSchedule', label: 'Расписание', icon: Calendar, component: ParentSchedulePlaceholder },
      { name: 'ParentGrades', label: 'Оценки', icon: GraduationCap, component: ParentGradesScreen },
      { name: 'ParentPay', label: 'Оплата', icon: CreditCard, component: ParentPaymentsPlaceholder },
      { name: 'Profile', label: 'Я', icon: User, component: ProfileScreen },
    ]
  }
  // Родитель садика: Главная / Сегодня / Оплата / Я (4)
  return [
    { name: 'ParentHome', label: 'Главная', icon: Home, component: ParentHomeScreen },
    { name: 'ParentSchedule', label: 'Сегодня', icon: Calendar, component: ParentSchedulePlaceholder },
    { name: 'ParentPay', label: 'Оплата', icon: CreditCard, component: ParentPaymentsPlaceholder },
    { name: 'Profile', label: 'Я', icon: User, component: ProfileScreen },
  ]
}

function MainTabs() {
  const user = useAuthStore((s) => s.user)
  const r = String(user?.role ?? '').toUpperCase()
  const role: 'admin' | 'teacher' | 'parent' =
    r === 'SUPER_ADMIN' || r === 'ADMIN'
      ? 'admin'
      : r === 'TEACHER'
        ? 'teacher'
        : 'parent'

  const tabs = buildTabs(role, user?.institution?.type ?? null)

  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const tab = tabs.find((t) => t.name === route.name)
        const Icon = tab?.icon ?? Home
        return {
          headerShown: false,
          tabBarShowLabel: true,
          tabBarActiveTintColor: colors.primaryDeep,
          tabBarInactiveTintColor: colors.muted,
          tabBarLabelStyle: {
            fontSize: 10.5,
            fontWeight: '600',
            marginTop: -2,
          },
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.borderSoft,
            borderTopWidth: 1,
            height: 64,
            paddingTop: 6,
            paddingBottom: 8,
          },
          tabBarIcon: ({ color, focused }) => (
            <Icon
              size={22}
              color={color}
              strokeWidth={focused ? 2.4 : 2}
            />
          ),
        }
      }}
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
      {user ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  )
}
