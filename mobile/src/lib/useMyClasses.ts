import { useCallback, useEffect, useState } from 'react'

import { adminApi } from '../api/admin'
import { notifyError } from './notify'
import { compareClassNames } from './classes'

export interface MyClass {
  id: string
  name: string
}

/**
 * Классы, к которым у учителя открыт доступ (сервер сам отдаёт ему только их; админу — все классы школы).
 * Журнал и отметки начинаются с выбора из этого списка, поэтому оценку или отметку нельзя поставить не тому классу.
 */
export function useMyClasses() {
  const [classes, setClasses] = useState<MyClass[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    try {
      const list = await adminApi.groups()
      setClasses(
        list
          .filter((g) => g.isActive !== false)
          .map((g) => ({ id: g.id, name: g.name }))
          .sort((a, b) => compareClassNames(a.name, b.name)),
      )
      setFailed(false)
    } catch (e) {
      setFailed(true)
      notifyError(e, { fallback: 'Не удалось загрузить классы', retry: () => void load() })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return { classes, loading, failed, reload: load }
}
