# 🚀 Деплой KinderCRM

Архитектура деплоя:
- **Frontend** → Cloudflare Pages (статический SPA, бесплатно, unlimited bandwidth)
- **Backend** → Railway (NestJS + PostgreSQL + Redis)

> 💡 Зачем Cloudflare вместо Vercel? У вас рабочий Vercel-аккаунт `rowtech2022`.
> Cloudflare даёт чистое разделение: рабочее на Vercel, личное на Cloudflare.

---

## 1. Подготовка GitHub

Код уже в `https://github.com/Qutbiddin12/Kindergarten-Management-System`.
Перед деплоем запушьте последние изменения:

```bash
git add .
git commit -m "feat: подготовка к деплою (Cloudflare Pages + Railway)"
git push origin main
```

---

## 2. Backend на Railway

### 2.1. Создать проект и сервисы

1. Зарегистрируйтесь на [railway.app](https://railway.app) (вход через GitHub).
2. **New Project → Deploy from GitHub repo** → выберите `Kindergarten-Management-System`.
3. В настройках сервиса укажите **Root Directory: `server`**.
4. Railway сам найдёт `server/Dockerfile` и `server/railway.toml`.

### 2.2. Добавить PostgreSQL

В том же проекте: **+ New → Database → Add PostgreSQL**.
Railway создаст переменную `DATABASE_URL` автоматически — её можно подключить к API через **Variables → Reference**.

### 2.3. Добавить Redis

**+ New → Database → Add Redis**.
Дальше в API-сервисе пропишите переменные:
- `REDIS_HOST` = `${{Redis.RAILWAY_PRIVATE_DOMAIN}}`
- `REDIS_PORT` = `6379`
- `REDIS_PASSWORD` = `${{Redis.REDIS_PASSWORD}}`

### 2.4. Переменные окружения для API

В сервисе backend (Variables):

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_HOST=${{Redis.RAILWAY_PRIVATE_DOMAIN}}
REDIS_PORT=6379
REDIS_PASSWORD=${{Redis.REDIS_PASSWORD}}
JWT_ACCESS_SECRET=<openssl rand -hex 64>
JWT_REFRESH_SECRET=<openssl rand -hex 64>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
THROTTLE_TTL=60
THROTTLE_LIMIT=120
TELEGRAM_BOT_TOKEN=<ваш токен от @BotFather>
CORS_ORIGIN=https://<ваш-домен>.pages.dev
```

> ⚠️ После деплоя фронта на Cloudflare вернитесь и обновите `CORS_ORIGIN`.

### 2.5. Запуск миграций

`Dockerfile` уже выполняет `npx prisma migrate deploy` при старте — отдельно ничего делать не нужно.

### 2.6. Получить публичный URL

В сервисе API → **Settings → Networking → Generate Domain**.
Запомните URL вида `https://kindergarten-api-production.up.railway.app` — он понадобится для фронта.

---

## 3. Frontend на Cloudflare Pages

### 3.1. Создать аккаунт

Зарегистрируйтесь на [dash.cloudflare.com](https://dash.cloudflare.com) — можно на любой email,
не обязательно через GitHub.

### 3.2. Создать проект

1. В дашборде слева: **Workers & Pages → Create → Pages → Connect to Git**.
2. Авторизуйте GitHub-аккаунт `Qutbiddin12` и выберите репозиторий `Kindergarten-Management-System`.
3. **Set up builds and deployments**:
   - **Production branch**: `main`
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/` (по умолчанию)

### 3.3. Environment Variables

В разделе **Environment variables (Production)** добавьте:

```env
VITE_API_URL=https://<ваш-railway-домен>.up.railway.app/api
NODE_VERSION=20
```

> `NODE_VERSION=20` обязательно — иначе Cloudflare использует Node 18.

### 3.4. Deploy

Нажмите **Save and Deploy**. Через 2-3 минуты получите URL вида
`https://kindergarten-management-system.pages.dev`.

> SPA-routing уже настроен через `public/_redirects` — все маршруты будут работать.

---

## 4. Связать обе части

1. Скопируйте URL Cloudflare → в Railway обновите `CORS_ORIGIN` → пересоберите backend.
2. Откройте Cloudflare-URL → попробуйте залогиниться.

---

## 5. Создать первого пользователя

Подключитесь к Railway Postgres через Railway CLI:

```bash
npm i -g @railway/cli
railway login
railway link
railway connect Postgres
```

Проще — запустить локально `cd server && npx prisma db seed` против production-DATABASE_URL.

---

## 6. Telegram-бот

В Railway переменной `TELEGRAM_BOT_TOKEN` укажите токен от [@BotFather](https://t.me/BotFather).
Воркер очереди уже работает в том же контейнере — никаких отдельных деплоев не нужно.

---

## 🔧 Troubleshooting

| Проблема | Решение |
|---|---|
| CORS-ошибка в браузере | Проверьте `CORS_ORIGIN` в Railway = точный URL Cloudflare |
| `ECONNREFUSED redis` | Убедитесь, что `REDIS_*` подставлены через Reference Variable |
| Миграции не применились | Логи API в Railway → искать строку `prisma migrate deploy` |
| 502 Bad Gateway | Healthcheck не проходит — проверьте `/api/v1/health` |
| Cloudflare билд падает на `vite: not found` | Проверьте `NODE_VERSION=20` в env |
| 404 при F5 на `/admin/*` | Проверьте, что файл `public/_redirects` закоммичен |

---

## 💰 Стоимость

- **Cloudflare Pages**: бесплатно навсегда (unlimited bandwidth, 500 билдов/мес)
- **Railway**: $5/мес кредита бесплатно, дальше pay-as-you-go
- Для production-нагрузки заложите ~$5–15/мес на Railway
