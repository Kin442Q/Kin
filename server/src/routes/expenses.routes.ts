import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db'
import { authMiddleware, requireRole } from '../middleware/auth'

export const expensesRouter = Router()
expensesRouter.use(authMiddleware, requireRole('SUPER_ADMIN', 'ADMIN'))

expensesRouter.get('/', async (req, res, next) => {
  try {
    const { month, groupId } = req.query as { month?: string; groupId?: string }
    const where: any = {}
    if (month) where.month = month
    if (groupId) where.groupId = groupId
    res.json(await prisma.expense.findMany({ where, orderBy: { createdAt: 'desc' } }))
  } catch (e) { next(e) }
})

const schema = z.object({
  category: z.string(),
  description: z.string(),
  amount: z.number().nonnegative(),
  month: z.string(),
  groupId: z.string().optional(),
})

expensesRouter.post('/', async (req, res, next) => {
  try {
    const data = schema.parse(req.body)
    res.status(201).json(await prisma.expense.create({ data }))
  } catch (e) { next(e) }
})

expensesRouter.put('/:id', async (req, res, next) => {
  try {
    const data = schema.partial().parse(req.body)
    res.json(await prisma.expense.update({ where: { id: req.params.id }, data }))
  } catch (e) { next(e) }
})

expensesRouter.delete('/:id', async (req, res, next) => {
  try {
    await prisma.expense.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (e) { next(e) }
})
