import { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'

/** Центральный обработчик ошибок. Превращает их в JSON-ответы. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ message: 'Ошибка валидации', issues: err.issues })
  }
  if (err && typeof err === 'object' && 'status' in err) {
    const e = err as { status: number; message?: string }
    return res.status(e.status).json({ message: e.message || 'Ошибка' })
  }
  console.error(err)
  res.status(500).json({ message: 'Внутренняя ошибка сервера' })
}

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}
