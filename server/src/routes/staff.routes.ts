import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db'
import { authMiddleware, requireRole } from '../middleware/auth'

export const staffRouter = Router()
staffRouter.use(authMiddleware, requireRole('SUPER_ADMIN', 'ADMIN'))

staffRouter.get('/', async (_req, res, next) => {
  try { res.json(await prisma.staff.findMany({ orderBy: { createdAt: 'desc' } })) } catch (e) { next(e) }
})

const schema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  middleName: z.string().optional(),
  position: z.string(),
  phone: z.string(),
  email: z.string().email().optional(),
  groupId: z.string().optional(),
  salary: z.number().nonnegative(),
  hireDate: z.string(),
})

staffRouter.post('/', async (req, res, next) => {
  try {
    const data = schema.parse(req.body)
    const s = await prisma.staff.create({ data: { ...data, hireDate: new Date(data.hireDate) } })
    res.status(201).json(s)
  } catch (e) { next(e) }
})

staffRouter.put('/:id', async (req, res, next) => {
  try {
    const data = schema.partial().parse(req.body)
    const s = await prisma.staff.update({
      where: { id: req.params.id },
      data: { ...data, hireDate: data.hireDate ? new Date(data.hireDate) : undefined },
    })
    res.json(s)
  } catch (e) { next(e) }
})

staffRouter.delete('/:id', async (req, res, next) => {
  try { await prisma.staff.delete({ where: { id: req.params.id } }); res.status(204).end() } catch (e) { next(e) }
})
