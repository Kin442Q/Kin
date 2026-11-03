/**
 * Создаёт владельца платформы (SUPER_ADMIN без садика) при старте, если его ещё нет.
 * Запускается из CMD в Dockerfile после `prisma migrate deploy`.
 *
 *   OWNER_PASSWORD — обязателен (от 8 символов), иначе скрипт ничего не делает
 *   OWNER_EMAIL    — по умолчанию owner@kindergarten.tj
 *
 * Существующего пользователя не трогает (пароль не перезаписывается).
 * Ошибки не валят запуск API.
 */
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

async function main() {
  const password = process.env.OWNER_PASSWORD
  if (!password) {
    console.warn('[ensure-owner] OWNER_PASSWORD не задан в переменных сервиса — владелец не создаётся')
    return
  }
  if (password.length < 8) {
    console.warn(`[ensure-owner] OWNER_PASSWORD короче 8 символов (длина ${password.length}) — владелец не создаётся`)
    return
  }
  const email = (process.env.OWNER_EMAIL || 'owner@kindergarten.tj').toLowerCase()

  const prisma = new PrismaClient()
  try {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      console.log(`[ensure-owner] ${email} уже существует — пропуск`)
      return
    }
    await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 10),
        fullName: 'Владелец платформы',
        role: 'SUPER_ADMIN',
        kindergartenId: null,
        isActive: true,
      },
    })
    console.log(`[ensure-owner] создан владелец ${email}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => console.error('[ensure-owner] ошибка:', e.message))
