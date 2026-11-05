import { Fragment, useEffect, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { useFonts } from 'expo-font'
import { View, ActivityIndicator } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import RootNavigator from './src/navigation'
import { useAuthStore } from './src/store/authStore'
import { colors } from './src/theme/colors'
import { fontFiles } from './src/theme/fonts'
import { themedStyles } from './src/theme/themedStyles'
import { useThemeStore } from './src/theme/themeStore'
import NoticeHost from './src/components/NoticeHost'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, staleTime: 60_000 },
  },
})

export default function App() {
  const hydrate = useAuthStore((s) => s.hydrate)
  const isHydrated = useAuthStore((s) => s.isHydrated)
  const scheme = useThemeStore((s) => s.scheme)
  const hydrateTheme = useThemeStore((s) => s.hydrate)
  const [themeReady, setThemeReady] = useState(false)

  // Inter (текст) и Montserrat (заголовки, логотип) из assets/fonts
  const [fontsLoaded, fontError] = useFonts(fontFiles)

  // При старте подтянуть сохранённую сессию из AsyncStorage
  useEffect(() => {
    hydrate()
  }, [hydrate])

  // Сохранённый выбор темы читаем до первого экрана, чтобы не мигать светлым
  useEffect(() => {
    hydrateTheme().finally(() => setThemeReady(true))
  }, [hydrateTheme])

  // Если шрифты не загрузились — не блокируем приложение, работаем на системных
  if ((!fontsLoaded && !fontError) || !isHydrated || !themeReady) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          {/* При смене темы дерево собирается заново: экраны читают цвета активной палитры */}
          <Fragment key={scheme}>
            <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
            <RootNavigator />
            <NoticeHost />
          </Fragment>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const styles = themedStyles(() => ({
  splash: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
}))
