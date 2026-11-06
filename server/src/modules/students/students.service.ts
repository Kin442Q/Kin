import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { Prisma, StudentStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomInt } from 'node:crypto'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { CreateStudentDto, UpdateStudentDto } from './dto/student.dto'
import type { AuthUser } from '../../common/types/jwt-payload'
import { randomPassword, readablePassword } from '../../common/random-password'
import { StudentLinkService } from '../student-links/student-link.service'
import { AccessService, assertNoPassword, requireInviteEmail } from '../access/access.service'

/**
 * Превращает Prisma Decimal/строку/число в чистый number или null
 * для JSON-ответа. Без этого Decimal может сериализоваться как строка
 * и фронт читает плату как "500.00" вместо 500.
 */
function decimalToNumber(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  // Prisma.Decimal — у него есть toString()
  const n = Number(String(v))
  return Number.isFinite(n) ? n : null
}

/** Нормализует студента для ответа: monthlyFee → number/null. */
function normalizeStudent<T extends Record<string, unknown> | null>(s: T): T {
  if (!s) return s
  return { ...s, monthlyFee: decimalToNumber(s.monthlyFee) } as T
}

/** Какие поля аккаунта ученика нужны для выдачи ссылок. */
const ACCOUNT_SELECT = {
  id: true,
  email: true,
  isActive: true,
  lastLoginAt: true,
  linkVersion: true,
  passwordIssuedAt: true,
} as const
type AccountRow = {
  id: string
  email: string
  isActive: boolean
  lastLoginAt: Date | null
  linkVersion: number | null
  passwordIssuedAt: Date | null
}

