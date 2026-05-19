/**
 * Очистка базы данных с сохранением аккаунта(ов) ВЛАДЕЛЬЦА ПЛАТФОРМЫ.
 *
 * Что считается владельцем платформы:
 *   - role = SUPER_ADMIN
 *   - kindergartenId IS NULL
 *
 * Удаляем в явном порядке (не полагаясь на каскады, т.к. часть FK без
 * onDelete: Cascade — особенно Attendance.groupId, Salary.groupId,
 * Expense.groupId, ExtraIncome.groupId, Meeting.groupId, MonthlyReport.groupId).
 *
 * Запуск:
 *   cd server
 *   npm run wipe                     # dry-run
 *   $env:CONFIRM="YES"; npm run wipe # реальная очистка
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const owners = await prisma.user.findMany({
    where: { role: 'SUPER_ADMIN', kindergartenId: null },
    select: {
      id: true,
      email: true,
      fullName: true,
      lastLoginAt: true,
    },
  })

  if (owners.length === 0) {
    console.error('❌ Не найдено владельцев платформы (SUPER_ADMIN с kindergartenId = NULL).')
    console.error('   Нечего сохранять — выходим, чтобы не потерять доступ.')
    process.exit(1)
  }

  console.log('🔒 Будут сохранены аккаунты владельца платформы:')
  for (const o of owners) {
    console.log(`   • ${o.fullName}  <${o.email}>  (id=${o.id})`)
  }
  console.log('')

  const ownerIds = owners.map((o) => o.id)

  const [kgCount, userTotal, studentCount, paymentCount] = await Promise.all([
    prisma.kindergarten.count(),
    prisma.user.count(),
    prisma.student.count(),
    prisma.payment.count(),
  ])

  console.log('📊 До удаления:')
  console.log(`   учреждений: ${kgCount}`)
  console.log(`   пользователей всего: ${userTotal} (из них сохраняем ${owners.length})`)
  console.log(`   учеников/детей: ${studentCount}`)
  console.log(`   платежей: ${paymentCount}`)
  console.log('')

  if (process.env.CONFIRM !== 'YES') {
    console.log('🟡 Это DRY-RUN. Запусти с CONFIRM=YES чтобы фактически очистить.')
    console.log('   Пример (PowerShell):  $env:CONFIRM="YES"; npm run wipe')
    return
  }

  console.log('🗑  Удаляю в правильном порядке (листья → корень)...')

  // Утилита: вызывает deleteMany, но мягко игнорирует «таблицы нет» (P2021).
  async function safeDelete(name: string, fn: () => Promise<{ count: number }>) {
    try {
      const r = await fn()
      console.log(`   • ${name}: ${r.count}`)
    } catch (e: any) {
      if (e?.code === 'P2021') {
        console.log(`   • ${name}: (таблица отсутствует — пропускаю)`)
      } else {
        throw e
      }
    }
  }

  // ─── 1. Школьные / дневниковые (могут отсутствовать на старых миграциях)
  await safeDelete('Grade', () => prisma.grade.deleteMany({}))
  await safeDelete('Homework', () => prisma.homework.deleteMany({}))
  await safeDelete('KidNote', () => prisma.kidNote.deleteMany({}))
  await safeDelete('DiaryEntry', () => prisma.diaryEntry.deleteMany({}))

  // ─── 2. Финансовые/учебные записи
  await safeDelete('Attendance', () => prisma.attendance.deleteMany({}))
  await safeDelete('Payment', () => prisma.payment.deleteMany({}))
  await safeDelete('Salary', () => prisma.salary.deleteMany({}))
  await safeDelete('MonthlyReport', () => prisma.monthlyReport.deleteMany({}))
  await safeDelete('Meeting', () => prisma.meeting.deleteMany({}))
  await safeDelete('ScheduleItem', () => prisma.scheduleItem.deleteMany({}))
  await safeDelete('Expense', () => prisma.expense.deleteMany({}))
  await safeDelete('ExtraIncome', () => prisma.extraIncome.deleteMany({}))

  // ─── 3. Time-tracking чужих пользователей
  await safeDelete('TimeEntry (не владельца)', () =>
    prisma.timeEntry.deleteMany({ where: { userId: { notIn: ownerIds } } }),
  )

  // ─── 4. Subject — после Grade/Homework
  await safeDelete('Subject', () => prisma.subject.deleteMany({}))

  // ─── 5. Student — после Attendance/Payment/KidNote/Grade
  await safeDelete('Student', () => prisma.student.deleteMany({}))

  // ─── 6. Staff / Menu
  await safeDelete('Staff', () => prisma.staff.deleteMany({}))
  await safeDelete('MenuItem', () => prisma.menuItem.deleteMany({}))

  // ─── 7. Group
  await safeDelete('Group', () => prisma.group.deleteMany({}))

  // ─── 8. RefreshToken / Notification чужих
  await safeDelete('RefreshToken (не владельца)', () =>
    prisma.refreshToken.deleteMany({ where: { userId: { notIn: ownerIds } } }),
  )
  await safeDelete('Notification (не владельца)', () =>
    prisma.notification.deleteMany({ where: { userId: { notIn: ownerIds } } }),
  )

  // ─── 9. User'ы, кроме владельцев
  await safeDelete('User (не владельцы)', () =>
    prisma.user.deleteMany({ where: { id: { notIn: ownerIds } } }),
  )

  // ─── 10. Учреждения
  await safeDelete('Kindergarten', () => prisma.kindergarten.deleteMany({}))

  // ─── 11. Сбросим сессии/уведомления владельцев — на чистый старт
  await safeDelete('RefreshToken (владельца)', () =>
    prisma.refreshToken.deleteMany({ where: { userId: { in: ownerIds } } }),
  )
  await safeDelete('Notification (владельца)', () =>
    prisma.notification.deleteMany({ where: { userId: { in: ownerIds } } }),
  )

  console.log('')
  const after = await prisma.user.count()
  const kgAfter = await prisma.kindergarten.count()
  console.log('✅ Готово. После очистки:')
  console.log(`   учреждений: ${kgAfter}`)
  console.log(`   пользователей: ${after}`)
  console.log('')
  console.log('🟢 Доступ владельца платформы сохранён, email/пароль не меняются.')
  console.log('   Зайди в веб и создавай учреждения с нуля.')
}

main()
  .catch((e) => {
    console.error('❌ Ошибка:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
