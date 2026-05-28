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
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { CreateStudentDto, UpdateStudentDto } from './dto/student.dto'
import type { AuthUser } from '../../common/types/jwt-payload'

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

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name)
  constructor(private readonly prisma: PrismaService) {}

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
      email?: string
      phone?: string
      password?: string
      existingUserId?: string
    },
    user: AuthUser,
  ) {
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Только администратор может управлять родителями')
    }
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
    if (!dto.email?.trim() && !dto.phone?.trim()) {
      throw new BadRequestException('Нужен email или телефон')
    }
    if (!dto.password || dto.password.length < 6) {
      throw new BadRequestException('Пароль минимум 6 символов')
    }

    const email = dto.email
      ? dto.email.trim().toLowerCase()
      : `parent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@no-email.local`
    const existing = await this.prisma.user.findUnique({ where: { email } })
    if (existing) {
      throw new ConflictException('Email уже используется')
    }

    const passwordHash = await bcrypt.hash(dto.password, 10)

    const created = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
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

    return this.serializeParent(created)
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