/** Логин, который вводит ученик: служебный адрес без «@students.local». */
const studentLoginOf = (email?: string | null) => (email ? email.replace(/@students\.local$/i, '') : null)

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name)
  constructor(
    private readonly prisma: PrismaService,
    private readonly links: StudentLinkService,
    private readonly access: AccessService,
  ) {}

  /** Все классы, которые ведёт учитель: основная группа + M:N teachingGroups. */
  private async teacherGroupIds(user: AuthUser): Promise<string[]> {
    const me = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { groupId: true, teachingGroups: { select: { id: true } } },
    })
    return Array.from(
      new Set(
        [me?.groupId, ...(me?.teachingGroups.map((g) => g.id) ?? [])].filter(
          (x): x is string => !!x,
        ),
      ),
    )
  }

  /**
   * Список учеников. TEACHER видит только свою группу.
   * SUPER_ADMIN/ADMIN — все, опционально с фильтром по groupId.
   */
  async findAll(user: AuthUser, params: { groupId?: string; status?: StudentStatus }) {
    const where: Prisma.StudentWhereInput = {}

    // Multi-tenant: фильтр по садику (кроме глобального супер-админа без садика)
    if (user.kindergartenId) {
      where.kindergartenId = user.kindergartenId
    }

    if (user.role === 'TEACHER') {
      const allowed = await this.teacherGroupIds(user)
      if (allowed.length === 0) return []
      where.groupId =
        params.groupId && allowed.includes(params.groupId)
          ? params.groupId
          : { in: allowed }
    } else if (params.groupId) {
      where.groupId = params.groupId
    }
    if (params.status) where.status = params.status

    const list = await this.prisma.student.findMany({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      include: { group: { select: { id: true, name: true, color: true } } },
    })
    return list.map((s) => normalizeStudent(s as any))
  }

  async findOne(id: string, user: AuthUser) {
    const s = await this.prisma.student.findUnique({
      where: { id },
      include: { group: true },
    })
    if (!s) throw new NotFoundException('Ученик не найден')
    await this.assertCanAccess(user, s.groupId, s.kindergartenId)
    return normalizeStudent(s as any)
  }

  async create(dto: CreateStudentDto, user: AuthUser) {
    if (!user.kindergartenId) {
      throw new ForbiddenException('Не привязан к садику')
    }
    // TEACHER может добавлять только в свою группу.
    if (user.role === 'TEACHER') {
      if (!user.groupId) throw new ForbiddenException('Не назначена группа')
      dto.groupId = user.groupId
    }

    // Проверяем что группа принадлежит этому садику
    const group = await this.prisma.group.findUnique({
      where: { id: dto.groupId },
    })
    if (!group) throw new NotFoundException('Группа не найдена')
    if (group.kindergartenId !== user.kindergartenId) {
      throw new ForbiddenException('Группа из другого садика')
    }

    this.logger.log(
      `[students.create] monthlyFee=${dto.monthlyFee} (type ${typeof dto.monthlyFee})`,
    )

    const created = await this.prisma.student.create({
      data: {
        ...dto,
        // Явно конвертируем в number/null, чтобы Prisma корректно
        // записал в колонку Decimal.
        monthlyFee:
          dto.monthlyFee == null || (dto.monthlyFee as unknown) === ''
            ? null
            : Number(dto.monthlyFee),
        birthDate: new Date(dto.birthDate),
        kindergartenId: user.kindergartenId,
      },
    })
    this.logger.log(
      `[students.create] saved id=${created.id} monthlyFee=${created.monthlyFee}`,
    )
    return normalizeStudent(created as any)
  }

  /**
   * Массовое создание учеников (импорт из Excel/фото). Валидирует и создаёт
   * каждую строку отдельно; ошибочные строки не валят весь импорт, а
   * возвращаются в errors[] — пользователь поправит и повторит.
   * Группу можно указать по id (groupId) или по имени (groupName).
   */
  async bulkCreate(
    user: AuthUser,
    items: Array<Partial<CreateStudentDto> & { groupName?: string }>,
  ) {
    if (!user.kindergartenId) {
      throw new ForbiddenException('Не привязан к садику')
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('Список пуст')
    }
    if (items.length > 300) {
      throw new BadRequestException('За один раз можно импортировать до 300 учеников')
    }

    const groups = await this.prisma.group.findMany({
      where: { kindergartenId: user.kindergartenId },
      select: { id: true, name: true },
    })
    const byName = new Map(groups.map((g) => [g.name.trim().toLowerCase(), g.id]))

    const created: unknown[] = []
    const errors: Array<{ row: number; name: string; message: string }> = []

    for (let i = 0; i < items.length; i++) {
      const it = items[i] ?? {}
      const label =
        `${(it.lastName ?? '').trim()} ${(it.firstName ?? '').trim()}`.trim() ||
        `строка ${i + 1}`
      try {
        if (!it.firstName?.trim() || !it.lastName?.trim()) {
          throw new Error('Не указано имя или фамилия')
        }
        const bd = it.birthDate ? new Date(it.birthDate) : null
        if (!bd || Number.isNaN(bd.getTime())) {
          throw new Error('Некорректная дата рождения (нужен формат ГГГГ-ММ-ДД)')
        }

        // Группа: учитель — только своя; иначе по id или по имени.
        let groupId = it.groupId
        if (user.role === 'TEACHER') {
          groupId = user.groupId ?? undefined
        } else if (!groupId && it.groupName) {
          groupId = byName.get(it.groupName.trim().toLowerCase())
        }
        if (!groupId || !groups.some((g) => g.id === groupId)) {
          throw new Error('Группа/класс не найдена в этом учреждении')
        }

        const c = await this.create(
          {
            firstName: it.firstName.trim(),
            lastName: it.lastName.trim(),
            middleName: it.middleName?.trim() || undefined,
            birthDate: it.birthDate!,
            gender: (it.gender as CreateStudentDto['gender']) ?? 'MALE',
            groupId,
            motherName: it.motherName?.trim() || undefined,
            motherPhone: it.motherPhone?.trim() || undefined,
            fatherName: it.fatherName?.trim() || undefined,
            fatherPhone: it.fatherPhone?.trim() || undefined,
            address: it.address?.trim() || undefined,
            notes: it.notes?.trim() || undefined,
            monthlyFee:
              it.monthlyFee == null || (it.monthlyFee as unknown) === ''
                ? null
                : Number(it.monthlyFee),
          },
          user,
        )
        created.push(c)
      } catch (e) {
        errors.push({
          row: i,
          name: label,
          message: e instanceof Error ? e.message : String(e),
        })
      }
    }

    return {
      createdCount: created.length,
      errorCount: errors.length,
      created,
      errors,
    }
  }

  /**
   * Распознать учеников с фото списка через Claude Vision (Anthropic API).
   * Возвращает массив черновиков — БЕЗ записи в БД (пользователь правит и
   * подтверждает на фронте). Требует ANTHROPIC_API_KEY в окружении.
   */
  async scanFromImage(user: AuthUser, image: string) {
    if (!user.kindergartenId) {
      throw new ForbiddenException('Не привязан к садику')
    }
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new BadRequestException(
        'AI-распознавание не настроено: задайте ANTHROPIC_API_KEY на сервере',
      )
    }
    if (!image) throw new BadRequestException('Нет изображения')

    // Принимаем data-URL (data:image/jpeg;base64,...) или чистый base64.
    const m = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
    const mediaType = m ? m[1] : 'image/jpeg'
    const data = m ? m[2] : image

    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'
    const prompt =
      'На фото — список детей/учеников (печатный или рукописный). ' +
      'Извлеки всех и верни ТОЛЬКО JSON-массив без markdown. ' +
      'Каждый элемент: {"lastName","firstName","middleName","birthDate","gender","groupName","motherName","motherPhone","fatherName","fatherPhone"}. ' +
      'birthDate в формате ГГГГ-ММ-ДД или null если не видно. gender — "MALE"/"FEMALE"/null. ' +
      'Телефоны как на фото. Поля, которых нет, ставь null. Если список пуст — верни [].'

    let resp: Response
    try {
      resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
                { type: 'text', text: prompt },
              ],
            },
          ],
        }),
      })
    } catch (e) {
      throw new BadRequestException(
        'Не удалось обратиться к сервису распознавания: ' +
          (e instanceof Error ? e.message : String(e)),
      )
    }

    if (!resp.ok) {
      const body = await resp.text().catch(() => '')
      this.logger.error(`[students.scan] Anthropic ${resp.status}: ${body}`)
      throw new BadRequestException(
        `Сервис распознавания вернул ошибку (${resp.status})`,
      )
    }

    const json = (await resp.json()) as {
      content?: Array<{ type: string; text?: string }>
    }
    const text = json.content?.find((c) => c.type === 'text')?.text ?? '[]'
    // Вырезаем JSON-массив из ответа (на случай лишнего текста/markdown).
    const start = text.indexOf('[')
    const end = text.lastIndexOf(']')
    let items: unknown = []
    try {
      items = start >= 0 && end > start ? JSON.parse(text.slice(start, end + 1)) : []
    } catch {
      throw new BadRequestException('Не удалось разобрать ответ распознавания')
    }
    return { items: Array.isArray(items) ? items : [] }
  }

  async update(id: string, dto: UpdateStudentDto, user: AuthUser) {
    const existing = await this.prisma.student.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Ученик не найден')
    await this.assertCanAccess(user, existing.groupId, existing.kindergartenId)

    // Учитель не может перевести ребёнка в другую группу.
    if (user.role === 'TEACHER' && dto.groupId && dto.groupId !== existing.groupId) {
      throw new ForbiddenException('Нельзя сменить группу')
    }

    this.logger.log(
      `[students.update] id=${id} monthlyFee=${dto.monthlyFee} (type ${typeof dto.monthlyFee})`,
    )

    // Если в dto явно прислан monthlyFee — нормализуем в number/null.
    // Если поля нет — не трогаем.
    const updateData: Prisma.StudentUpdateInput = {
      ...dto,
      birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'monthlyFee')) {
      const f = dto.monthlyFee
      updateData.monthlyFee =
        f == null || (f as unknown) === '' ? null : Number(f)
    }

    const updated = await this.prisma.student.update({
      where: { id },
      data: updateData,
    })
    this.logger.log(
      `[students.update] saved id=${updated.id} monthlyFee=${updated.monthlyFee}`,
    )
    return normalizeStudent(updated as any)
  }

  async archive(id: string, user: AuthUser) {
    const s = await this.prisma.student.findUnique({ where: { id } })
    if (!s) throw new NotFoundException('Ученик не найден')
    await this.assertCanAccess(user, s.groupId, s.kindergartenId)
    return this.prisma.student.update({
      where: { id },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    })
  }

  async remove(id: string, user: AuthUser) {
    const s = await this.prisma.student.findUnique({ where: { id } })
    if (!s) throw new NotFoundException('Ученик не найден')
    await this.assertCanAccess(user, s.groupId, s.kindergartenId)
    await this.prisma.student.delete({ where: { id } })
  }

  // -------------------------------------------------------
  private async assertCanAccess(
    user: AuthUser,
    studentGroupId: string,
    studentKindergartenId?: string | null,
  ) {
    if (user.kindergartenId && studentKindergartenId !== user.kindergartenId) {
      throw new ForbiddenException('Ученик из другого садика')
    }
    if (
      user.role === 'TEACHER' &&
      !(await this.teacherGroupIds(user)).includes(studentGroupId)
    ) {
      throw new ForbiddenException('Ученик не из ваших классов')
    }
  }

  // ─── Родительские аккаунты ученика ──────────────────────────────────

  async listParents(studentId: string, user: AuthUser) {
    const s = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        parents: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            isActive: true,
            lastLoginAt: true,
          },
        },
      },
    })
    if (!s) throw new NotFoundException('Ученик не найден')
    await this.assertCanAccess(user, s.groupId, s.kindergartenId)
    return s.parents
  }

  async addParent(
    studentId: string,
    dto: {
      fullName?: string
      /** Обязателен при создании нового родителя: на него приходит приглашение со ссылкой для пароля */
      email?: string
      phone?: string
      existingUserId?: string
    },
    user: AuthUser,
  ) {
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Только администратор может управлять родителями')
    }
    assertNoPassword(dto)
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    })
    if (!student) throw new NotFoundException('Ученик не найден')
    await this.assertCanAccess(user, student.groupId, student.kindergartenId)

    // Вариант 1: привязать существующего родителя
    if (dto.existingUserId) {
      const existing = await this.prisma.user.findUnique({
        where: { id: dto.existingUserId },
      })
      if (!existing) throw new NotFoundException('Пользователь не найден')
      if (existing.role !== 'PARENT') {
        throw new BadRequestException(
          'Этот пользователь не родитель — нельзя привязать к ученику',
        )
      }
      if (
        user.kindergartenId &&
        existing.kindergartenId &&
        existing.kindergartenId !== user.kindergartenId
      ) {
        throw new ForbiddenException('Родитель из другого учреждения')
      }
      await this.prisma.student.update({
        where: { id: studentId },
        data: { parents: { connect: { id: existing.id } } },
      })
      return this.serializeParent(existing)
    }

    // Вариант 2: создать новый аккаунт-родителя и привязать
    if (!dto.fullName?.trim()) {
      throw new BadRequestException('ФИО родителя обязательно')
    }
    // Доступ только письмом: без настоящей почты родителя не создаём.
    const email = requireInviteEmail(dto.email)
    const existing = await this.prisma.user.findUnique({ where: { email } })
    if (existing) {
      throw new ConflictException('Email уже используется')
    }

    // Пароль админ не вводит и не видит: родитель задаёт его сам по ссылке из письма.
    const secret = await this.access.newSecret()

    const created = await this.prisma.user.create({
      data: {
        email,
        passwordHash: secret.hash,
        fullName: dto.fullName.trim(),
        phone: dto.phone?.trim() || null,
        role: 'PARENT',
        kindergartenId: user.kindergartenId,
        // Сохраняем «основного ребёнка» для обратной совместимости с childId.
        childId: studentId,
        isActive: true,
      },
    })

    // Привязываем M:N связь
    await this.prisma.student.update({
      where: { id: studentId },
      data: { parents: { connect: { id: created.id } } },
    })

    const access = await this.access.deliver(created)
    return { ...this.serializeParent(created), access }
  }

  async removeParent(studentId: string, parentId: string, user: AuthUser) {
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException()
    }
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    })
    if (!student) throw new NotFoundException('Ученик не найден')
    await this.assertCanAccess(user, student.groupId, student.kindergartenId)

    await this.prisma.student.update({
      where: { id: studentId },
      data: { parents: { disconnect: { id: parentId } } },
    })

    // Если у родителя был только этот ребёнок в childId — сбросим
    const parent = await this.prisma.user.findUnique({
      where: { id: parentId },
      select: { childId: true },
    })
    if (parent?.childId === studentId) {
      await this.prisma.user.update({
        where: { id: parentId },
        data: { childId: null },
      })
    }
  }

  // ─── Доступ ученика: личная ссылка и логин с паролем ────────────────
  // У учеников нет почты: классный руководитель (или админ школы) выдаёт личную
  // ссылку (или логин и пароль, см. ниже), по ним ученик попадает в свой кабинет. Ссылка
  // подписана (HMAC от id аккаунта и версии) и нигде не хранится, поэтому её
  // можно показать снова; перевыпуск увеличивает версию и убивает старую.

  /**
   * Доступ ученику выдают админ школы или классный руководитель его класса.
   * Возвращает ученика вместе с текущим аккаунтом (если есть).
   */
  private async studentForAccount(studentId: string, user: AuthUser) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        status: true,
        kindergartenId: true,
        group: { select: { homeroomTeacherId: true } },
        account: { select: ACCOUNT_SELECT },
      },
    })
    if (!student) throw new NotFoundException('Ученик не найден')
    if (user.kindergartenId && student.kindergartenId !== user.kindergartenId) {
      throw new ForbiddenException('Ученик из другой школы')
    }
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'
    const isHomeroom = user.role === 'TEACHER' && student.group.homeroomTeacherId === user.sub
    if (!isAdmin && !isHomeroom) {
      throw new ForbiddenException('Доступ ученику выдаёт администратор или классный руководитель')
    }
    return student
  }

  private serializeAccount(a: AccountRow) {
    return {
      id: a.id,
      isActive: a.isActive,
      lastLoginAt: a.lastLoginAt,
      link: a.linkVersion ? this.links.link(a.id, a.linkVersion) : null,
      /** Логин для входа вместе с паролем, который выдаёт классный руководитель */
      login: studentLoginOf(a.email),
      /** Пароль выдан (сам пароль не хранится в открытом виде и больше не показывается) */
      passwordIssued: a.passwordIssuedAt != null,
    }
  }

  /** Служебный логин аккаунта (вводить его не нужно): email-вида, уникальный. */
  private async uniqueStudentLogin() {
    const chars = '0123456789abcdefghjkmnpqrstuvwxyz'
    for (let attempt = 0; attempt < 10; attempt++) {
      const suffix = Array.from({ length: 6 }, () => chars[randomInt(chars.length)]).join('')
      const login = `st${suffix}@students.local`
      if (!(await this.prisma.user.findUnique({ where: { email: login } }))) return login
    }
    throw new ConflictException('Не удалось подобрать свободный логин, попробуйте ещё раз')
  }

  async getAccount(studentId: string, user: AuthUser) {
    const s = await this.studentForAccount(studentId, user)
    return s.account ? this.serializeAccount(s.account) : null
  }

  /**
   * Выдать ссылку: создаёт аккаунт, если его нет; если аккаунт есть без ссылки —
   * выдаёт её; если ссылка уже есть — просто возвращает (повторный вызов безопасен).
   */
  async createAccount(studentId: string, user: AuthUser) {
    const s = await this.studentForAccount(studentId, user)
    if (s.status !== 'ACTIVE') {
      throw new BadRequestException('Доступ можно выдать только действующему ученику')
    }
    return this.serializeAccount(await this.ensureLink(s))
  }

  private async ensureLink(s: {
    id: string
    firstName: string
    lastName: string
    kindergartenId: string | null
    account: AccountRow | null
  }): Promise<AccountRow> {
    if (s.account) {
      if (s.account.linkVersion) return s.account
      return this.prisma.user.update({
        where: { id: s.account.id },
        data: { linkVersion: 1, isActive: true },
        select: ACCOUNT_SELECT,
      })
    }
    return this.prisma.user.create({
      data: {
        email: await this.uniqueStudentLogin(),
        // пароль случайный и никому не известен: вход ученика только по ссылке
        passwordHash: await bcrypt.hash(randomPassword(24), 10),
        fullName: `${s.firstName} ${s.lastName}`.trim(),
        role: 'STUDENT',
        studentId: s.id,
        kindergartenId: s.kindergartenId,
        isActive: true,
        linkVersion: 1,
      },
      select: ACCOUNT_SELECT,
    })
  }

  /** Перевыпустить ссылку: старая сразу перестаёт работать, сессии ученика закрываются. */
  async regenerateLink(studentId: string, user: AuthUser) {
    const s = await this.studentForAccount(studentId, user)
    if (!s.account) throw new NotFoundException('У ученика нет доступа — сначала выдайте ссылку')
    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: s.account.id },
        data: { linkVersion: (s.account.linkVersion ?? 0) + 1, isActive: true },
        select: ACCOUNT_SELECT,
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: s.account.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ])
    return this.serializeAccount(updated)
  }

  /** Отобрать доступ: аккаунт удаляется, ученик и его данные остаются. */
  async removeAccount(studentId: string, user: AuthUser) {
    const s = await this.studentForAccount(studentId, user)
    if (!s.account) return
    await this.prisma.user.delete({ where: { id: s.account.id } })
  }

  // ── Логин и пароль ученика ──
  // Вторая возможность рядом со ссылкой и QR: классный руководитель выдаёт логин и пароль.
  // Пароль создаёт система (его никто не придумывает вручную), показывается один раз и хранится
  // только в виде хэша; новый пароль закрывает старые сессии ученика.

  private async setStudentPassword(userId: string, password: string): Promise<AccountRow> {
    const passwordHash = await bcrypt.hash(password, 10)
    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash, passwordIssuedAt: new Date(), isActive: true, mustChangePassword: false },
        select: ACCOUNT_SELECT,
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ])
    return updated
  }

  /** Выдать (или выдать заново) логин и пароль. Пароль есть только в этом ответе. */
  async issuePassword(studentId: string, user: AuthUser) {
    const s = await this.studentForAccount(studentId, user)
    if (s.status !== 'ACTIVE') {
      throw new BadRequestException('Доступ можно выдать только действующему ученику')
    }
    const account = s.account ?? (await this.ensureLink(s))
    const password = readablePassword()
    const updated = await this.setStudentPassword(account.id, password)
    return { ...this.serializeAccount(updated), password }
  }

  /** Забрать пароль: вход только по ссылке, старый пароль больше не подходит. */
  async revokePassword(studentId: string, user: AuthUser) {
    const s = await this.studentForAccount(studentId, user)
    if (!s.account) throw new NotFoundException('У ученика нет доступа')
    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: s.account.id },
        data: { passwordHash: await bcrypt.hash(randomPassword(24), 10), passwordIssuedAt: null },
        select: ACCOUNT_SELECT,
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: s.account.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ])
    return this.serializeAccount(updated)
  }

  /**
   * Выдать логины и пароли всему классу (для печати карточек). По умолчанию — только тем, у кого
   * пароля ещё нет: так не ломаются уже выданные. С onlyMissing = false пароли выдаются заново всем.
   * Пароль в ответе есть только у тех, кому он выдан сейчас.
   */
  async issueClassPasswords(groupId: string | undefined, onlyMissing: boolean, user: AuthUser) {
    const group = await this.groupForLinks(groupId, user)
    const students = await this.activeStudentsWithAccount(group.id)
    const out: Array<{
      studentId: string
      firstName: string
      lastName: string
      login: string | null
      passwordIssued: boolean
      password: string | null
    }> = []
    for (const s of students) {
      const base = { studentId: s.id, firstName: s.firstName, lastName: s.lastName }
      if (s.account?.passwordIssuedAt && onlyMissing) {
        out.push({ ...base, login: studentLoginOf(s.account.email), passwordIssued: true, password: null })
        continue
      }
      const account = s.account ?? (await this.ensureLink(s))
      const password = readablePassword()
      const updated = await this.setStudentPassword(account.id, password)
      out.push({ ...base, login: studentLoginOf(updated.email), passwordIssued: true, password })
    }
    return { group: { id: group.id, name: group.name }, students: out }
  }

  // ── Ссылки класса (для печати карточек) ──

  private async groupForLinks(groupId: string | undefined, user: AuthUser) {
    if (!groupId) throw new BadRequestException('Укажите класс (groupId)')
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true, name: true, kindergartenId: true, homeroomTeacherId: true },
    })
    if (!group) throw new NotFoundException('Класс не найден')
    if (user.kindergartenId && group.kindergartenId !== user.kindergartenId) {
      throw new ForbiddenException('Класс из другой школы')
    }
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'
    const isHomeroom = user.role === 'TEACHER' && group.homeroomTeacherId === user.sub
    if (!isAdmin && !isHomeroom) {
      throw new ForbiddenException('Ссылки класса выдаёт администратор или классный руководитель')
    }
    return group
  }

  private activeStudentsWithAccount(groupId: string) {
    return this.prisma.student.findMany({
      where: { groupId, status: 'ACTIVE' },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        kindergartenId: true,
        account: { select: ACCOUNT_SELECT },
      },
    })
  }

  /** Ученики класса со ссылками (null — ссылка ещё не выдана). */
  async classLinks(groupId: string | undefined, user: AuthUser) {
    const group = await this.groupForLinks(groupId, user)
    const students = await this.activeStudentsWithAccount(group.id)
    return {
      group: { id: group.id, name: group.name },
      students: students.map((s) => ({
        studentId: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        lastLoginAt: s.account?.lastLoginAt ?? null,
        link: s.account?.linkVersion ? this.links.link(s.account.id, s.account.linkVersion) : null,
        login: studentLoginOf(s.account?.email),
        passwordIssued: s.account?.passwordIssuedAt != null,
      })),
    }
  }

  /** Выдать ссылки всем ученикам класса, у кого их ещё нет, и вернуть полный список. */
  async issueClassLinks(groupId: string | undefined, user: AuthUser) {
    const group = await this.groupForLinks(groupId, user)
    const students = await this.activeStudentsWithAccount(group.id)
    for (const s of students) {
      if (!s.account?.linkVersion) await this.ensureLink(s)
    }
    return this.classLinks(group.id, user)
  }

  private serializeParent(u: {
    id: string
    fullName: string
    email: string
    phone: string | null
    isActive: boolean
  }) {
    return {
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      phone: u.phone,
      isActive: u.isActive,
    }
  }
}
