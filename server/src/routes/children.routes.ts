import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db'
import { authMiddleware, requireRole, type AuthedRequest } from '../middleware/auth'

export const childrenRouter = Router()
childrenRouter.use(authMiddleware)

childrenRouter.get('/', async (req: AuthedRequest, res, next) => {
  try {
    const where: any = {}
    if (req.user?.role === 'TEACHER') {
      const u = await prisma.user.findUnique({ where: { id: req.user.id } })
      if (u?.groupId) where.groupId = u.groupId
    }
    const children = await prisma.child.findMany({ where, orderBy: { createdAt: 'desc' } })
    res.json(children)
  } catch (e) { next(e) }
})

const childSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  middleName: z.string().optional(),
  birthDate: z.string(), // ISO date
  gender: z.enum(['MALE', 'FEMALE']),
  groupId: z.string(),
  photoUrl: z.string().optional(),
  medicalNotes: z.string().optional(),
  notes: z.string().optional(),
  motherName: z.string().optional(),
  motherPhone: z.string().optional(),
  fatherName: z.string().optional(),
  fatherPhone: z.string().optional(),
  address: z.string().optional(),
  extraContact: z.string().optional(),
  telegram: z.string().optional(),
  whatsapp: z.string().optional(),
  monthlyFee: z.number().optional(),
})

childrenRouter.post('/', requireRole('SUPER_ADMIN', 'ADMIN', 'TEACHER'), async (req, res, next) => {
  try {
    const data = childSchema.parse(req.body)
    const c = await prisma.child.create({
      data: { ...data, birthDate: new Date(data.birthDate) },
    })
    res.status(201).json(c)
  } catch (e) { next(e) }
})

childrenRouter.put('/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'TEACHER'), async (req, res, next) => {
  try {
    const data = childSchema.partial().parse(req.body)
    const c = await prisma.child.update({
      where: { id: req.params.id },
      data: { ...data, birthDate: data.birthDate ? new Date(data.birthDate) : undefined },
    })
    res.json(c)
  } catch (e) { next(e) }
})

childrenRouter.delete('/:id', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res, next) => {
  try {
    await prisma.child.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (e) { next(e) }
})
