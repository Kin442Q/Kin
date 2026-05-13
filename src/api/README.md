# API Integration Layer

Полная интеграция фронтенда и бэкенда для системы управления детским садом.

## Структура

- **http.ts** — Базовый axios инстанс с interceptors
  - Автоматически добавляет Bearer токен
  - Обрабатывает 401 (логаут)
  - Логирует все запросы для диагностики

- **services.ts** — REST API сервисы
  - Типизированные обёртки над HTTP эндпоинтами
  - Поддержка всех модулей: Auth, Users, Groups, Students, Teachers, Attendance, Schedule, Menu, Payments, Expenses, Analytics, Notifications, Health

- **hooks.ts** — React Query интеграция
  - Готовые хуки для всех сервисов
  - Автоматическое управление кешем
  - Invalidation на мутациях

- **diagnostics.ts** — Инструменты для отладки
  - `logDiagnostics()` — вывести диагностику в консоль
  - `generateDiagnosticReport()` — получить отчёт о запросах

## Использование

### Простой запрос данных

```tsx
import { useGroups } from '@/api'

function GroupsPage() {
  const { data: groups, isLoading, error } = useGroups()

  if (isLoading) return <div>Загрузка...</div>
  if (error) return <div>Ошибка: {error.message}</div>

  return (
    <ul>
      {groups?.map((g) => (
        <li key={g.id}>{g.name}</li>
      ))}
    </ul>
  )
}
```

### Создание данных

```tsx
import { useCreateStudent } from '@/api'

function CreateStudentForm() {
  const mutation = useCreateStudent()

  const handleSubmit = (data) => {
    mutation.mutate(data, {
      onSuccess: () => {
        console.log('Ученик создан!')
      },
    })
  }

  return (
    <form onSubmit={(e) => {
      e.preventDefault()
      handleSubmit({ /* data */ })
    }}>
      {/* form fields */}
    </form>
  )
}
```

### С параметрами

```tsx
import { useAttendanceRecords } from '@/api'

function AttendanceList({ month, childId }) {
  const { data } = useAttendanceRecords({ month, childId })
  // ...
}
```

## Диагностика

В консоли браузера:

```js
// Вывести полный отчёт
window.__kg_diagnostics()

// Получить данные без вывода
const report = window.__kg_report()
```

Диагностика показывает:
- Общее количество запросов
- Количество ошибок
- Среднее время ответа
- Последние 20 запросов с деталями

## Обработка ошибок

Все ошибки проходят через axios interceptor:
- 401 → автоматический разлогин
- Другие → пробрасываются в компонент

```tsx
const { isError, error } = useGroups()

if (isError) {
  const message = error?.response?.data?.message || 'Неизвестная ошибка'
  // ...
}
```

## Кеширование

Настроено в `hooks.ts`:
- `staleTime: 60s` — считать данные свежими 60 сек
- `gcTime: 5m` — хранить неиспользуемые данные 5 мин
- Автоинвалидация при мутациях

## Переменные окружения

В `.env` или `docker-compose.yml`:

```env
VITE_API_URL=http://localhost:4000/api/v1
```

При разработке используется dev сервер, при продакшене — встроенный.
