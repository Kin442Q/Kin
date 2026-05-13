# Полная интеграция фронтенда и бэкенда

Все файлы API интеграции уже созданы в `src/api/`:
- `http.ts` — HTTP клиент с интерсепторами
- `services.ts` — REST API сервисы для всех модулей
- `hooks.ts` — React Query хуки
- `diagnostics.ts` — Инструменты для отладки
- `README.md` — Документация

## Быстрый старт

### 1. Запуск backend'а

```bash
cd server
npm install
npm run prisma:generate
npm run prisma:migrate
npm run seed
npm run start:dev
```

Backend запустится на `http://localhost:4000/api/v1`

### 2. Запуск frontend'а

```bash
npm install
npm run dev
```

Frontend на `http://localhost:5173`

### 3. Проверка интеграции

В консоли браузера:

```js
// Диагностика API
window.__kg_diagnostics()

// Или получить данные
const report = window.__kg_report()
console.log(report)
```

## Примеры использования

### Пример 1: Список групп (простой запрос)

```tsx
import { useGroups } from '@/api'

function GroupsPage() {
  const { data: groups, isLoading, error } = useGroups()

  if (isLoading) return <Spin />
  if (error) return <Result status="error" title={error?.message} />

  return (
    <List
      dataSource={groups}
      renderItem={(group) => <List.Item>{group.name}</List.Item>}
    />
  )
}
```

### Пример 2: Создание новой группы

```tsx
import { useCreateGroup } from '@/api'
import { message } from 'antd'

function CreateGroupForm() {
  const mutation = useCreateGroup()

  const handleSubmit = async (values) => {
    mutation.mutate(values, {
      onSuccess: (newGroup) => {
        message.success('Группа создана')
        // Редирект или рефреш списка
      },
      onError: (error) => {
        message.error(error?.response?.data?.message || 'Ошибка')
      },
    })
  }

  return (
    <Form onFinish={handleSubmit}>
      <Form.Item label="Название" name="name" rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      {/* другие поля */}
      <Button type="primary" htmlType="submit" loading={mutation.isPending}>
        Создать
      </Button>
    </Form>
  )
}
```

### Пример 3: Отправка attendance для группы

```tsx
import { useBulkRecordAttendance, useStudents } from '@/api'

function AttendanceForm({ groupId, date }) {
  const { data: students } = useStudents(groupId)
  const mutation = useBulkRecordAttendance()

  const handleSubmit = (records) => {
    mutation.mutate(
      records.map((r) => ({
        childId: r.childId,
        date,
        status: r.status, // 'present' | 'absent' | 'sick' | 'vacation'
      })),
      {
        onSuccess: () => message.success('Посещаемость сохранена'),
      },
    )
  }

  return (
    // форма с checkboxes для каждого ученика
    <></>,
  )
}
```

### Пример 4: Аналитика с фильтром

```tsx
import { useAnalyticsSummary, useAnalyticsTrend } from '@/api'

function AnalyticsPage({ month }) {
  const { data: summary, isLoading } = useAnalyticsSummary(month)
  const { data: trend } = useAnalyticsTrend(12)

  return (
    <Space direction="vertical" size="large" className="w-full">
      {isLoading ? (
        <Spin />
      ) : (
        <>
          <Row gutter={16}>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Доход"
                  value={summary?.totalIncome}
                  prefix="₽"
                />
              </Card>
            </Col>
            {/* остальные карточки */}
          </Row>
          <Chart data={trend} />
        </>
      )}
    </Space>
  )
}
```

### Пример 5: Миграция LoginPage на реальный backend

Текущий код использует демо-данные. Вот как переписать:

**Было (демо):**
```tsx
import { useDataStore } from '../store/dataStore'

const onFinish = (values) => {
  const account = useDataStore.getState().accounts.find(...)
  if (account) {
    login(user)
  }
}
```

**Стало (реальный backend):**
```tsx
import { useLogin } from '@/api'
import { useAuthStore } from '../store/authStore'

function LoginPage() {
  const loginMutation = useLogin()
  const login = useAuthStore((s) => s.login)
  const { message } = AntdApp.useApp()

  const onFinish = (values) => {
    loginMutation.mutate(
      { email: values.email, password: values.password },
      {
        onSuccess: (data) => {
          // data имеет: { accessToken, user }
          login(data.user, data.accessToken)
          navigate('/admin/dashboard', { replace: true })
          message.success(`Добро пожаловать, ${data.user.fullName}`)
        },
        onError: (error) => {
          message.error(error?.response?.data?.message || 'Ошибка входа')
        },
      },
    )
  }

  return (
    <Form onFinish={onFinish}>
      {/* поля */}
      <Button type="primary" loading={loginMutation.isPending}>
        Войти
      </Button>
    </Form>
  )
}
```

## Основные unterschiede между старой и новой интеграцией

| Аспект | Было (демо) | Стало (реальный API) |
|--------|-----------|---------------------|
| **Данные** | Zustand store с mock-данными | Запросы к backend'у |
| **Авторизация** | Локальный login в store | JWT токены через API |
| **Состояние** | Все в zustand | React Query + Zustand (auth) |
| **Кеширование** | Ручное | Автоматическое через React Query |
| **Ошибки** | Не обрабатываются | Через axios interceptors |
| **Обновления** | Ручное invalidate | Автоматическое при мутациях |

## Диагностика при проблемах

1. **Запросы не идут?**
   ```js
   window.__kg_diagnostics()
   // Проверьте VITE_API_URL и базовый URL в http.ts
   ```

2. **401 Unauthorized?**
   ```js
   // Токен не отправляется или истёк
   localStorage.getItem('kg_auth') // Проверить сохранённый токен
   ```

3. **CORS ошибки?**
   ```
   // backend должен разрешить CORS для фронтенда
   // docker-compose.yml: CORS_ORIGIN=http://localhost:5173
   ```

4. **Данные не обновляются?**
   ```tsx
   const queryClient = useQueryClient()
   // Вручную инвалидировать кеш:
   queryClient.invalidateQueries({ queryKey: ['groups'] })
   ```

## Полный чек-лист интеграции

- [ ] Backend работает на localhost:4000
- [ ] Frontend работает на localhost:5173
- [ ] VITE_API_URL правильно установлен
- [ ] `npm run lint` проходит без ошибок
- [ ] `npm run build` создаёт бандл
- [ ] LoginPage обновлена на useLogin hook
- [ ] Все страницы используют новые hooks вместо демо-данных
- [ ] Протестированы CRUD операции (create, read, update, delete)
- [ ] Проверена диагностика: `window.__kg_diagnostics()`
- [ ] Токены сохраняются и отправляются с каждым запросом

## Следующие шаги

1. Обновить все страницы чтобы использовать React Query hooks
2. Удалить демо-данные (dataStore и seed демо)
3. Добавить proper error handling и loading states
4. Интегрировать WebSocket для real-time уведомлений
5. Добавить offline mode с sync при вернулась сети
