import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db'
import { authMiddleware } from '../middleware/auth'

export const attendanceRouter = Router()
attendanceRouter.use(authMiddleware)

attendanceRouter.get('/', async (req, res, next) => {
  try {
    const { date, childId } = req.query as { date?: string; childId?: string }
    const where: any = {}
    if (date) where.date = new Date(date)
    if (childId) where.childId = childId
    res.json(await prisma.attendance.findMany({ where, orderBy: { date: 'desc' } }))
  } catch (e) { next(e) }
})

const schema = z.object({
  childId: z.string(),
  date: z.string(),
  status: z.enum(['PRESENT', 'ABSENT', 'SICK', 'VACATION']),
  note: z.string().optional(),
})

attendanceRouter.post('/', async (req, res, next) => {
  try {
    const data = schema.parse(req.body)
    const date = new Date(data.date)
    const a = await prisma.attendance.upsert({
      where: { childId_date: { childId: data.childId, date } },
      update: { status: data.status, note: data.note },
      create: { childId: data.childId, date, status: data.status, note: data.note },
    })
    res.json(a)
  } catch (e) { next(e) }
})
