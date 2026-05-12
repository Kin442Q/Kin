/**
 * Seed-скрипт: создаёт стартовых пользователей, группы, сотрудников,
 * детей, платежи и расходы для текущего месяца.
 *
 * Запуск:  npm run seed  (из папки server)
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const month = new Date().toISOString().slice(0, 7)

  // --- Пользователи -----------------------------------------
  const pw = await bcrypt.hash('demo', 10)
  await prisma.user.upsert({
    where: { email: 'super@kg.app' },
    update: {},
    create: { email: 'super@kg.app', passwordHash: pw, fullName: 'Super Admin', role: 'SUPER_ADMIN' },
  })
  await prisma.user.upsert({
    where: { email: 'admin@kg.app' },
    update: {},
    create: { email: 'admin@kg.app', passwordHash: pw, fullName: 'Администратор', role: 'ADMIN' },
  })

  // --- Группы -----------------------------------------------
  const groupsData = [
    { id: 'g-sun',    name: 'Солнышко',   ageRange: '3–4 года', monthlyFee: 1200, fixedMonthlyExpense: 6000, color: '#f59e0b' },
    { id: 'g-star',   name: 'Звёздочка',  ageRange: '4–5 лет',  monthlyFee: 1300, fixedMonthlyExpense: 6500, color: '#6366f1' },
    { id: 'g-rain',   name: 'Радуга',     ageRange: '5–6 лет',  monthlyFee: 1400, fixedMonthlyExpense: 7000, color: '#10b981' },
    { id: 'g-flower', name: 'Цветочек',   ageRange: '2–3 года', monthlyFee: 1100, fixedMonthlyExpense: 7500, color: '#ec4899' },
  ]
  for (const g of groupsData) {
    await prisma.group.upsert({ where: { id: g.id }, update: g, create: g })
  }

  // --- Сотрудники -------------------------------------------
  const staff = [
    { id: 's-1', firstName: 'Зарина',  lastName: 'Аминова',   position: 'Воспитатель', phone: '+992 90 111 22 33', salary: 3500, hireDate: new Date('2023-09-01'), groupId: 'g-sun' },
    { id: 's-2', firstName: 'Мадина',  lastName: 'Каримова',  position: 'Воспитатель', phone: '+992 91 222 33 44', salary: 3600, hireDate: new Date('2022-08-15'), groupId: 'g-star' },
    { id: 's-3', firstName: 'Шахноза', lastName: 'Турсунова', position: 'Воспитатель', phone: '+992 92 333 44 55', salary: 3800, hireDate: new Date('2021-09-01'), groupId: 'g-rain' },
    { id: 's-4', firstName: 'Гулнора', lastName: 'Назарова',  position: 'Воспитатель', phone: '+992 93 444 55 66', salary: 3400, hireDate: new Date('2024-01-10'), groupId: 'g-flower' },
    { id: 's-5', firstName: 'Сабохат', lastName: 'Рустамова', position: 'Заведующий',  phone: '+992 90 555 66 77', salary: 5500, hireDate: new Date('2020-05-01') },
    { id: 's-6', firstName: 'Зухра',   lastName: 'Махмадова', position: 'Повар',       phone: '+992 91 666 77 88', salary: 2800, hireDate: new Date('2022-03-01') },
  ]
  for (const s of staff) {
    await prisma.staff.upsert({ where: { id: s.id }, update: s, create: s })
  }

  // --- Дети + платежи ---------------------------------------
  const childrenPerGroup: Record<string, number> = { 'g-sun': 15, 'g-star': 18, 'g-rain': 12, 'g-flower': 10 }
  const names = ['Амина', 'Карим', 'Малика', 'Бахтиёр', 'Нилуфар', 'Темур', 'Севара', 'Аброр', 'Дилноза', 'Шохрух']
  const lastNames = ['Алиев', 'Каримов', 'Махмадов', 'Бобоев', 'Юсупов', 'Назаров']

  let ix = 0
  for (const [groupId, count] of Object.entries(childrenPerGroup)) {
    const g = groupsData.find((x) => x.id === groupId)!
    for (let i = 0; i < count; i++) {
      const isFemale = (ix + i) % 2 === 0
      const id = `c-${groupId}-${i + 1}`
      const child = await prisma.child.upsert({
        where: { id },
        update: {},
        create: {
          id,
          firstName: names[(ix + i) % names.length],
          lastName: lastNames[(ix + i) % lastNames.length] + (isFemale ? 'а' : ''),
          gender: isFemale ? 'FEMALE' : 'MALE',
          birthDate: new Date(`${2026 - parseInt(g.ageRange)}-${((i % 12) + 1).toString().padStart(2, '0')}-15`),
          groupId,
          motherName: 'Мама ребёнка',
          motherPhone: '+992 90 100 0' + (10 + i),
          monthlyFee: g.monthlyFee,
        },
      })
      const paid = i % 5 !== 0
      await prisma.payment.upsert({
        where: { childId_month: { childId: child.id, month } },
        update: { amount: g.monthlyFee, paid, paidAt: paid ? new Date() : null },
        create: {
          childId: child.id,
          month,
          amount: g.monthlyFee,
          paid,
          paidAt: paid ? new Date() : null,
          method: paid ? 'CASH' : null,
        },
      })
    }
    ix += count
  }

  // --- Расходы ----------------------------------------------
  const expenses = [
    { category: 'Зарплата сотрудников', description: 'З/п воспитателя «Солнышко»',  amount: 3500, groupId: 'g-sun' },
    { category: 'Зарплата сотрудников', description: 'З/п воспитателя «Звёздочка»', amount: 3600, groupId: 'g-star' },
    { category: 'Зарплата сотрудников', description: 'З/п воспитателя «Радуга»',    amount: 3800, groupId: 'g-rain' },
    { category: 'Зарплата сотрудников', description: 'З/п воспитателя «Цветочек»',  amount: 3400, groupId: 'g-flower' },
    { category: 'Зарплата сотрудников', description: 'З/п административного штата', amount: 11300 },
    { category: 'Аренда помещения',     description: 'Аренда здания',                amount: 9000 },
    { category: 'Коммунальные услуги',  description: 'Электричество, вода, газ',    amount: 2200 },
    { category: 'Питание',              description: 'Закупка продуктов',           amount: 6800 },
    { category: 'Налоги',               description: 'Налог на прибыль',            amount: 4200 },
    { category: 'Игрушки и инвентарь',  description: 'Новые игрушки',               amount: 1500 },
  ]
  for (const e of expenses) {
    await prisma.expense.create({ data: { ...e, month } })
  }

  console.log('✓ Seed выполнен. Логины: super@kg.app / admin@kg.app, пароль: demo')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
