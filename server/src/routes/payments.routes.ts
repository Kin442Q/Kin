import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db'
import { authMiddleware } from '../middleware/auth'

export const paymentsRouter = Router()
paymentsRouter.use(authMiddleware)

paymentsRouter.get('/', async (req, res, next) => {
  try {
    const { month, childId, groupId } = req.query as { month?: string; childId?: string; groupId?: string }
    const where: any = {}
    if (month) where.month = month
    if (childId) where.childId = childId
    if (groupId) where.child = { groupId }
    res.json(await prisma.payment.findMany({ where, orderBy: { createdAt: 'desc' } }))
  } catch (e) { next(e) }
})

const schema = z.object({
  childId: z.string(),
  month: z.string(),
  amount: z.number().nonnegative(),
  paid: z.boolean().default(false),
  paidAt: z.string().optional(),
  method: z.enum(['CASH', 'CARD', 'TRANSFER']).optional(),
  comment: z.string().optional(),
})

paymentsRouter.post('/', async (req, res, next) => {
  try {
    const data = schema.parse(req.body)
    const p = await prisma.payment.upsert({
      where: { childId_month: { childId: data.childId, month: data.month } },
      update: {
        amount: data.amount,
        paid: data.paid,
        paidAt: data.paidAt ? new Date(data.paidAt) : null,
        method: data.method,
        comment: data.comment,
      },
      create: {
        childId: data.childId,
        month: data.month,
        amount: data.amount,
        paid: data.paid,
        paidAt: data.paidAt ? new Date(data.paidAt) : null,
        method: data.method,
        comment: data.comment,
      },
    })
    res.json(p)
  } catch (e) { next(e) }
})

paymentsRouter.delete('/:id', async (req, res, next) => {
  try {
    await prisma.payment.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (e) { next(e) }
})
