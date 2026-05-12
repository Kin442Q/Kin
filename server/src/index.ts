import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { createServer } from 'node:http'
import { Server as SocketServer } from 'socket.io'

import { errorHandler } from './middleware/error'
import { authRouter } from './routes/auth.routes'
import { groupsRouter } from './routes/groups.routes'
import { childrenRouter } from './routes/children.routes'
import { staffRouter } from './routes/staff.routes'
import { attendanceRouter } from './routes/attendance.routes'
import { paymentsRouter } from './routes/payments.routes'
import { expensesRouter } from './routes/expenses.routes'
import { analyticsRouter } from './routes/analytics.routes'
import { notificationsRouter } from './routes/notifications.routes'

const app = express()
const PORT = Number(process.env.PORT) || 4000

app.use(helmet())
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? '*' }))
app.use(express.json({ limit: '5mb' }))
app.use(morgan('dev'))

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }))

// Публичные маршруты
app.use('/api/auth', authRouter)

// Защищённые маршруты (auth-проверка внутри роутеров через middleware)
app.use('/api/groups', groupsRouter)
app.use('/api/children', childrenRouter)
app.use('/api/staff', staffRouter)
app.use('/api/attendance', attendanceRouter)
app.use('/api/payments', paymentsRouter)
app.use('/api/expenses', expensesRouter)
app.use('/api/analytics', analyticsRouter)
app.use('/api/notifications', notificationsRouter)

app.use(errorHandler)

const httpServer = createServer(app)
const io = new SocketServer(httpServer, {
  cors: { origin: process.env.CORS_ORIGIN?.split(',') ?? '*' },
})

io.on('connection', (socket) => {
  // Минимальная заготовка для real-time чата и уведомлений.
  socket.on('chat:join', (room: string) => socket.join(room))
  socket.on('chat:message', ({ room, message }: { room: string; message: unknown }) => {
    io.to(room).emit('chat:message', message)
  })
})

httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`✓ API запущен: http://localhost:${PORT}`)
})

export { io }
