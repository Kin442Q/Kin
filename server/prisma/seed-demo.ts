/**
 * Сид «живого демо» для лендинга.
 *
 * Создаёт ОТДЕЛЬНОЕ учреждение-школу с флагом isDemo=true и наполняет его
 * правдоподобными данными: классы, ученики, предметы, четверти, расписание,
 * оценки, посещаемость, оплаты. Вход — через POST /auth/demo-login.
 * Данные доступны только для просмотра (DemoReadOnlyGuard).
 *
 * Идемпотентно и одновременно служит «сбросом»: при запуске удаляет прежний
 * демо-тенант (каскадно) и создаёт заново.
 *
 *   npm run seed:demo
 */
import { PrismaClient, GradeType, AttendanceStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const DEMO_SLUG = 'demo'
const DEMO_PASSWORD = 'Demo123456!'

// Детерминированный «псевдослучайный» выбор — чтобы сид был стабильным.
let seed = 7
const rnd = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}
const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)]
const fmt = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (d: Date, n: number) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

const LAST_NAMES = [
  'Каримов', 'Рахимов', 'Назаров', 'Сафаров', 'Юсупов', 'Холиков',
  'Шарипов', 'Исоев', 'Давлатов', 'Мирзоев', 'Алиев', 'Гулов',
]
const FIRST_M = ['Алишер', 'Фаррух', 'Сухроб', 'Икром', 'Далер', 'Бехруз']
const FIRST_F = ['Зарина', 'Мадина', 'Шахноза', 'Нигина', 'Сабрина', 'Малика']

