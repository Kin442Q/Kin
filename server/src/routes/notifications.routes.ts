import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db'
import { authMiddleware, type AuthedRequest } from '../middleware/auth'
import { io } from '../index'

export const notificationsRouter = Router()
notificationsRouter.use(authMiddleware)

notificationsRouter.get('/', async (req: AuthedRequest, res, next) => {
  try {
    const items = await prisma.notification.findMany({
      where: { OR: [{ userId: req.user!.id }, { userId: null }] },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    res.json(items)
  } catch (e) { next(e) }
})

const schema = z.object({
  title: z.string(),
  description: z.string().optional(),
  type: z.enum(['info', 'success', 'warning', 'error']).default('info'),
  userId: z.string().optional(),
})

notificationsRouter.post('/', async (req, res, next) => {
  try {
    const data = schema.parse(req.body)
    const n = await prisma.notification.create({ data })
    // Real-time push через socket.io
    io.emit('notification:new', n)
    res.status(201).json(n)
  } catch (e) { next(e) }
})

notificationsRouter.post('/read-all', async (req: AuthedRequest, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { OR: [{ userId: req.user!.id }, { userId: null }], read: false },
      data: { read: true },
    })
    res.json({ ok: true })
  } catch (e) { next(e) }
})
