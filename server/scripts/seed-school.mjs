#!/usr/bin/env node
/**
 * Наполнение тестовой школы данными через обычный API (как это делал бы человек).
 *
 *   SEED_API=https://<сайт>/api  SEED_LOGIN=<email админа школы>  SEED_PASSWORD=<пароль> \
 *     node server/scripts/seed-school.mjs
 *
 * Что создаёт: предметы, четверти, классы, учеников, учителей (БЕЗ привязки к классам —
 * её делает админ), родителей, входы учеников, расписание, оценки, посещаемость,
 * домашние задания + напоминания родителям, родительские собрания, квизы, материалы
 * библиотеки и переписку родителей с администрацией.
 *
 * Пароли и логины созданных людей пишутся в CSV (SEED_OUT), в консоль не выводятся.
 * Скрипт идемпотентен там, где это дёшево (классы, предметы, четверти, учителя,
 * ученики, квизы, материалы пропускаются, если уже есть); оценки, посещаемость и ДЗ
 * создаются только для учеников, добавленных в этом запуске.
 *
 * Настройки (необязательные):
 *   SEED_RPS=1.5            запросов в секунду (на сервере лимит 120/мин на IP)
 *   SEED_PER_CLASS=10       учеников в классе
 *   SEED_GRADES=5           оценок на ученика
 *   SEED_ATT_DAYS=3         дней посещаемости
 *   SEED_LESSONS=4          уроков в день в расписании
 *   SEED_OUT=./seed-school-credentials.csv
 *   SEED_CREATE_SCHOOL=<название>   если логин принадлежит владельцу платформы (без школы):
 *                                   создать новую школу и работать от её админа
 */
import { writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'

const API = (process.env.SEED_API ?? '').replace(/\/+$/, '')
const LOGIN = process.env.SEED_LOGIN ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const RPS = Number(process.env.SEED_RPS ?? 1.5)
const PER_CLASS = Number(process.env.SEED_PER_CLASS ?? 10)
const GRADES_PER_STUDENT = Number(process.env.SEED_GRADES ?? 5)
const ATT_DAYS = Number(process.env.SEED_ATT_DAYS ?? 3)
const LESSONS = Number(process.env.SEED_LESSONS ?? 4)
const OUT = process.env.SEED_OUT ?? './seed-school-credentials.csv'

if (!API || !LOGIN || !PASSWORD) {
  console.error('Нужны переменные SEED_API (с /api на конце), SEED_LOGIN и SEED_PASSWORD.')
  process.exit(2)
}

// ── Детерминированный выбор: повторный запуск даёт те же имена ───────────────
let rngState = 20260901
const rnd = () => {
  rngState = (rngState * 16807) % 2147483647
  return rngState / 2147483647
}
const pick = (a) => a[Math.floor(rnd() * a.length)]
const chance = (p) => rnd() < p
const iso = (d) => d.toISOString().slice(0, 10)
const addDays = (d, n) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
// Пароли — из crypto, а не из rnd(): иначе повторный запуск сдвигает последовательность имён и не узнаёт уже созданных учеников.
const strongPassword = () => `${randomBytes(6).toString('base64url')}-${100 + (randomBytes(2).readUInt16BE() % 900)}Aa!`

// ── HTTP с ограничением частоты, повтором при 429 и перелогином при 401 ──────
let token = ''
let lastCall = 0
const gap = 1000 / RPS
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const stats = { ok: 0, fail: 0 }
const failures = new Map()

// Сервер заворачивает успешные ответы в { data, meta? }.
const unwrap = (body) => (body && typeof body === 'object' && !Array.isArray(body) && 'data' in body ? body.data : body)

async function rawLogin(email, password) {
  const res = await fetch(`${API}/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(`Вход не удался (${res.status})`)
  return unwrap(await res.json())
}

let credentials = { email: LOGIN, password: PASSWORD }

async function call(method, path, body, { tok, quiet } = {}) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const wait = lastCall + gap - Date.now()
    if (wait > 0) await sleep(wait)
    lastCall = Date.now()
    const res = await fetch(`${API}/v1${path}`, {
      method,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${tok ?? token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (res.status === 429) {
      await sleep(Number(res.headers.get('retry-after') ?? 15) * 1000 + 500)
      continue
    }
    if (res.status === 401 && !tok) {
      token = (await rawLogin(credentials.email, credentials.password)).accessToken
      continue
    }
    const text = await res.text()
    const data = text ? JSON.parse(text) : null
    if (!res.ok) {
      stats.fail++
      const msg = Array.isArray(data?.message) ? data.message.join('; ') : (data?.message ?? res.statusText)
      const key = `${method} ${path.replace(/[0-9a-z]{20,}/gi, ':id').split('?')[0]} → ${res.status} ${msg}`
      failures.set(key, (failures.get(key) ?? 0) + 1)
      if (quiet) return null
      const err = new Error(`${key}`)
      err.status = res.status
      throw err
    }
    stats.ok++
    return unwrap(data)
  }
  throw new Error(`${method} ${path}: слишком много повторов`)
}
const get = (p) => call('GET', p)
const post = (p, b, o) => call('POST', p, b ?? {}, o)
const tryPost = (p, b, o) => call('POST', p, b ?? {}, { ...o, quiet: true })
const step = (name) => console.log(`\n▶ ${name}`)

// ── Справочники ─────────────────────────────────────────────────────────────
const SUBJECTS = [
  ['Математика', '#0D7A7C'], ['Русский язык', '#2E6BE6'], ['Таджикский язык', '#FF8A65'],
  ['Английский язык', '#7C5CE6'], ['Физика', '#1FA3D6'], ['Химия', '#F2B01E'], ['Биология', '#3FA66B'],
  ['История', '#D6558B'], ['География', '#16A39B'], ['Информатика', '#4A6CF0'],
  ['Физкультура', '#E8603C'], ['Литература', '#9A5BD6'],
]
const CORE_YOUNG = ['Математика', 'Русский язык', 'Таджикский язык', 'Английский язык', 'Физкультура', 'Литература']
const CORE_MIDDLE = ['Математика', 'Русский язык', 'Таджикский язык', 'Английский язык', 'История', 'География', 'Биология', 'Физкультура', 'Литература']
const CORE_SENIOR = ['Математика', 'Русский язык', 'Таджикский язык', 'Английский язык', 'Физика', 'Химия', 'Биология', 'История', 'Информатика', 'Физкультура']
const subjectsFor = (grade) => (grade <= 4 ? CORE_YOUNG : grade <= 8 ? CORE_MIDDLE : CORE_SENIOR)

const CLASSES = ['1 А', '1 Б', '1 В', '2 А', '2 Б', '3 А', '3 Б', '4 А', '5 А', '5 Б', '6 А', '7 А', '8 А', '9 А', '9 Б', '10 А', '11 А', '11 Б']
const CLASS_COLORS = ['#0D7A7C', '#FF8A65', '#2E6BE6', '#7C5CE6', '#3FA66B', '#D6558B', '#F2B01E', '#1FA3D6']

const MALE = ['Фаррух', 'Сухроб', 'Икром', 'Далер', 'Бехруз', 'Умед', 'Рустам', 'Комрон', 'Шахзод', 'Амир', 'Мансур', 'Исмоил', 'Азиз', 'Парвиз', 'Хусрав', 'Тимур']
const FEMALE = ['Айша', 'Нигина', 'Мадина', 'Зарина', 'Шахноза', 'Дилноза', 'Малика', 'Фируза', 'Сабрина', 'Мехри', 'Зухра', 'Нилуфар', 'Лайло', 'Гулноза', 'Рухшона', 'Марьям']
const SURNAMES = ['Каримов', 'Рахимов', 'Назаров', 'Сафаров', 'Юсупов', 'Холиков', 'Шарипов', 'Исоев', 'Давлатов', 'Мирзоев', 'Алиев', 'Гулов', 'Саидов', 'Бобоев', 'Одинаев', 'Курбонов']
const PATRONYMS = ['Рустам', 'Азиз', 'Умар', 'Хамид', 'Бахтиёр', 'Шерали']

const TEACHERS = [
  ['Рахимова Нигина Саидовна', 'Начальные классы'], ['Саидов Фаррух Баходурович', 'Математика'],
  ['Юсупова Манижа Азизовна', 'Русский язык'], ['Назаров Дилшод Хамидович', 'Физика'],
  ['Шарипова Зарина Муродовна', 'Английский язык'], ['Холиков Сухроб Икромович', 'История'],
  ['Алиева Мадина Умаровна', 'Биология'], ['Давлатов Бехруз Исмоилович', 'Физкультура'],
]

const QUIZZES = [
  { title: 'Математика: дроби и проценты', subject: 'Математика', timeLimitSec: null, questions: [
    ['SINGLE', 'Сколько будет 1/2 + 1/4?', [['3/4', 1], ['2/6', 0], ['1/6', 0], ['2/4', 0]], '1/2 = 2/4, значит 2/4 + 1/4 = 3/4'],
    ['SINGLE', 'Сколько процентов составляет 1/5?', [['20%', 1], ['5%', 0], ['15%', 0], ['50%', 0]], null],
    ['MULTIPLE', 'Какие дроби равны 1/2?', [['2/4', 1], ['3/6', 1], ['2/3', 0], ['4/8', 1]], 'Числитель вдвое меньше знаменателя'],
    ['SINGLE', 'Какая дробь больше?', [['3/5', 1], ['2/5', 0]], null],
    ['SINGLE', 'Найдите 10% от 250.', [['25', 1], ['2,5', 0], ['50', 0], ['10', 0]], null],
  ] },
  { title: 'Таджикский язык: правописание', subject: 'Таджикский язык', timeLimitSec: 300, questions: [
    ['SINGLE', 'Сколько букв в таджикском алфавите?', [['35', 1], ['33', 0], ['32', 0], ['36', 0]], null],
    ['SINGLE', 'Как переводится слово «китоб»?', [['Книга', 1], ['Тетрадь', 0], ['Ручка', 0], ['Стол', 0]], null],
    ['SINGLE', 'Как переводится слово «мактаб»?', [['Школа', 1], ['Класс', 0], ['Урок', 0], ['Дом', 0]], null],
    ['MULTIPLE', 'Какие из слов означают цвета?', [['сурх', 1], ['сабз', 1], ['дарахт', 0], ['кабуд', 1]], 'Сурх — красный, сабз — зелёный, кабуд — синий'],
    ['SINGLE', 'Как будет «спасибо» по-таджикски?', [['Ташаккур', 1], ['Салом', 0], ['Хайр', 0], ['Марҳамат', 0]], null],
  ] },
  { title: 'История: Древний мир', subject: 'История', timeLimitSec: null, questions: [
    ['SINGLE', 'Какой материал использовали для письма в Древнем Египте?', [['Папирус', 1], ['Бумага', 0], ['Пергамент из шёлка', 0], ['Береста', 0]], null],
    ['SINGLE', 'Где появились первые Олимпийские игры?', [['В Древней Греции', 1], ['В Древнем Риме', 0], ['В Египте', 0], ['В Персии', 0]], null],
    ['MULTIPLE', 'Что относится к семи чудесам света древности?', [['Пирамида Хеопса', 1], ['Колосс Родосский', 1], ['Эйфелева башня', 0], ['Висячие сады Семирамиды', 1]], null],
    ['SINGLE', 'Как называлась столица Древней Греции — города-государства, давшего начало демократии?', [['Афины', 1], ['Спарта', 0], ['Дельфы', 0], ['Фивы', 0]], null],
    ['SINGLE', 'Кто был первым императором Рима?', [['Октавиан Август', 1], ['Юлий Цезарь', 0], ['Нерон', 0], ['Траян', 0]], 'Юлий Цезарь был диктатором, но не императором'],
  ] },
  { title: 'Английский: Present Simple', subject: 'Английский язык', timeLimitSec: 240, questions: [
    ['SINGLE', 'She ___ to school every day.', [['goes', 1], ['go', 0], ['going', 0], ['gone', 0]], null],
    ['SINGLE', 'They ___ football on Sundays.', [['play', 1], ['plays', 0], ['playing', 0], ['is play', 0]], null],
    ['SINGLE', 'Choose the correct question: ___ he like tea?', [['Does', 1], ['Do', 0], ['Is', 0], ['Are', 0]], null],
    ['MULTIPLE', 'Which words are days of the week?', [['Monday', 1], ['April', 0], ['Friday', 1], ['Sunday', 1]], null],
    ['SINGLE', 'The negative form of «I like apples»:', [["I don't like apples", 1], ["I doesn't like apples", 0], ['I not like apples', 0], ["I am not like apples", 0]], null],
  ] },
  { title: 'Биология: клетка', subject: 'Биология', timeLimitSec: null, questions: [
    ['SINGLE', 'Что является «энергетической станцией» клетки?', [['Митохондрия', 1], ['Ядро', 0], ['Рибосома', 0], ['Вакуоль', 0]], null],
    ['SINGLE', 'Где хранится наследственная информация клетки?', [['В ядре', 1], ['В цитоплазме', 0], ['В мембране', 0], ['В вакуоли', 0]], null],
    ['MULTIPLE', 'Что есть у растительной клетки, но нет у животной?', [['Клеточная стенка', 1], ['Хлоропласты', 1], ['Ядро', 0], ['Крупная центральная вакуоль', 1]], null],
    ['SINGLE', 'Какой процесс идёт в хлоропластах?', [['Фотосинтез', 1], ['Дыхание', 0], ['Пищеварение', 0], ['Деление', 0]], null],
    ['SINGLE', 'Что окружает клетку снаружи у животных?', [['Мембрана', 1], ['Клеточная стенка', 0], ['Ядро', 0], ['Хлоропласт', 0]], null],
  ] },
  { title: 'География: материки и океаны', subject: 'География', timeLimitSec: null, questions: [
    ['SINGLE', 'Сколько материков на Земле (по самой распространённой схеме)?', [['6', 0], ['7', 1], ['5', 0], ['8', 0]], 'Евразия, Африка, Северная и Южная Америка, Австралия, Антарктида — это 6 по русской традиции; в мире чаще считают 7, разделяя Америку'],
    ['SINGLE', 'Самый большой океан:', [['Тихий', 1], ['Атлантический', 0], ['Индийский', 0], ['Северный Ледовитый', 0]], null],
    ['SINGLE', 'Самая высокая гора мира:', [['Эверест', 1], ['Монблан', 0], ['Эльбрус', 0], ['Килиманджаро', 0]], null],
    ['MULTIPLE', 'Какие страны граничат с Таджикистаном?', [['Узбекистан', 1], ['Кыргызстан', 1], ['Китай', 1], ['Казахстан', 0]], 'Также граничит с Афганистаном'],
    ['SINGLE', 'Как называется самая длинная река Центральной Азии, текущая на границе с Афганистаном?', [['Пяндж (верховье Амударьи)', 1], ['Волга', 0], ['Днепр', 0], ['Нил', 0]], null],
  ] },
]

const HOMEWORK_TITLES = {
  'Математика': ['Решить задачи №1–5 на стр. 42', 'Повторить таблицу умножения'],
  'Русский язык': ['Упражнение 12, выписать орфограммы', 'Выучить правило и привести 5 примеров'],
  'Таджикский язык': ['Написать 5 предложений о своей семье', 'Выучить новые слова урока'],
  'Английский язык': ['Выучить 10 новых слов', 'Написать рассказ о своём дне (5 предложений)'],
  'Физика': ['Параграф 8, ответить на вопросы', 'Решить задачи на скорость и время'],
  'Химия': ['Выучить определения из параграфа 5', 'Заполнить таблицу «Простые вещества»'],
  'Биология': ['Нарисовать схему клетки и подписать части', 'Прочитать параграф 6 и пересказать'],
  'История': ['Подготовить рассказ по теме урока', 'Заполнить хронологическую таблицу'],
  'География': ['Подписать на контурной карте реки и горы', 'Подготовить сообщение о выбранной стране'],
  'Информатика': ['Практическая работа: оформить текст в редакторе', 'Повторить термины главы 2'],
  'Физкультура': ['Комплекс утренней зарядки (запись в дневник)', 'Подготовить форму к уроку'],
  'Литература': ['Прочитать рассказ и ответить на вопросы', 'Выучить стихотворение наизусть'],
}

const LIBRARY = [
  ['Онлайн-уроки математики', 'LINK', 'https://ru.khanacademy.org/', 'Математика', null],
  ['Энциклопедия для школьников', 'LINK', 'https://ru.wikipedia.org/', null, null],
  ['Видеоуроки по английскому языку', 'VIDEO', 'https://www.youtube.com/', 'Английский язык', null],
  ['Подготовка к выпускным экзаменам', 'ARTICLE', 'https://ru.khanacademy.org/', null, 11],
  ['Электронный учебник по биологии', 'BOOK', 'https://ru.wikipedia.org/', 'Биология', 8],
  ['Азбука для первоклассников', 'BOOK', 'https://ru.wikipedia.org/', 'Русский язык', 1],
]

const rows = [['Роль', 'ФИО', 'Логин', 'Пароль', 'Класс / примечание']]
const addCred = (role, name, login, pass, note = '') => rows.push([role, name, login, pass, note])
const saveCreds = () => writeFileSync(OUT, '﻿' + rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n'))

// ── Основной ход ────────────────────────────────────────────────────────────
async function main() {
  step('Вход')
  let auth = await rawLogin(LOGIN, PASSWORD)
  token = auth.accessToken
  let me = auth.user
  if (!me.kindergartenId) {
    const schoolName = process.env.SEED_CREATE_SCHOOL
    if (!schoolName) {
      throw new Error(
        'Этот логин не привязан к школе (владелец платформы). Войдите админом школы или задайте SEED_CREATE_SCHOOL="Название" — тогда будет создана новая школа с отдельным админом.',
      )
    }
    const adminEmail = `admin-${randomBytes(3).toString('hex')}@test-school.local`
    const adminPass = strongPassword()
    await post('/kindergartens', { name: schoolName, owner: { fullName: 'Администратор тестовой школы', email: adminEmail, password: adminPass } })
    addCred('Админ школы', 'Администратор тестовой школы', adminEmail, adminPass, schoolName)
    credentials = { email: adminEmail, password: adminPass }
    auth = await rawLogin(adminEmail, adminPass)
    token = auth.accessToken
    me = auth.user
    console.log('  создана новая школа и её админ (данные — в CSV)')
  }
  if (!['ADMIN', 'SUPER_ADMIN'].includes(me.role)) throw new Error(`Нужен админ школы, а вход выполнен как ${me.role}`)
  console.log(`  вход выполнен, роль ${me.role}`)

  // Предметы
  step('Предметы')
  const subjectByName = new Map((await get('/subjects')).map((s) => [s.name.toLowerCase(), s]))
  for (const [name, color] of SUBJECTS) {
    if (subjectByName.has(name.toLowerCase())) continue
    const s = await tryPost('/subjects', { name, color })
    if (s) subjectByName.set(name.toLowerCase(), s)
  }
  const subj = (name) => subjectByName.get(name.toLowerCase())
  console.log(`  предметов: ${subjectByName.size}`)

  // Четверти
  step('Четверти')
  const now = new Date()
  const y = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1
  const quarters = [
    [`I четверть ${y}/${y + 1}`, `${y}-09-01`, `${y}-11-07`],
    [`II четверть ${y}/${y + 1}`, `${y}-11-08`, `${y}-12-31`],
    [`III четверть ${y}/${y + 1}`, `${y + 1}-01-10`, `${y + 1}-03-25`],
    [`IV четверть ${y}/${y + 1}`, `${y + 1}-04-03`, `${y + 1}-05-30`],
  ]
  const termsNow = (await tryGet('/terms')) ?? []
  const haveTerm = new Set(termsNow.map((t) => t.name))
  for (const [name, startDate, endDate] of quarters) {
    if (!haveTerm.has(name)) await tryPost('/terms', { name, type: 'QUARTER', startDate, endDate })
  }

  // Классы
  step('Классы')
  const groupByName = new Map((await get('/groups')).map((g) => [g.name.trim().toLowerCase(), g]))
  for (const [i, name] of CLASSES.entries()) {
    if (groupByName.has(name.toLowerCase())) continue
    const g = await tryPost('/groups', { name, capacity: 30, color: CLASS_COLORS[i % CLASS_COLORS.length] })
    if (g) groupByName.set(name.toLowerCase(), g)
  }
  console.log(`  классов: ${CLASSES.filter((n) => groupByName.has(n.toLowerCase())).length} из ${CLASSES.length}`)

  // Учителя (без привязки к классам — её делает админ)
  step('Учителя (без привязки к классам)')
  const existingEmails = new Set(((await tryGet('/users/teachers')) ?? []).map((t) => (t.email ?? '').toLowerCase()))
  for (const [i, [fullName, subject]] of TEACHERS.entries()) {
    const email = `teacher${i + 1}@test-school.local`
    if (existingEmails.has(email)) continue
    const password = strongPassword()
    const t = await tryPost('/users/teacher', { fullName, phone: `+992 900 10 ${String(i + 1).padStart(2, '0')}`, email, password })
    if (t) addCred('Учитель', fullName, email, password, subject)
  }

  // Ученики
  step('Ученики')
  const existingStudents = (await get('/students')) ?? []
  const studentKey = (s) => `${s.lastName}|${s.firstName}|${String(s.birthDate).slice(0, 10)}`
  const haveKeys = new Set(existingStudents.map(studentKey))
  const used = new Set()
  const items = []
  for (const cls of CLASSES) {
    const grade = parseInt(cls, 10)
    for (let i = 0; i < PER_CLASS; i++) {
      const female = (i + grade) % 2 === 0
      let first, last, key
      do {
        first = pick(female ? FEMALE : MALE)
        last = pick(SURNAMES) + (female ? 'а' : '')
        key = last + first
      } while (used.has(key))
      used.add(key)
      const year = now.getFullYear() - 6 - grade
      const birthDate = `${year}-${String(1 + Math.floor(rnd() * 12)).padStart(2, '0')}-${String(1 + Math.floor(rnd() * 28)).padStart(2, '0')}`
      const it = {
        lastName: last, firstName: first, middleName: pick(PATRONYMS) + (female ? 'овна' : 'ович'), birthDate,
        gender: female ? 'FEMALE' : 'MALE', groupName: cls,
        motherName: `${last} (мама)`, motherPhone: `+992 900 00 ${String(items.length + 1).padStart(3, '0')}`,
      }
      if (!haveKeys.has(studentKey(it))) items.push(it)
    }
  }
  const created = []
  for (let i = 0; i < items.length; i += 100) {
    const res = await post('/students/bulk', { items: items.slice(i, i + 100) })
    created.push(...(res.created ?? []))
    for (const e of res.errors ?? []) console.log(`  строка ${e.row}: ${e.name} — ${e.message}`)
  }
  console.log(`  добавлено учеников: ${created.length}${created.length ? '' : ' (все уже были)'}`)
  const gradeOf = (name) => parseInt(name, 10)
  const groupNameById = new Map([...groupByName.values()].map((g) => [g.id, g.name]))
  const byGroup = new Map()
  for (const s of created) {
    if (!byGroup.has(s.groupId)) byGroup.set(s.groupId, [])
    byGroup.get(s.groupId).push(s)
  }

  // Родители и входы учеников
  step('Родители и входы учеников')
  const parents = []
  let parentNo = 0
  for (const [gid, list] of byGroup) {
    const cls = groupNameById.get(gid)
    for (const s of list.slice(0, 2)) {
      parentNo++
      const email = `parent${String(parentNo).padStart(2, '0')}@test-school.local`
      const password = strongPassword()
      const fullName = `${s.lastName.replace(/а$/, '')}${s.gender === 'FEMALE' ? '' : ''} (родитель ${s.firstName})`.replace(/\s+/g, ' ')
      const p = await tryPost(`/students/${s.id}/parents`, { fullName, email, phone: `+992 900 20 ${String(parentNo).padStart(2, '0')}`, password })
      if (p) {
        addCred('Родитель', fullName, email, password, `${cls}, ребёнок ${s.lastName} ${s.firstName}`)
        parents.push({ email, password, student: s, cls })
      }
    }
    const s0 = list[0]
    const acc = await tryPost(`/students/${s0.id}/account`, {})
    if (acc) addCred('Ученик', `${s0.lastName} ${s0.firstName}`, acc.login ?? acc.email ?? '', acc.password ?? '', cls)
  }
  console.log(`  родителей: ${parents.length}`)

  // Расписание
  step('Расписание')
  const slots = [['08:00', '08:45'], ['08:55', '09:40'], ['09:50', '10:35'], ['10:45', '11:30'], ['11:40', '12:25']]
  for (const cls of CLASSES) {
    const g = groupByName.get(cls.toLowerCase())
    if (!g || !byGroup.has(g.id)) continue
    const pool = subjectsFor(gradeOf(cls))
    for (let day = 1; day <= 5; day++) {
      for (let l = 0; l < Math.min(LESSONS, slots.length); l++) {
        const name = pool[(day * 3 + l * 2 + gradeOf(cls)) % pool.length]
        await tryPost('/schedule', {
          groupId: g.id, dayOfWeek: day, startTime: slots[l][0], endTime: slots[l][1], activity: name,
          subjectId: subj(name)?.id, room: `Каб. ${10 + ((day + l + gradeOf(cls)) % 20)}`,
        })
      }
    }
  }

  // Оценки
  step('Оценки')
  const types = ['CLASSWORK', 'CLASSWORK', 'HOMEWORK', 'CONTROL', 'EXAM', 'PROJECT']
  const comments = ['', '', '', 'Хорошая работа', 'Нужно повторить тему', 'Активно работал на уроке', 'Аккуратно выполнено']
  let gradeCount = 0
  for (const [gid, list] of byGroup) {
    const pool = subjectsFor(gradeOf(groupNameById.get(gid)))
    for (const s of list) {
      for (let k = 0; k < GRADES_PER_STUDENT; k++) {
        const name = pick(pool)
        const value = chance(0.08) ? 3 + Math.floor(rnd() * 2) : chance(0.35) ? 10 : 6 + Math.floor(rnd() * 4)
        const r = await tryPost('/grades', {
          studentId: s.id, subjectId: subj(name)?.id, value, type: pick(types),
          date: iso(addDays(now, -Math.floor(rnd() * 14))), comment: pick(comments) || undefined,
        })
        if (r) gradeCount++
      }
    }
  }
  console.log(`  оценок: ${gradeCount}`)

  // Посещаемость за последние учебные дни
  step('Посещаемость')
  const schoolDays = []
  for (let d = 0; schoolDays.length < ATT_DAYS && d < 14; d++) {
    const day = addDays(now, -d)
    if (day.getDay() !== 0 && day.getDay() !== 6) schoolDays.push(iso(day))
  }
  let attCount = 0
  for (const list of byGroup.values()) {
    for (const s of list) {
      for (const date of schoolDays) {
        const roll = rnd()
        const status = roll < 0.9 ? 'PRESENT' : roll < 0.95 ? 'ABSENT' : roll < 0.99 ? 'SICK' : 'VACATION'
        const r = await tryPost('/attendance/mark', { studentId: s.id, date, status, note: status === 'SICK' ? 'Справка от врача' : undefined })
        if (r) attCount++
      }
    }
  }
  console.log(`  отметок: ${attCount}`)

  // Домашние задания и напоминания родителям
  step('Домашние задания и напоминания')
  let hwCount = 0
  let notified = 0
  for (const [gid, list] of byGroup) {
    const cls = groupNameById.get(gid)
    const pool = subjectsFor(gradeOf(cls))
    for (let k = 0; k < 2; k++) {
      const name = pool[(k * 2 + gradeOf(cls)) % pool.length]
      const title = (HOMEWORK_TITLES[name] ?? ['Домашнее задание'])[k % 2]
      const hw = await tryPost('/homework', {
        subjectId: subj(name)?.id, groupId: gid, title,
        description: `Тема: ${name.toLowerCase()}. Выполнить в тетради, срок — до указанной даты.`,
        dueDate: iso(addDays(now, 2 + k * 3)),
      })
      if (!hw) continue
      hwCount++
      if (k === 0 && (await tryPost(`/homework/${hw.id}/notify-parents`, { studentIds: list.slice(0, 5).map((s) => s.id), template: 'REMINDER' }))) notified++
    }
    await tryPost(`/homeroom/${gid}/notify`, { studentIds: list.slice(0, 3).map((s) => s.id), text: 'Напоминаем: завтра родительское собрание в 17:00, пожалуйста, приходите вовремя.' })
  }
  console.log(`  ДЗ: ${hwCount}, напоминаний по ДЗ: ${notified}`)

  // Родительские собрания
  step('Родительские собрания')
  const haveMeeting = new Set(((await tryGet('/meetings')) ?? []).map((m) => m.title))
  for (const [i, cls] of ['1 А', '5 А', '11 А'].entries()) {
    const g = groupByName.get(cls.toLowerCase())
    const title = `Родительское собрание ${cls} класса`
    if (!g || haveMeeting.has(title)) continue
    await tryPost('/meetings', {
      groupId: g.id, title,
      scheduledAt: new Date(addDays(now, 7 + i * 7).setHours(17, 0, 0, 0)).toISOString(),
      location: `Каб. ${12 + i}`, description: 'Итоги четверти, подготовка к зимним каникулам, вопросы родителей.',
    })
  }

  // Квизы
  step('Квизы')
  const haveQuiz = new Set(((await tryGet('/quizzes')) ?? []).map((q) => q.title))
  let quizCount = 0
  for (const q of QUIZZES) {
    if (haveQuiz.has(q.title)) continue
    const r = await tryPost('/quizzes', {
      title: q.title, description: `Проверьте себя: ${q.subject.toLowerCase()}`, subjectId: subj(q.subject)?.id,
      timeLimitSec: q.timeLimitSec, isPublished: true,
      questions: q.questions.map(([kind, text, options, explanation]) => ({
        kind, text, options: options.map(([t, c]) => ({ text: t, correct: !!c })), explanation: explanation ?? undefined,
      })),
    })
    if (r) quizCount++
  }
  console.log(`  квизов: ${quizCount}`)

  // Материалы библиотеки
  step('Материалы')
  const haveLib = new Set(((await tryGet('/library')) ?? []).map((m) => m.title))
  for (const [title, type, url, subject, gradeNumber] of LIBRARY) {
    if (haveLib.has(title)) continue
    await tryPost('/library', { title, description: 'Материал для самостоятельной работы', type, url, subjectId: subject ? subj(subject)?.id : undefined, gradeNumber: gradeNumber ?? undefined })
  }

  // Чат: родители пишут администрации, администратор отвечает
  step('Чат')
  let chats = 0
  for (const p of parents.slice(0, 4)) {
    try {
      const { accessToken } = await rawLogin(p.email, p.password)
      const sent = await call('POST', '/chat/my/messages', { text: `Здравствуйте! Подскажите, пожалуйста, расписание на следующую неделю у ${p.student.firstName}.`, scope: 'ADMIN' }, { tok: accessToken, quiet: true })
      if (sent) chats++
    } catch {
      /* чат или вход родителя недоступны — переходим дальше */
    }
  }
  const convs = (await tryGet('/chat/conversations')) ?? []
  for (const c of convs.slice(0, 4)) {
    await tryPost(`/chat/conversations/${c.id}/messages`, { text: 'Добрый день! Расписание обновлено в разделе «Расписание», посмотрите, пожалуйста.' })
  }
  console.log(`  обращений родителей: ${chats}, диалогов: ${convs.length}`)

  saveCreds()
  console.log(`\n✔ Готово. Запросов: ${stats.ok} успешно, ${stats.fail} с ошибкой.`)
  console.log(`  Логины и пароли созданных людей: ${OUT}`)
  if (failures.size) {
    console.log('\nОшибки (сгруппированы):')
    for (const [k, n] of failures) console.log(`  ×${n}  ${k}`)
  }
}

async function tryGet(path) {
  try {
    return await get(path)
  } catch {
    return null
  }
}

main().catch((e) => {
  try {
    saveCreds()
  } catch {
    /* ignore */
  }
  console.error(`\n✖ ${e.message}`)
  if (failures.size) for (const [k, n] of failures) console.error(`  ×${n}  ${k}`)
  process.exit(1)
})
