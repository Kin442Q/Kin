import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'

import { VerdictDraftsService } from './verdict-drafts.service'
import type { ParentVerdictService } from './parent-verdict.service'
import type { ClassAccessService } from '../class-access/class-access.service'
import type { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { computeVerdictSignals } from './verdict-rules'
import { thresholdsFor } from './verdict-scale'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'
import type { AuthUser } from '../../common/types/jwt-payload'

const teacher: AuthUser = { sub: 't1', email: 't@s.tj', role: 'TEACHER', kindergartenId: 'k1', groupId: null, childId: null }
const NOW = new Date('2026-11-18T08:00:00Z')
const GROUP = { id: 'g1', name: '5А', kindergartenId: 'k1', homeroomTeacherId: 't1' }
const NAMES: Record<string, { firstName: string; lastName: string }> = {
  s1: { firstName: 'Алишер', lastName: 'Каримов' },
  s2: { firstName: 'Мадина', lastName: 'Расулова' },
  s3: { firstName: 'Рустам', lastName: 'Содиқов' },
}

/** Настоящий расчёт правил для трёх учеников: s1 — слабая математика, s2 — данных нет, s3 — оценка вне шкалы. */
function classSignals(over: { kindergartenId?: string | null } = {}) {
  const t = thresholdsFor('FIVE')
  const rules = computeVerdictSignals({
    month: '2026-10', asOf: '2026-10-31', scale: 'FIVE', thresholds: t,
    subjects: [{ id: 'math', name: 'Математика' }],
    students: [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
    grades: [
      ...[3, 3, 2, 4].map((value, i) => ({ studentId: 's1', subjectId: 'math', value, date: `2026-10-0${i + 1}` })),
      { studentId: 's3', subjectId: 'math', value: 7, date: '2026-10-02' },
    ],
    attendance: [], schedule: [], terms: [], homework: [],
    sections: { attendance: true, schedule: true, homework: true },
  })
  return {
    group: { id: 'g1', name: '5А', kindergartenId: over.kindergartenId === undefined ? 'k1' : over.kindergartenId },
    month: '2026-10', asOf: '2026-10-31', scale: 'FIVE' as const, thresholds: t, configIgnored: false,
    sections: { attendance: true, schedule: true, homework: true },
    window: rules.window, journalSilent: rules.journalSilent, blockedStudents: rules.blockedStudents,
    students: rules.students.map(({ studentId, ...rest }) => ({ student: { id: studentId, ...NAMES[studentId] }, ...rest })),
  }
}

const baseVerdict = (over: Record<string, unknown> = {}) => ({
  id: 'v1', kindergartenId: 'k1', groupId: 'g1', studentId: 's1', month: '2026-10', asOf: '2026-10-31',
  status: 'DRAFT', scale: 'FIVE', thresholds: {}, signals: { focus: null }, focusSubjectId: 'math',
  draftRu: 'черновик ru', draftTg: 'черновик tg', textRu: 'черновик ru', textTg: 'черновик tg',
  generatedBy: 'template', generatedAt: new Date(), reviewedById: null, reviewedAt: null, skipReason: null, sentAt: null,
  createdAt: new Date(), updatedAt: new Date(),
  student: { id: 's1', ...NAMES.s1 },
  group: GROUP,
  ...over,
})

describe('VerdictDraftsService', () => {
  let prisma: PrismaMock
  let access: { assertHomeroomAccess: jest.Mock }
  let signals: { preview: jest.Mock }
  let service: VerdictDraftsService

  beforeEach(() => {
    prisma = createPrismaMock()
    access = { assertHomeroomAccess: jest.fn().mockResolvedValue(undefined) }
    signals = { preview: jest.fn().mockResolvedValue(classSignals()) }
    service = new VerdictDraftsService(
      prisma as unknown as PrismaService,
      access as unknown as ClassAccessService,
      signals as unknown as ParentVerdictService,
    )
    prisma.parentVerdict.findMany.mockResolvedValue([])
    prisma.parentVerdict.createMany.mockImplementation(async ({ data }: { data: unknown[] }) => ({ count: data.length }))
    prisma.parentVerdict.updateMany.mockResolvedValue({ count: 1 })
    prisma.parentVerdict.findUnique.mockResolvedValue(baseVerdict())
  })

  describe('generate', () => {
    it('создаёт черновик только тому, кому есть что сказать; остальные — в отчёте с причиной', async () => {
      const r = await service.generate(teacher, 'g1', '2026-10', NOW)
      expect(signals.preview).toHaveBeenCalledWith(teacher, 'g1', '2026-10', NOW)
      expect(r).toMatchObject({
        created: 1, refreshed: 0, kept: [],
        skipped: [{ studentId: 's2', reason: 'NO_DATA' }],
        blocked: [{ studentId: 's3', count: 1 }],
      })
      const { data } = prisma.parentVerdict.createMany.mock.calls[0][0]
      expect(data).toHaveLength(1)
      expect(data[0]).toMatchObject({
        kindergartenId: 'k1', groupId: 'g1', studentId: 's1', month: '2026-10', asOf: '2026-10-31', scale: 'FIVE',
        focusSubjectId: 'math', generatedBy: 'template',
      })
      // статус не задаём: по умолчанию DRAFT, родителю ничего не уходит
      expect(data[0]).not.toHaveProperty('status')
      expect(prisma.parentVerdict.createMany.mock.calls[0][0].skipDuplicates).toBe(true)
    })

    it('тексты на обоих языках, итоговый текст сначала равен черновику, снимок расчёта сохранён', async () => {
      await service.generate(teacher, 'g1', '2026-10', NOW)
      const row = prisma.parentVerdict.createMany.mock.calls[0][0].data[0]
      expect(row.draftRu).toContain('Итоги за октябрь: Алишер')
      expect(row.draftRu).toContain('«Математика»')
      expect(row.draftTg).toContain('Натиҷаҳои моҳи октябр: Алишер')
      expect(row.textRu).toBe(row.draftRu)
      expect(row.textTg).toBe(row.draftTg)
      expect(row.signals.subjects[0].signals[0]).toMatchObject({ code: 'WEAK', subjectId: 'math' })
      expect(row.signals.focus.subjectId).toBe('math')
      expect(row.thresholds).toMatchObject({ scaleMax: 5, weakAverage: 3.5 })
    })

    it('в снимке и текстах нет ни места в классе, ни данных других учеников', async () => {
      await service.generate(teacher, 'g1', '2026-10', NOW)
      const row = prisma.parentVerdict.createMany.mock.calls[0][0].data[0]
      const everything = JSON.stringify(row)
      expect(everything).not.toMatch(/Расулова|Мадина|Содиқов|Рустам|rank|рейтинг/i)
    })

    it('повторный вызов обновляет неправленый черновик и не создаёт дубль', async () => {
      prisma.parentVerdict.findMany.mockResolvedValue([
        { id: 'v1', studentId: 's1', status: 'DRAFT', draftRu: 'a', draftTg: 'b', textRu: 'a', textTg: 'b' },
      ])
      const r = await service.generate(teacher, 'g1', '2026-10', NOW)
      expect(r).toMatchObject({ created: 0, refreshed: 1 })
      expect(prisma.parentVerdict.createMany).not.toHaveBeenCalled()
      const call = prisma.parentVerdict.updateMany.mock.calls[0][0]
      // обновляем, только если никто не успел поправить текст или статус
      expect(call.where).toEqual({ id: 'v1', status: 'DRAFT', textRu: 'a', textTg: 'b' })
      expect(call.data.draftRu).toContain('Алишер')
      expect(call.data).not.toHaveProperty('status')
    })

    it.each([
      ['правленый черновик', { status: 'DRAFT', textRu: 'правка учителя' }, 'EDITED'],
      ['одобренный', { status: 'APPROVED' }, 'REVIEWED'],
      ['пропущенный', { status: 'SKIPPED' }, 'REVIEWED'],
      ['отправленный', { status: 'SENT' }, 'REVIEWED'],
    ])('%s не трогаем', async (_name, patch, reason) => {
      prisma.parentVerdict.findMany.mockResolvedValue([
        { id: 'v1', studentId: 's1', draftRu: 'a', draftTg: 'b', textRu: 'a', textTg: 'b', ...patch },
      ])
      const r = await service.generate(teacher, 'g1', '2026-10', NOW)
      expect(r.kept).toEqual([{ studentId: 's1', reason }])
      expect(r.created).toBe(0)
      expect(prisma.parentVerdict.updateMany).not.toHaveBeenCalled()
      expect(prisma.parentVerdict.createMany).not.toHaveBeenCalled()
    })

    it('пишет в журнал действий итог пакета', async () => {
      await service.generate(teacher, 'g1', '2026-10', NOW)
      expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
        actorId: 't1', action: 'CREATE', entity: 'ParentVerdictBatch', entityId: 'g1',
        diff: { month: '2026-10', created: 1, refreshed: 0, kept: 0, skipped: 1, blocked: 1 },
      })
    })

    it('нет доступа к классу — ошибка до любой записи', async () => {
      signals.preview.mockRejectedValue(new ForbiddenException('Только классный руководитель этого класса'))
      await expect(service.generate(teacher, 'g1', '2026-10', NOW)).rejects.toBeInstanceOf(ForbiddenException)
      expect(prisma.parentVerdict.createMany).not.toHaveBeenCalled()
      expect(prisma.auditLog.create).not.toHaveBeenCalled()
    })

    it('класс без школы — 400', async () => {
      signals.preview.mockResolvedValue(classSignals({ kindergartenId: null }))
      await expect(service.generate(teacher, 'g1', '2026-10', NOW)).rejects.toBeInstanceOf(BadRequestException)
    })
  })

  describe('list / get', () => {
    it('список: вердикты с признаком «правлен» и ученики без вердикта', async () => {
      prisma.group.findUnique.mockResolvedValue(GROUP)
      prisma.parentVerdict.findMany.mockResolvedValue([
        baseVerdict({ textRu: 'правка', signals: { focus: { subjectId: 'math', subjectName: 'Математика' } } }),
      ])
      prisma.student.findMany.mockResolvedValue([{ id: 's1', ...NAMES.s1 }, { id: 's2', ...NAMES.s2 }])
      const r = await service.list(teacher, 'g1', '2026-10')
      expect(access.assertHomeroomAccess).toHaveBeenCalledWith(teacher, GROUP)
      expect(prisma.parentVerdict.findMany.mock.calls[0][0].where).toEqual({ groupId: 'g1', month: '2026-10' })
      expect(r.verdicts).toHaveLength(1)
      expect(r.verdicts[0]).toMatchObject({ id: 'v1', edited: true, focus: { subjectId: 'math' } })
      // тяжёлые поля расчёта в списке не отдаём
      expect(r.verdicts[0]).not.toHaveProperty('signals')
      expect(r.verdicts[0]).not.toHaveProperty('thresholds')
      expect(r.withoutVerdict).toEqual([{ id: 's2', ...NAMES.s2 }])
    })

    it('список: неверный месяц — 400, нет класса — 404, чужой класс — отказ', async () => {
      await expect(service.list(teacher, 'g1', 'x')).rejects.toBeInstanceOf(BadRequestException)
      prisma.group.findUnique.mockResolvedValue(null)
      await expect(service.list(teacher, 'g1', '2026-10')).rejects.toBeInstanceOf(NotFoundException)
      prisma.group.findUnique.mockResolvedValue(GROUP)
      access.assertHomeroomAccess.mockRejectedValue(new ForbiddenException('Это не ваш класс'))
      await expect(service.list(teacher, 'g1', '2026-10')).rejects.toBeInstanceOf(ForbiddenException)
      expect(prisma.parentVerdict.findMany).not.toHaveBeenCalled()
    })

    it('один вердикт: со снимком расчёта, без служебной связи с классом; доступ проверяется по классу вердикта', async () => {
      const r = await service.get(teacher, 'v1')
      expect(access.assertHomeroomAccess).toHaveBeenCalledWith(teacher, GROUP)
      expect(r).toMatchObject({ id: 'v1', edited: false })
      expect(r).toHaveProperty('signals')
      expect(r).not.toHaveProperty('group')
    })

    it('нет вердикта — 404; чужой — отказ', async () => {
      prisma.parentVerdict.findUnique.mockResolvedValue(null)
      await expect(service.get(teacher, 'nope')).rejects.toBeInstanceOf(NotFoundException)
      prisma.parentVerdict.findUnique.mockResolvedValue(baseVerdict())
      access.assertHomeroomAccess.mockRejectedValue(new ForbiddenException('Это не ваш класс'))
      await expect(service.get(teacher, 'v1')).rejects.toBeInstanceOf(ForbiddenException)
    })
  })

  describe('updateText', () => {
    it('правит текст черновика, пишет «было / стало» в журнал', async () => {
      await service.updateText(teacher, 'v1', { textRu: '  Новый текст  ' })
      expect(prisma.parentVerdict.updateMany).toHaveBeenCalledWith({
        where: { id: 'v1', status: 'DRAFT' },
        data: { textRu: 'Новый текст' },
      })
      expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
        actorId: 't1', entity: 'ParentVerdict', entityId: 'v1',
        diff: { action: 'edit', before: { textRu: 'черновик ru' }, after: { textRu: 'Новый текст' } },
      })
    })

    it('черновик на других языках не трогается, если поле не передано', async () => {
      await service.updateText(teacher, 'v1', { textTg: 'Матни нав' })
      expect(prisma.parentVerdict.updateMany.mock.calls[0][0].data).toEqual({ textTg: 'Матни нав' })
    })

    it.each(['APPROVED', 'SKIPPED', 'SENT'])('в статусе %s править нельзя', async (status) => {
      prisma.parentVerdict.findUnique.mockResolvedValue(baseVerdict({ status }))
      await expect(service.updateText(teacher, 'v1', { textRu: 'x' })).rejects.toBeInstanceOf(ConflictException)
      expect(prisma.parentVerdict.updateMany).not.toHaveBeenCalled()
    })

    it('пустой, слишком длинный текст и «нечего менять» — 400', async () => {
      await expect(service.updateText(teacher, 'v1', { textRu: '   ' })).rejects.toBeInstanceOf(BadRequestException)
      await expect(service.updateText(teacher, 'v1', { textRu: 'я'.repeat(4001) })).rejects.toBeInstanceOf(BadRequestException)
      await expect(service.updateText(teacher, 'v1', {})).rejects.toBeInstanceOf(BadRequestException)
      expect(prisma.parentVerdict.updateMany).not.toHaveBeenCalled()
    })

    it('статус успели сменить, пока правили, — 409, ничего не записано в журнал', async () => {
      prisma.parentVerdict.updateMany.mockResolvedValue({ count: 0 })
      await expect(service.updateText(teacher, 'v1', { textRu: 'x' })).rejects.toBeInstanceOf(ConflictException)
      expect(prisma.auditLog.create).not.toHaveBeenCalled()
    })

    it('чужой класс — отказ, записи нет', async () => {
      access.assertHomeroomAccess.mockRejectedValue(new ForbiddenException('Это не ваш класс'))
      await expect(service.updateText(teacher, 'v1', { textRu: 'x' })).rejects.toBeInstanceOf(ForbiddenException)
      expect(prisma.parentVerdict.updateMany).not.toHaveBeenCalled()
    })
  })

  describe('approve', () => {
    it('черновик → одобрен: кто и когда, только из DRAFT, родителю ничего не уходит', async () => {
      await service.approve(teacher, 'v1', NOW)
      const call = prisma.parentVerdict.updateMany.mock.calls[0][0]
      expect(call.where).toEqual({ id: 'v1', status: 'DRAFT' })
      expect(call.data).toMatchObject({ status: 'APPROVED', reviewedById: 't1', skipReason: null })
      expect(call.data.reviewedAt).toBeInstanceOf(Date)
      // статус SENT и время отправки здесь не ставятся
      expect(call.data).not.toHaveProperty('sentAt')
      expect(prisma.auditLog.create.mock.calls[0][0].data.diff).toMatchObject({ action: 'approve', from: 'DRAFT', to: 'APPROVED' })
    })

    it.each(['APPROVED', 'SKIPPED', 'SENT'])('в статусе %s одобрить нельзя', async (status) => {
      prisma.parentVerdict.findUnique.mockResolvedValue(baseVerdict({ status }))
      await expect(service.approve(teacher, 'v1', NOW)).rejects.toBeInstanceOf(ConflictException)
      expect(prisma.parentVerdict.updateMany).not.toHaveBeenCalled()
    })

    it('оценки вне шкалы появились после создания черновика — одобрить нельзя', async () => {
      prisma.parentVerdict.findUnique.mockResolvedValue(baseVerdict({ studentId: 's3' }))
      await expect(service.approve(teacher, 'v1', NOW)).rejects.toThrow(/вне шкалы/)
      expect(prisma.parentVerdict.updateMany).not.toHaveBeenCalled()
    })

    it('пустой текст — 400', async () => {
      prisma.parentVerdict.findUnique.mockResolvedValue(baseVerdict({ textTg: ' ' }))
      await expect(service.approve(teacher, 'v1', NOW)).rejects.toBeInstanceOf(BadRequestException)
    })

    it('одновременное изменение — 409', async () => {
      prisma.parentVerdict.updateMany.mockResolvedValue({ count: 0 })
      await expect(service.approve(teacher, 'v1', NOW)).rejects.toBeInstanceOf(ConflictException)
      expect(prisma.auditLog.create).not.toHaveBeenCalled()
    })

    it('чужой класс — отказ', async () => {
      access.assertHomeroomAccess.mockRejectedValue(new ForbiddenException('Это не ваш класс'))
      await expect(service.approve(teacher, 'v1', NOW)).rejects.toBeInstanceOf(ForbiddenException)
      expect(prisma.parentVerdict.updateMany).not.toHaveBeenCalled()
    })
  })

  describe('reopen', () => {
    it.each(['APPROVED', 'SKIPPED'])('%s → черновик, отметка о проверке сбрасывается', async (status) => {
      prisma.parentVerdict.findUnique.mockResolvedValue(baseVerdict({ status }))
      await service.reopen(teacher, 'v1')
      const call = prisma.parentVerdict.updateMany.mock.calls[0][0]
      expect(call.where).toEqual({ id: 'v1', status: { in: ['APPROVED', 'SKIPPED'] } })
      expect(call.data).toEqual({ status: 'DRAFT', reviewedById: null, reviewedAt: null, skipReason: null })
    })

    it.each(['DRAFT', 'SENT'])('из %s вернуть в черновик нельзя: отправленное не отзывается', async (status) => {
      prisma.parentVerdict.findUnique.mockResolvedValue(baseVerdict({ status }))
      await expect(service.reopen(teacher, 'v1')).rejects.toBeInstanceOf(ConflictException)
      expect(prisma.parentVerdict.updateMany).not.toHaveBeenCalled()
    })
  })

  describe('skip', () => {
    it.each(['DRAFT', 'APPROVED'])('%s → пропущен, причина сохраняется без пробелов по краям', async (status) => {
      prisma.parentVerdict.findUnique.mockResolvedValue(baseVerdict({ status }))
      await service.skip(teacher, 'v1', '  семейная ситуация ')
      const call = prisma.parentVerdict.updateMany.mock.calls[0][0]
      expect(call.where).toEqual({ id: 'v1', status: { in: ['DRAFT', 'APPROVED'] } })
      expect(call.data).toMatchObject({ status: 'SKIPPED', reviewedById: 't1', skipReason: 'семейная ситуация' })
    })

    it('причина необязательна', async () => {
      await service.skip(teacher, 'v1')
      expect(prisma.parentVerdict.updateMany.mock.calls[0][0].data.skipReason).toBeNull()
    })

    it('слишком длинная причина — 400; уже пропущенный или отправленный — 409', async () => {
      await expect(service.skip(teacher, 'v1', 'я'.repeat(501))).rejects.toBeInstanceOf(BadRequestException)
      for (const status of ['SKIPPED', 'SENT']) {
        prisma.parentVerdict.findUnique.mockResolvedValue(baseVerdict({ status }))
        await expect(service.skip(teacher, 'v1')).rejects.toBeInstanceOf(ConflictException)
      }
      expect(prisma.parentVerdict.updateMany).not.toHaveBeenCalled()
    })
  })

  describe('regenerate', () => {
    it('пересчитывает черновик заново: правки пропадают, текст снова равен черновику', async () => {
      prisma.parentVerdict.findUnique.mockResolvedValue(baseVerdict({ textRu: 'правка учителя' }))
      await service.regenerate(teacher, 'v1', NOW)
      const call = prisma.parentVerdict.updateMany.mock.calls[0][0]
      expect(call.where).toEqual({ id: 'v1', status: 'DRAFT' })
      expect(call.data.textRu).toBe(call.data.draftRu)
      expect(call.data.textTg).toBe(call.data.draftTg)
      expect(call.data.draftRu).toContain('Алишер')
    })

    it.each(['APPROVED', 'SKIPPED', 'SENT'])('в статусе %s пересчитать нельзя', async (status) => {
      prisma.parentVerdict.findUnique.mockResolvedValue(baseVerdict({ status }))
      await expect(service.regenerate(teacher, 'v1', NOW)).rejects.toBeInstanceOf(ConflictException)
      expect(prisma.parentVerdict.updateMany).not.toHaveBeenCalled()
    })

    it('ученик вышел из класса, оценки вне шкалы или данных нет — 409, черновик не меняется', async () => {
      prisma.parentVerdict.findUnique.mockResolvedValue(baseVerdict({ studentId: 'gone' }))
      await expect(service.regenerate(teacher, 'v1', NOW)).rejects.toThrow(/нет в этом классе/)
      prisma.parentVerdict.findUnique.mockResolvedValue(baseVerdict({ studentId: 's3' }))
      await expect(service.regenerate(teacher, 'v1', NOW)).rejects.toThrow(/вне шкалы/)
      prisma.parentVerdict.findUnique.mockResolvedValue(baseVerdict({ studentId: 's2' }))
      await expect(service.regenerate(teacher, 'v1', NOW)).rejects.toThrow(/Данных для вердикта пока нет/)
      expect(prisma.parentVerdict.updateMany).not.toHaveBeenCalled()
    })
  })

  describe('отправленное неизменно', () => {
    it('ни одна операция не меняет вердикт со статусом SENT', async () => {
      prisma.parentVerdict.findUnique.mockResolvedValue(baseVerdict({ status: 'SENT', sentAt: new Date() }))
      const attempts = [
        () => service.updateText(teacher, 'v1', { textRu: 'x' }),
        () => service.approve(teacher, 'v1', NOW),
        () => service.reopen(teacher, 'v1'),
        () => service.skip(teacher, 'v1', 'x'),
        () => service.regenerate(teacher, 'v1', NOW),
      ]
      for (const attempt of attempts) await expect(attempt()).rejects.toBeInstanceOf(ConflictException)
      expect(prisma.parentVerdict.updateMany).not.toHaveBeenCalled()
      expect(prisma.parentVerdict.update).not.toHaveBeenCalled()
      expect(prisma.parentVerdict.delete).not.toHaveBeenCalled()
    })
  })
})
