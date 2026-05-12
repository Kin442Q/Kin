import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../db'
import { signToken } from '../middleware/auth'
import { HttpError } from '../middleware/error'

export const authRouter = Router()

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body)
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) throw new HttpError(401, 'Неверный email или пароль')
    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) throw new HttpError(401, 'Неверный email или пароль')
    const token = signToken({ id: user.id, role: user.role, email: user.email })
    res.json({
      token,
      user: { id: user.id, email: user.email, role: user.role, fullName: user.fullName, groupId: user.groupId, childId: user.childId },
    })
  } catch (e) {
    next(e)
  }
})

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(2),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'TEACHER', 'PARENT']).default('ADMIN'),
})

authRouter.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body)
    const exists = await prisma.user.findUnique({ where: { email: data.email } })
    if (exists) throw new HttpError(409, 'Email уже занят')
    const passwordHash = await bcrypt.hash(data.password, 10)
    const u = await prisma.user.create({
      data: { email: data.email, passwordHash, fullName: data.fullName, role: data.role as any },
    })
    const token = signToken({ id: u.id, role: u.role, email: u.email })
    res.status(201).json({ token, user: { id: u.id, email: u.email, role: u.role, fullName: u.fullName } })
  } catch (e) {
    next(e)
  }
})
