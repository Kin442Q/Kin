import { useAuthStore } from '../store/authStore'
import { hasFeature, type FeatureKey } from '../lib/features'

/** Включён ли раздел для учреждения текущего пользователя. */
export function useFeature(key: FeatureKey): boolean {
  return useAuthStore((s) => hasFeature(s.user, key))
}
