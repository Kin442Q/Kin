/**
 * Seed для NestJS-стека. Создаёт SUPER_ADMIN, ADMIN, 4 группы, 4 учителя,
 * учеников, платежи текущего месяца, базовые расходы.
 *
 *   npm run seed
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const month = new Date().toISOString().slice(0, 7)
  const pwAdmin = await bcrypt.hash('Admin123456!', 10)
  const pwTeacher = await bcrypt.hash('Teacher123456!', 10)

  // ---------- Группы --------------------------------------------
  const groups = [
    { id: 'g-sun',    name: 'Солнышко',  ageRange: '3–4 года', capacity: 20, monthlyFee: 1200, fixedMonthlyExpense: 6000, color: '#f59e0b' },
    { id: 'g-star',   name: 'Звёздочка', ageRange: '4–5 лет',  capacity: 20, monthlyFee: 1300, fixedMonthlyExpense: 6500, color: '#6366f1' },
    { id: 'g-rain',   name: 'Радуга',    ageRange: '5–6 лет',  capacity: 20, monthlyFee: 1400, fixedMonthlyExpense: 7000, color: '#10b981' },
    { id: 'g-flower', name: 'Цветочек',  ageRange: '2–3 года', capacity: 20, monthlyFee: 1100, fixedMonthlyExpense: 7500, color: '#ec4899' },
  ]
  for (const g of groups) {
    await prisma.group.upsert({ where: { id: g.id }, update: g, create: g })
  }

  // ---------- Пользователи: 2 админа и 4 учителя ----------------
  await prisma.user.upsert({
    where: { email: 'admin@kindergarten.tj' },
    update: {},
    create: { email: 'admin@kindergarten.tj', passwordHash: pwAdmin, fullName: 'Администратор', role: 'ADMIN', isActive: true },
  })
  await prisma.user.upsert({
    where: { email: 'superadmin@kindergarten.tj' },
    update: {},
    create: { email: 'superadmin@kindergarten.tj', passwordHash: pwAdmin, fullName: 'Super Admin', role: 'SUPER_ADMIN', isActive: true },
  })

  const teachers: Array<[string, string, string]> = [
    ['teacher1@kindergarten.tj', 'Зарина Аминова',   'g-sun'],
    ['teacher2@kindergarten.tj', 'Мадина Каримова',  'g-star'],
    ['teacher3@kindergarten.tj', 'Шахноза Турсунова','g-rain'],
    ['teacher4@kindergarten.tj', 'Гулнора Назарова', 'g-flower'],
  ]
  for (const [email, fullName, groupId] of teachers) {
    await prisma.user.upsert({
      where: { email },
      update: { groupId, role: 'TEACHER', isActive: true },
      create: { email, passwordHash: pwTeacher, fullName, role: 'TEACHER', groupId, isActive: true },
    })
  }

  // ---------- Ученики и платежи ---------------------------------
  const namesM = ['Аброр', 'Бахтиёр', 'Икром', 'Темур', 'Шохрух']
  const namesF = ['Амина', 'Дилноза', 'Малика', 'Севара', 'Шахзода']
  const lastNames = ['Алиев', 'Каримов', 'Махмадов', 'Бобоев', 'Юсупов']

  const perGroup = { 'g-sun': 15, 'g-star': 18, 'g-rain': 12, 'g-flower': 10 } as const
  let ix = 0
  for (const g of groups) {
    const n = (perGroup as Record<string, number>)[g.id] ?? 12
    for (let i = 0; i < n; i++) {
      const isF = (ix + i) % 2 === 0
      const id = `s-${g.id}-${i + 1}`
      const student = await prisma.student.upsert({
        where: { id },
        update: {},
        create: {
          id,
          firstName: (isF ? namesF : namesM)[(ix + i) % 5],
          lastName: lastNames[(ix + i) % 5] + (isF ? 'а' : ''),
          gender: isF ? 'FEMALE' : 'MALE',
          birthDate: new Date(2022, i % 12, 15),
          groupId: g.id,
          motherName: 'Мама',
          motherPhone: '+992 90 100 0' + (100 + i),
          monthlyFee: g.monthlyFee,
        },
      })
      const paid = i % 5 !== 0
      await prisma.payment.upsert({
        where: { studentId_month: { studentId: student.id, month } },
        update: { amount: g.monthlyFee, paid, paidAt: paid ? new Date() : null },
        create: {
          studentId: student.id,
          month,
          amount: g.monthlyFee,
          paid,
          paidAt: paid ? new Date() : null,
          method: paid ? 'CASH' : null,
        },
      })
    }
    ix += n
  }

  // ---------- Расходы текущего месяца ---------------------------
  const expenses = [
    { category: 'SALARIES',  description: 'З/п административного штата', amount: 11300 },
    { category: 'RENT',      description: 'Аренда здания',                amount: 9000 },
    { category: 'UTILITIES', description: 'Электричество, вода, газ',    amount: 2200 },
    { category: 'FOOD',      description: 'Питание',                      amount: 6800 },
    { category: 'TAXES',     description: 'Налоги',                       amount: 4200 },
    { category: 'TOYS',      description: 'Игрушки',                      amount: 1500 },
  ] as const
  for (const e of expenses) {
    await prisma.expense.create({
      data: { category: e.category, description: e.description, amount: e.amount, month },
    })
  }

  console.log('✓ Seed выполнен. Учетные данные:')
  console.log('')
  console.log('👤 АДМИНИСТРАТОР:')
  console.log('   Email: admin@kindergarten.tj')
  console.log('   Пароль: Admin123456!')
  console.log('')
  console.log('👑 SUPER ADMIN:')
  console.log('   Email: superadmin@kindergarten.tj')
  console.log('   Пароль: Admin123456!')
  console.log('')
  console.log('👨‍🏫 УЧИТЕЛЯ (одинаковый пароль: Teacher123456!):')
  console.log('   teacher1@kindergarten.tj → Солнышко')
  console.log('   teacher2@kindergarten.tj → Звёздочка')
  console.log('   teacher3@kindergarten.tj → Радуга')
  console.log('   teacher4@kindergarten.tj → Цветочек')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
