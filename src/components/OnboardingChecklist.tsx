import { useEffect, useMemo, useState } from 'react'
import { Progress, Button } from 'antd'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin,
  Users2,
  Baby,
  GraduationCap,
  Check,
  ChevronRight,
  PartyPopper,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { SproutCard, SP } from './sprout'
import { useDataStore } from '../store/dataStore'
import { useAuthStore } from '../store/authStore'
import { useLabels } from '../hooks/useLabels'
import { http } from '../api'

interface Step {
  key: string
  icon: React.ReactNode
  title: string
  hint: string
  done: boolean
  to: string
}

/**
 * Чек-лист первичной настройки учреждения. Показывается админу, пока
 * настройка не завершена; по реальным данным подсказывает, что осталось.
 * После завершения сворачивается и больше не мешает (флаг в localStorage).
 */
export default function OnboardingChecklist() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const groups = useDataStore((s) => s.groups)
  const children = useDataStore((s) => s.children)
  const L = useLabels()
  const isSchool = L.group === 'класс'

  const [teacherCount, setTeacherCount] = useState<number | null>(null)
  const [dismissed, setDismissed] = useState(false)

  const inst = user?.institution ?? null
  // Только админ учреждения (не глобальный владелец без садика).
  const isInstitutionAdmin =
    (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') &&
    !!user?.kindergartenId

  const doneKey = `onboarding_done_${user?.kindergartenId ?? 'x'}`

  useEffect(() => {
    if (!isInstitutionAdmin) return
    if (localStorage.getItem(doneKey) === '1') {
      setDismissed(true)
      return
    }
    http
      .get<unknown[]>('/v1/teachers')
      .then((r) => setTeacherCount(Array.isArray(r.data) ? r.data.length : 0))
      .catch(() => setTeacherCount(0))
  }, [isInstitutionAdmin, doneKey])

  const steps: Step[] = useMemo(() => {
    const hasGeo = inst?.latitude != null && inst?.longitude != null
    return [
      {
        key: 'geo',
        icon: <MapPin size={18} />,
        title: 'Геолокация для check-in',
        hint: 'Чтобы учителя отмечались только на территории',
        done: hasGeo,
        to: '/admin/settings',
      },
      {
        key: 'groups',
        icon: <Users2 size={18} />,
        title: `Создать ${isSchool ? 'классы' : 'группы'}`,
        hint: `Хотя бы один ${isSchool ? 'класс' : 'группа'}`,
        done: groups.length > 0,
        to: '/admin/groups',
      },
      {
        key: 'students',
        icon: <Baby size={18} />,
        title: `Добавить ${isSchool ? 'учеников' : 'детей'}`,
        hint: 'Вручную или импортом из Excel/фото',
        done: children.length > 0,
        to: '/admin/children',
      },
      {
        key: 'teachers',
        icon: <GraduationCap size={18} />,
        title: `Добавить ${isSchool ? 'учителей' : 'воспитателей'}`,
        hint: 'Создать аккаунты сотрудников',
        done: (teacherCount ?? 0) > 0,
        to: '/admin/teachers',
      },
    ]
  }, [inst, groups.length, children.length, teacherCount, isSchool])

  const doneCount = steps.filter((s) => s.done).length
  const total = steps.length
  const percent = Math.round((doneCount / total) * 100)
  const allDone = doneCount === total

  if (!isInstitutionAdmin || dismissed) return null
  // Пока не знаем число учителей — не мигаем (ждём загрузку).
  if (teacherCount === null) return null

  const finish = () => {
    localStorage.setItem(doneKey, '1')
    setDismissed(true)
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.3 }}
      >
        <SproutCard
          accent="mint-yellow"
          padding={18}
          style={{ marginBottom: 20 }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 22 }}>{allDone ? '🎉' : '🚀'}</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: SP.text }}>
                  {allDone
                    ? 'Учреждение настроено!'
                    : 'Настройка учреждения'}
                </div>
                <div style={{ fontSize: 12, color: SP.textMid }}>
                  {allDone
                    ? 'Всё готово к работе. Можно скрыть эту подсказку.'
                    : `Готово ${doneCount} из ${total} шагов`}
                </div>
              </div>
            </div>
            {allDone ? (
              <Button
                size="small"
                type="primary"
                icon={<PartyPopper size={14} />}
                onClick={finish}
              >
                Завершить
              </Button>
            ) : (
              <Button
                size="small"
                type="text"
                icon={<X size={15} />}
                onClick={finish}
                title="Скрыть"
              />
            )}
          </div>

          <Progress
            percent={percent}
            showInfo={false}
            strokeColor={{ from: SP.primary, to: SP.primaryDeep }}
            trailColor={SP.borderSoft}
            style={{ marginBottom: 14 }}
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 10,
            }}
          >
            {steps.map((s) => (
              <div
                key={s.key}
                onClick={() => navigate(s.to)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 12,
                  cursor: 'pointer',
                  background: s.done ? SP.primaryGhost : SP.surface,
                  border: `1px solid ${s.done ? 'transparent' : SP.borderSoft}`,
                  transition: 'all 0.2s',
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                    background: s.done ? SP.primary : SP.surfaceAlt,
                    color: s.done ? '#fff' : SP.muted,
                  }}
                >
                  {s.done ? <Check size={18} /> : s.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: SP.text,
                      textDecoration: s.done ? 'line-through' : 'none',
                      opacity: s.done ? 0.7 : 1,
                    }}
                  >
                    {s.title}
                  </div>
                  <div style={{ fontSize: 11, color: SP.muted }}>{s.hint}</div>
                </div>
                {!s.done && (
                  <ChevronRight size={16} color={SP.muted} style={{ flexShrink: 0 }} />
                )}
              </div>
            ))}
          </div>
        </SproutCard>
      </motion.div>
    </AnimatePresence>
  )
}
