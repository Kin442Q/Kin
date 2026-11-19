import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import type { Prisma } from '@prisma/client'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { ClassAccessService } from '../class-access/class-access.service'
import type { AuthUser } from '../../common/types/jwt-payload'
import { isMonth } from './verdict-dates'
import { ParentVerdictService } from './parent-verdict.service'
import { hasSomethingToSay, renderVerdictText, type VerdictTextInput } from './verdict-text'

type ClassSignals = Awaited<ReturnType<ParentVerdictService['preview']>>
type StudentSignals = ClassSignals['students'][number]

const MAX_TEXT = 4000
const MAX_REASON = 500

const studentSelect = { id: true, firstName: true, lastName: true } as const
const groupSelect = { id: true, name: true, kindergartenId: true, homeroomTeacherId: true } as const

/**
 * Черновики вердиктов и их проверка человеком. Статусы: DRAFT → APPROVED (одобрил классный руководитель
 * или директор) → SENT (публикация — следующий этап); SKIPPED — решили не отправлять.
 * Система сама ничего не одобряет и не отправляет: каждый переход делает человек.
 * Ученик, у которого оценки вне шкалы, вердикт не получает и одобрить его нельзя.
 */
@Injectable()
export class VerdictDraftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ClassAccessService,
    private readonly signals: ParentVerdictService,
  ) {}

  // ── вспомогательное ────────────────────────────────────────────────────────

  private texts(c: ClassSignals, row: StudentSignals) {
    const input: VerdictTextInput = {
      month: c.month,
      asOf: c.asOf,
      studentName: row.student.firstName,
      scaleMax: c.thresholds.scaleMax,
      noGradesDays: c.thresholds.noGradesDays,
      subjects: row.subjects,
      focus: row.focus,
    }
    return { ru: renderVerdictText('ru', input), tg: renderVerdictText('tg', input) }
  }

  /** Поля вердикта, которые считает система (и при создании, и при обновлении черновика). */
  private computedFields(c: ClassSignals, row: StudentSignals) {
    const { ru, tg } = this.texts(c, row)
    return {
      asOf: c.asOf,
      scale: c.scale,
      thresholds: c.thresholds as unknown as Prisma.InputJsonValue,
      signals: {
        subjects: row.subjects,
        focus: row.focus,
        window: c.window,
        journalSilent: c.journalSilent,
        sections: c.sections,
      } as unknown as Prisma.InputJsonValue,
      focusSubjectId: row.focus?.subjectId ?? null,
      draftRu: ru,
      draftTg: tg,
      textRu: ru,
      textTg: tg,
      generatedBy: 'template',
      generatedAt: new Date(),
    }
  }

  private async load(user: AuthUser, id: string) {
    const verdict = await this.prisma.parentVerdict.findUnique({
      where: { id },
      include: { student: { select: studentSelect }, group: { select: groupSelect } },
    })
    if (!verdict) throw new NotFoundException('Вердикт не найден')
    await this.access.assertHomeroomAccess(user, verdict.group)
    return verdict
  }

  private audit(user: AuthUser, action: 'CREATE' | 'UPDATE', entity: string, entityId: string, diff: Prisma.InputJsonValue) {
    return this.prisma.auditLog.create({ data: { actorId: user.sub, action, entity, entityId, diff } })
  }

  /** Ученик сейчас в классе и по нему можно строить вердикт? Возвращает свежий расчёт или причину отказа. */
  private async fresh(user: AuthUser, v: { groupId: string; month: string; studentId: string }, now?: Date) {
    const c = await this.signals.preview(user, v.groupId, v.month, now)
    const row = c.students.find((s) => s.student.id === v.studentId)
    return { c, row }
  }

  private blockedMessage = 'У ученика есть оценки вне шкалы школы: исправьте оценки или шкалу школы, затем обновите черновик'

  // ── создание и обновление черновиков ───────────────────────────────────────

  /**
   * Создаёт черновики для учеников класса за месяц. Повторный вызов безопасен:
   *  - нет вердикта → создаём;
   *  - есть неправленый черновик → пересчитываем (например, добавились оценки);
   *  - правленый черновик, одобренный, отправленный или пропущенный → не трогаем.
   * Ученику без оценок и сигналов вердикт не создаём (нечего сказать), с оценками вне шкалы — тоже.
   */
  async generate(user: AuthUser, groupId: string, month: string, now?: Date) {
    const c = await this.signals.preview(user, groupId, month, now)
    const kindergartenId = c.group.kindergartenId
    if (!kindergartenId) throw new BadRequestException('Класс не привязан к школе')

    const existing = await this.prisma.parentVerdict.findMany({
      where: { groupId, month },
      select: { id: true, studentId: true, status: true, draftRu: true, draftTg: true, textRu: true, textTg: true },
    })
    const byStudent = new Map(existing.map((e) => [e.studentId, e]))

    const creates: Prisma.ParentVerdictCreateManyInput[] = []
    const refreshes: Prisma.PrismaPromise<unknown>[] = []
    let refreshed = 0
    const kept: { studentId: string; reason: 'EDITED' | 'REVIEWED' }[] = []
    const skipped: { studentId: string; reason: 'NO_DATA' }[] = []
    const blocked: { studentId: string; count: number }[] = []

    for (const row of c.students) {
      const studentId = row.student.id
      if (row.blocked) {
        blocked.push({ studentId, count: row.blocked.count })
        continue
      }
      if (!hasSomethingToSay(row)) {
        skipped.push({ studentId, reason: 'NO_DATA' })
        continue
      }
      const fields = this.computedFields(c, row)
      const ex = byStudent.get(studentId)
      if (!ex) {
        creates.push({ ...fields, kindergartenId, groupId, studentId, month })
        continue
      }
      if (ex.status !== 'DRAFT' || ex.textRu !== ex.draftRu || ex.textTg !== ex.draftTg) {
        kept.push({ studentId, reason: ex.status === 'DRAFT' ? 'EDITED' : 'REVIEWED' })
        continue
      }
      // обновляем, только если за это время никто не успел поправить текст или статус
      refreshes.push(
        this.prisma.parentVerdict.updateMany({
          where: { id: ex.id, status: 'DRAFT', textRu: ex.draftRu, textTg: ex.draftTg },
          data: fields,
        }),
      )
      refreshed++
    }

    const created = creates.length
      ? (await this.prisma.parentVerdict.createMany({ data: creates, skipDuplicates: true })).count
      : 0
    if (refreshes.length) await this.prisma.$transaction(refreshes)

    await this.audit(user, 'CREATE', 'ParentVerdictBatch', groupId, {
      month,
      asOf: c.asOf,
      created,
      refreshed,
      kept: kept.length,
      skipped: skipped.length,
      blocked: blocked.length,
    })
    return { group: { id: c.group.id, name: c.group.name }, month, asOf: c.asOf, created, refreshed, kept, skipped, blocked }
  }

  /** Заново считает один черновик: правки учителя пропадают. Только для черновика. */
  async regenerate(user: AuthUser, id: string, now?: Date) {
    const v = await this.load(user, id)
    if (v.status !== 'DRAFT') throw new ConflictException('Обновить можно только черновик')
    const { c, row } = await this.fresh(user, v, now)
    if (!row) throw new ConflictException('Ученика уже нет в этом классе')
    if (row.blocked) throw new ConflictException(this.blockedMessage)
    if (!hasSomethingToSay(row)) throw new ConflictException('Данных для вердикта пока нет')

    const r = await this.prisma.parentVerdict.updateMany({
      where: { id, status: 'DRAFT' },
      data: this.computedFields(c, row),
    })
    if (r.count === 0) throw new ConflictException('Вердикт уже изменён, откройте его заново')
    await this.audit(user, 'UPDATE', 'ParentVerdict', id, { action: 'regenerate', month: v.month })
    return this.get(user, id)
  }

  // ── чтение ─────────────────────────────────────────────────────────────────

  /** Вердикты класса за месяц и ученики, у которых вердикта (ещё) нет. */
  async list(user: AuthUser, groupId: string, month: string) {
    if (!isMonth(month)) throw new BadRequestException('Укажите месяц в формате ГГГГ-ММ')
    const group = await this.prisma.group.findUnique({ where: { id: groupId }, select: groupSelect })
    if (!group) throw new NotFoundException('Класс не найден')
    await this.access.assertHomeroomAccess(user, group)

    const [rows, students] = await Promise.all([
      this.prisma.parentVerdict.findMany({
        where: { groupId, month },
        include: { student: { select: studentSelect } },
        orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
      }),
      this.prisma.student.findMany({
        where: { groupId, status: 'ACTIVE' },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        select: studentSelect,
      }),
    ])
    const have = new Set(rows.map((r) => r.studentId))
    return {
      group: { id: group.id, name: group.name },
      month,
      verdicts: rows.map(({ signals, thresholds: _thresholds, ...r }) => ({
        ...r,
        focus: (signals as { focus?: unknown } | null)?.focus ?? null,
        edited: r.textRu !== r.draftRu || r.textTg !== r.draftTg,
      })),
      withoutVerdict: students.filter((s) => !have.has(s.id)),
    }
  }

  /** Один вердикт целиком, вместе со снимком расчёта: на чём стоит вывод. */
  async get(user: AuthUser, id: string) {
    const { group: _group, ...verdict } = await this.load(user, id)
    return { ...verdict, edited: verdict.textRu !== verdict.draftRu || verdict.textTg !== verdict.draftTg }
  }

  // ── проверка человеком ─────────────────────────────────────────────────────

  async updateText(user: AuthUser, id: string, dto: { textRu?: string; textTg?: string }) {
    const v = await this.load(user, id)
    if (v.status !== 'DRAFT') throw new ConflictException('Править можно только черновик: верните вердикт в черновик')

    const data: { textRu?: string; textTg?: string } = {}
    for (const key of ['textRu', 'textTg'] as const) {
      const value = dto[key]
      if (value === undefined) continue
      const text = value.trim()
      if (!text) throw new BadRequestException('Текст не может быть пустым')
      if (text.length > MAX_TEXT) throw new BadRequestException(`Текст слишком длинный (не больше ${MAX_TEXT} знаков)`)
      data[key] = text
    }
    if (!Object.keys(data).length) throw new BadRequestException('Нечего менять')

    const r = await this.prisma.parentVerdict.updateMany({ where: { id, status: 'DRAFT' }, data })
    if (r.count === 0) throw new ConflictException('Вердикт уже изменён, откройте его заново')

    const before: Record<string, string> = {}
    for (const key of Object.keys(data) as ('textRu' | 'textTg')[]) before[key] = v[key]
    await this.audit(user, 'UPDATE', 'ParentVerdict', id, { action: 'edit', before, after: data })
    return this.get(user, id)
  }

  /** Одобрить: черновик → APPROVED. Только человек; родителю при этом ничего не уходит. */
  async approve(user: AuthUser, id: string, now?: Date) {
    const v = await this.load(user, id)
    if (v.status !== 'DRAFT') throw new ConflictException('Одобрить можно только черновик')
    if (!v.textRu.trim() || !v.textTg.trim()) throw new BadRequestException('Текст не может быть пустым')

    // вердикт на данных с ошибкой не одобряем: оценки вне шкалы школы
    const { row } = await this.fresh(user, v, now)
    if (row?.blocked) throw new ConflictException(this.blockedMessage)

    const r = await this.prisma.parentVerdict.updateMany({
      where: { id, status: 'DRAFT' },
      data: { status: 'APPROVED', reviewedById: user.sub, reviewedAt: new Date(), skipReason: null },
    })
    if (r.count === 0) throw new ConflictException('Вердикт уже изменён, откройте его заново')
    await this.audit(user, 'UPDATE', 'ParentVerdict', id, { action: 'approve', from: 'DRAFT', to: 'APPROVED' })
    return this.get(user, id)
  }

  /** Вернуть в черновик: из «одобрен» или «пропущен». Отправленный вернуть нельзя. */
  async reopen(user: AuthUser, id: string) {
    const v = await this.load(user, id)
    if (v.status !== 'APPROVED' && v.status !== 'SKIPPED') throw new ConflictException('Вернуть в черновик можно одобренный или пропущенный вердикт')
    const r = await this.prisma.parentVerdict.updateMany({
      where: { id, status: { in: ['APPROVED', 'SKIPPED'] } },
      data: { status: 'DRAFT', reviewedById: null, reviewedAt: null, skipReason: null },
    })
    if (r.count === 0) throw new ConflictException('Вердикт уже изменён, откройте его заново')
    await this.audit(user, 'UPDATE', 'ParentVerdict', id, { action: 'reopen', from: v.status, to: 'DRAFT' })
    return this.get(user, id)
  }

  /** Не отправлять родителю в этом месяце (например, тяжёлая ситуация в семье). */
  async skip(user: AuthUser, id: string, reason?: string) {
    const v = await this.load(user, id)
    if (v.status !== 'DRAFT' && v.status !== 'APPROVED') throw new ConflictException('Пропустить можно черновик или одобренный вердикт')
    const why = reason?.trim() || null
    if (why && why.length > MAX_REASON) throw new BadRequestException(`Причина слишком длинная (не больше ${MAX_REASON} знаков)`)
    const r = await this.prisma.parentVerdict.updateMany({
      where: { id, status: { in: ['DRAFT', 'APPROVED'] } },
      data: { status: 'SKIPPED', reviewedById: user.sub, reviewedAt: new Date(), skipReason: why },
    })
    if (r.count === 0) throw new ConflictException('Вердикт уже изменён, откройте его заново')
    await this.audit(user, 'UPDATE', 'ParentVerdict', id, { action: 'skip', from: v.status, to: 'SKIPPED', reason: why })
    return this.get(user, id)
  }
}
