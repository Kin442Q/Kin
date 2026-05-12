import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db'
import { authMiddleware, requireRole } from '../middleware/auth'

export const groupsRouter = Router()
groupsRouter.use(authMiddleware)

groupsRouter.get('/', async (_req, res, next) => {
  try {
    const groups = await prisma.group.findMany({ orderBy: { createdAt: 'asc' } })
    res.json(groups)
  } catch (e) { next(e) }
})

const groupSchema = z.object({
  name: z.string(),
  ageRange: z.string(),
  monthlyFee: z.number().nonnegative(),
  fixedMonthlyExpense: z.number().nonnegative(),
  color: z.string(),
  teacherId: z.string().optional(),
})

groupsRouter.post('/', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const data = groupSchema.parse(req.body)
    const g = await prisma.group.create({ data })
    res.status(201).json(g)
  } catch (e) { next(e) }
})

groupsRouter.put('/:id', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    const data = groupSchema.partial().parse(req.body)
    const g = await prisma.group.update({ where: { id: req.params.id }, data })
    res.json(g)
  } catch (e) { next(e) }
})

groupsRouter.delete('/:id', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    await prisma.group.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (e) { next(e) }
})
