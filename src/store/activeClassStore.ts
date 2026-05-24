import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Текущий выбранный класс учителя (для учителей, ведущих несколько классов).
 * Хранится локально, чтобы при возврате на «Мой кабинет» сразу было видно,
 * на каком классе он сейчас работает.
 */
interface ActiveClassState {
  activeClassId: string | null
  setActiveClass: (id: string | null) => void
}

export const useActiveClassStore = create<ActiveClassState>()(
  persist(
    (set) => ({
      activeClassId: null,
      setActiveClass: (id) => set({ activeClassId: id }),
    }),
    { name: 'kg_active_class' },
  ),
)