async function main() {
  // ── Сброс прежнего демо-тенанта (каскад удалит всё вложенное) ──────
  await prisma.kindergarten.deleteMany({ where: { slug: DEMO_SLUG } })

  const pw = await bcrypt.hash(DEMO_PASSWORD, 10)

  // ── Учреждение ────────────────────────────────────────────────────
  const kg = await prisma.kindergarten.create({
    data: {
      slug: DEMO_SLUG,
      name: 'Демо-школа «Maktab»',
      address: 'Душанбе',
      isActive: true,
      isDemo: true,
      type: 'SCHOOL',
    },
  })

  // ── Классы ────────────────────────────────────────────────────────
  const classDefs = [
    { name: '5 А', gradeLabel: '5А', gradeNumber: 5, color: '#4FB286', fee: 1500 },
    { name: '5 Б', gradeLabel: '5Б', gradeNumber: 5, color: '#6366f1', fee: 1500 },
    { name: '11 Г', gradeLabel: '11Г', gradeNumber: 11, color: '#ec4899', fee: 1900 },
  ]
  const classes = []
  for (const c of classDefs) {
    classes.push(
      await prisma.group.create({
        data: {
          name: c.name,
          ageRange: '',
          gradeLabel: c.gradeLabel,
          gradeNumber: c.gradeNumber,
          capacity: 30,
          monthlyFee: c.fee,
          fixedMonthlyExpense: 8000,
          color: c.color,
          isActive: true,
          kindergartenId: kg.id,
        },
      }),
    )
  }

  // ── Пользователи: демо-админ и демо-учитель ───────────────────────
  await prisma.user.create({
    data: {
      email: 'demo-admin@maktab.tj',
      passwordHash: pw,
      fullName: 'Демо Администратор',
      role: 'ADMIN',
      isActive: true,
      kindergartenId: kg.id,
    },
  })
  const teacher = await prisma.user.create({
    data: {
      email: 'demo-teacher@maktab.tj',
      passwordHash: pw,
      fullName: 'Каримова Парвина',
      role: 'TEACHER',
      isActive: true,
      kindergartenId: kg.id,
      groupId: classes[0].id,
      // Ведёт все три класса (через M:N) — чтобы журнал/расписание были полными.
      teachingGroups: { connect: classes.map((c) => ({ id: c.id })) },
    },
  })

  // ── Предметы ──────────────────────────────────────────────────────
  const subjDefs = [
    { name: 'Математика', color: '#4FB286' },
    { name: 'Физика', color: '#6366f1' },
    { name: 'Забони модарӣ', color: '#ec4899' },
    { name: 'Английский', color: '#f59e0b' },
    { name: 'История', color: '#06b6d4' },
  ]
  const subjects = []
  for (const s of subjDefs) {
    subjects.push(
      await prisma.subject.create({
        data: { name: s.name, color: s.color, kindergartenId: kg.id },
      }),
    )
  }

  // ── Учебные четверти (относительно сегодня; текущая содержит today) ─
  const today = new Date()
  const termDefs = [
    { name: '1 четверть', from: -150, to: -101 },
    { name: '2 четверть', from: -100, to: -50 },
    { name: '3 четверть', from: -49, to: 10 }, // текущая
    { name: '4 четверть', from: 11, to: 60 },
  ]
  let currentTerm = termDefs[2]
  for (const t of termDefs) {
    await prisma.term.create({
      data: {
        name: t.name,
        type: 'QUARTER',
        startDate: new Date(fmt(addDays(today, t.from))),
        endDate: new Date(fmt(addDays(today, t.to))),
        kindergartenId: kg.id,
      },
    })
  }

  // ── Ученики (по 8 на класс) ───────────────────────────────────────
  const month = today.toISOString().slice(0, 7)
  const studentsByClass: Record<string, { id: string }[]> = {}
  for (const cls of classes) {
    studentsByClass[cls.id] = []
    for (let i = 0; i < 8; i++) {
      const female = i % 2 === 0
      const student = await prisma.student.create({
        data: {
          firstName: female ? pick(FIRST_F) : pick(FIRST_M),
          lastName: pick(LAST_NAMES) + (female ? 'а' : ''),
          birthDate: new Date(2012 - (cls.gradeNumber ?? 5) + 5, (i * 3) % 12, ((i * 7) % 27) + 1),
          gender: female ? 'FEMALE' : 'MALE',
          status: 'ACTIVE',
          groupId: cls.id,
          kindergartenId: kg.id,
          motherPhone: `+99290${100000 + Math.floor(rnd() * 899999)}`,
        },
      })
      studentsByClass[cls.id].push(student)

      // Оплата за текущий месяц (часть оплачена).
      await prisma.payment.create({
        data: {
          studentId: student.id,
          month,
          amount: Number(cls.monthlyFee),
          paid: rnd() > 0.35,
          paidAt: rnd() > 0.35 ? new Date() : null,
          method: 'CASH',
        },
      })
    }
  }

  // ── Расписание: каждому классу по 4 урока на будни ────────────────
  const lessonTimes = [
    ['08:30', '09:15'],
    ['09:25', '10:10'],
    ['10:30', '11:15'],
    ['11:25', '12:10'],
  ]
  for (const cls of classes) {
    for (let day = 1; day <= 5; day++) {
      for (let slot = 0; slot < 4; slot++) {
        const subj = subjects[(day + slot) % subjects.length]
        await prisma.scheduleItem.create({
          data: {
            groupId: cls.id,
            dayOfWeek: day,
            startTime: lessonTimes[slot][0],
            endTime: lessonTimes[slot][1],
            activity: subj.name,
            subjectId: subj.id,
            teacherId: teacher.id,
            room: `${(cls.gradeNumber ?? 5)}0${slot + 1}`,
          },
        })
      }
    }
  }

  // ── Оценки и посещаемость за текущую четверть ─────────────────────
  // Берём последние ~6 недель будних дней внутри текущей четверти.
  const termStart = new Date(fmt(addDays(today, currentTerm.from)))
  const lessonDates: Date[] = []
  for (let off = -40; off <= 0; off++) {
    const d = addDays(today, off)
    if (d < termStart) continue
    const dow = d.getDay()
    if (dow === 0 || dow === 6) continue // только будни
    lessonDates.push(d)
  }
  const gradeTypes: GradeType[] = ['CLASSWORK', 'HOMEWORK', 'CONTROL']

  for (const cls of classes) {
    for (const student of studentsByClass[cls.id]) {
      for (const subj of subjects.slice(0, 3)) {
        // ~6 оценок по предмету за четверть
        const picks = lessonDates.filter(() => rnd() > 0.78).slice(0, 6)
        for (const d of picks) {
          await prisma.grade.create({
            data: {
              studentId: student.id,
              subjectId: subj.id,
              value: 5 + Math.floor(rnd() * 6), // 5..10
              type: pick(gradeTypes),
              date: new Date(fmt(d)),
              authorId: teacher.id,
            },
          })
        }
      }
      // Посещаемость за последние 10 учебных дней
      for (const d of lessonDates.slice(-10)) {
        const r = rnd()
        const status: AttendanceStatus =
          r > 0.9 ? 'ABSENT' : r > 0.82 ? 'SICK' : 'PRESENT'
        await prisma.attendance.create({
          data: {
            studentId: student.id,
            groupId: cls.id,
            date: new Date(fmt(d)),
            status,
            markedById: teacher.id,
          },
        })
      }
    }
  }

  // ── Немного расходов и доп.доходов для финансовой аналитики ────────
  await prisma.expense.createMany({
    data: [
      { category: 'SALARIES', description: 'Зарплаты', amount: 45000, month, kindergartenId: kg.id },
      { category: 'UTILITIES', description: 'Коммуналка', amount: 6000, month, kindergartenId: kg.id },
      { category: 'FOOD', description: 'Питание', amount: 12000, month, kindergartenId: kg.id },
    ],
  })

  /* eslint-disable no-console */
  console.log('✓ Демо-школа создана:', kg.name)
  console.log('  Вход (демо-логин): POST /api/v1/auth/demo-login')
  console.log('  Или вручную: demo-admin@maktab.tj / demo-teacher@maktab.tj —', DEMO_PASSWORD)
  /* eslint-enable no-console */
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
