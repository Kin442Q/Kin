import { useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { useFonts } from 'expo-font'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import RootNavigator from './src/navigation'
import { useAuthStore } from './src/store/authStore'
import { colors } from './src/theme/colors'
import { fontFiles } from './src/theme/fonts'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, staleTime: 60_000 },
  },
})

export default function App() {
  const hydrate = useAuthStore((s) => s.hydrate)
  const isHydrated = useAuthStore((s) => s.isHydrated)

  // Inter (текст) и Montserrat (заголовки, логотип) из assets/fonts
  const [fontsLoaded, fontError] = useFonts(fontFiles)

  // При старте подтянуть сохранённую сессию из AsyncStorage
  useEffect(() => {
    hydrate()
  }, [hydrate])

  // Если шрифты не загрузились — не блокируем приложение, работаем на системных
  if ((!fontsLoaded && !fontError) || !isHydrated) {
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
          <StatusBar style="dark" />
          <RootNavigator />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
