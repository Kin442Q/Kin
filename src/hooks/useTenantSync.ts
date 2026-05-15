import { useEffect, useRef, useCallback } from 'react'
import { create } from 'zustand'
import { useAuthStore } from '../store/authStore'
import { useDataStore } from '../store/dataStore'
import { http } from '../api'
import type { Child, Group } from '../types'

interface GroupApi {
  id: string
  name: string
  ageRange: string
  capacity: number
  monthlyFee: number | string
  fixedMonthlyExpense: number | string
  color: string
  isActive: boolean
  createdAt: string
}

interface StudentApi {
  id: string
  firstName: string
  lastName: string
  middleName: string | null
  birthDate: string
  gender: 'MALE' | 'FEMALE'
  groupId: string
  photoUrl: string | null
  medicalNotes: string | null
  notes: string | null
  motherName: string | null
  motherPhone: string | null
  fatherName: string | null
  fatherPhone: string | null
  address: string | null
  extraContact: string | null
  telegram: string | null
  whatsapp: string | null
  monthlyFee: number | string | null
  status: string
  createdAt: string
}

function normalizeGroups(arr: GroupApi[]): Group[] {
  return arr.map((g) => ({
    id: g.id,
    name: g.name,
    ageRange: g.ageRange,
    monthlyFee: Number(g.monthlyFee) || 0,
    fixedMonthlyExpense: Number(g.fixedMonthlyExpense) || 0,
    color: g.color,
    teacherId: undefined,
    createdAt: g.createdAt,
  }))
}

function normalizeChildren(arr: StudentApi[]): Child[] {
  return arr.map((s) => ({
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    middleName: s.middleName || undefined,
    birthDate: s.birthDate,
    gender: s.gender === 'FEMALE' ? 'female' : 'male',
    groupId: s.groupId,
    photoUrl: s.photoUrl || undefined,
    medicalNotes: s.medicalNotes || undefined,
    notes: s.notes || undefined,
    motherName: s.motherName || undefined,
    motherPhone: s.motherPhone || undefined,
    fatherName: s.fatherName || undefined,
    fatherPhone: s.fatherPhone || undefined,
    address: s.address || undefined,
    extraContact: s.extraContact || undefined,
    telegram: s.telegram || undefined,
    whatsapp: s.whatsapp || undefined,
    monthlyFee: s.monthlyFee != null ? Number(s.monthlyFee) : undefined,
    createdAt: s.createdAt,
  }))
}

/**
 * Глобальный счётчик-триггер для рефетча. Любая страница, которая
 * сделала мутацию, вызывает refreshTenantData() — это инкрементит счётчик,
 * useTenantSync видит изменение и перезапрашивает данные.
 */
interface SyncTrigger {
  tick: number
  bump: () => void
}

export const useSyncTrigger = create<SyncTrigger>((set) => ({
  tick: 0,
  bump: () => set((s) => ({ tick: s.tick + 1 })),
}))

/** Вызвать из любой страницы после успешной мутации */
export function refreshTenantData() {
  useSyncTrigger.getState().bump()
}

/**
 * Загружает данные текущего садика из бекенда. Подключается один раз
 * в AppLayout. Перезагружается при смене пользователя или вызове
 * refreshTenantData().
 */
export function useTenantSync() {
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const tick = useSyncTrigger((s) => s.tick)
  const setGroups = useDataStore((s) => s.setGroups)
  const setChildren = useDataStore((s) => s.setChildren)

  const lastUser = useRef<string | null>(null)

  const sync = useCallback(async () => {
    if (!user || !token) return

    // Глобальный супер-админ (без kindergartenId) не привязан к садику —
    // ему не показываем чужие группы/детей, просто очищаем
    if (!user.kindergartenId) {
      setGroups([])
      setChildren([])
      return
    }

    try {
      const [groupsRes, childrenRes] = await Promise.all([
        http.get<GroupApi[]>('/v1/groups'),
        http.get<StudentApi[]>('/v1/students'),
      ])
      setGroups(normalizeGroups(groupsRes.data))
      setChildren(normalizeChildren(childrenRes.data))
    } catch (e) {
      console.error('[tenant-sync] failed', e)
    }
  }, [user, token, setGroups, setChildren])

  useEffect(() => {
    if (!user || !token) {
      lastUser.current = null
      return
    }
    // На смене пользователя сразу синхронизируем
    if (lastUser.current !== user.id) {
      lastUser.current = user.id
      sync()
    }
  }, [user, token, sync])

  useEffect(() => {
    if (!user || !token) return
    if (tick > 0) sync()
  }, [tick, user, token, sync])
}
