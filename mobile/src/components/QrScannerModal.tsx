import { useEffect, useRef, useState } from 'react'
import { Linking, Modal, Pressable, StyleSheet, View } from 'react-native'
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Camera, X } from 'lucide-react-native'

import { Text } from './Text'
import { extractStudentToken } from '../lib/studentLink'
import { uiText } from '../i18n/uiText'

interface Props {
  visible: boolean
  onClose: () => void
  /** Найден QR-код ученика: токен его личной ссылки. */
  onToken: (token: string) => void
}

/** Одно и то же чужое сообщение не показываем чаще, чем раз в столько миллисекунд, пока код остаётся в кадре. */
const WRONG_COOLDOWN_MS = 2500

/**
 * Вход ученика по QR-коду с карточки: камера на весь экран, читает только QR. Видео никуда не отправляется:
 * код разбирается на телефоне, камера выключается, как только код найден или окно закрыто.
 * Токен берётся из ссылки так же, как при ручной вставке (extractStudentToken); подпись проверяет сервер.
 */
export default function QrScannerModal({ visible, onClose, onToken }: Props) {
  const insets = useSafeAreaInsets()
  const [permission, requestPermission] = useCameraPermissions()
  const [wrongCode, setWrongCode] = useState(false)
  const [cameraFailed, setCameraFailed] = useState(false)
  // Камера присылает один и тот же код много раз в секунду: после успеха и в паузу после чужого кода молчим.
  const done = useRef(false)
  const wrongAt = useRef(0)
  const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (visible) {
      done.current = false
      wrongAt.current = 0
      setWrongCode(false)
      setCameraFailed(false)
    }
    return () => {
      if (wrongTimer.current) clearTimeout(wrongTimer.current)
    }
  }, [visible])

  const onScanned = ({ data }: BarcodeScanningResult) => {
    if (done.current) return
    const token = extractStudentToken(data)
    if (token) {
      done.current = true
      onToken(token)
      return
    }
    const now = Date.now()
    if (now - wrongAt.current < WRONG_COOLDOWN_MS) return
    wrongAt.current = now
    setWrongCode(true)
    if (wrongTimer.current) clearTimeout(wrongTimer.current)
    wrongTimer.current = setTimeout(() => setWrongCode(false), WRONG_COOLDOWN_MS)
  }

  const granted = !!permission?.granted

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        {visible && granted && !cameraFailed && (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={onScanned}
            onMountError={() => setCameraFailed(true)}
          />
        )}

        <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.title}>{uiText('Вход по QR-коду')}</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={uiText('Закрыть')} style={styles.close}>
            <X size={22} color="#FFFFFF" />
          </Pressable>
        </View>

        {granted && !cameraFailed ? (
          <>
            <View pointerEvents="none" style={styles.frameWrap}>
              <View style={styles.frame} />
            </View>
            <View style={[styles.bottom, { paddingBottom: insets.bottom + 24 }]}>
              {wrongCode ? (
                <View style={styles.wrong} accessibilityLiveRegion="polite">
                  <Text style={styles.wrongText}>{uiText('Это не QR-код ученика. Возьмите карточку, которую выдал классный руководитель.')}</Text>
                </View>
              ) : (
                <Text style={styles.hint}>{uiText('Наведите камеру на QR-код с карточки')}</Text>
              )}
            </View>
          </>
        ) : (
          <View style={styles.panelWrap}>
            <View style={styles.panel}>
              <Camera size={34} color="#FFFFFF" />
              <Text style={styles.panelText}>
                {cameraFailed
                  ? uiText('Камера недоступна. Закройте окно и войдите по логину и паролю или по личной ссылке.')
                  : uiText('Разрешите доступ к камере, чтобы прочитать QR-код с карточки. Видео никуда не отправляется.')}
              </Text>
              {!cameraFailed && permission && (
                <Pressable
                  onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
                  accessibilityRole="button"
                  style={styles.panelBtn}
                >
                  <Text style={styles.panelBtnText}>
                    {permission.canAskAgain ? uiText('Разрешить камеру') : uiText('Открыть настройки')}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
      </View>
    </Modal>
  )
}

// Экран камеры всегда тёмный: цвета не зависят от темы приложения.
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  frameWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 250, height: 250, borderRadius: 24, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 24, paddingTop: 18, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
  hint: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', textAlign: 'center' },
  wrong: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, backgroundColor: '#B3261E' },
  wrongText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', lineHeight: 20 },
  panelWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  panel: { alignItems: 'center', gap: 16 },
  panelText: { fontSize: 16, lineHeight: 23, color: '#FFFFFF', textAlign: 'center' },
  panelBtn: { paddingHorizontal: 24, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0D7A7C' },
  panelBtnText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
})
