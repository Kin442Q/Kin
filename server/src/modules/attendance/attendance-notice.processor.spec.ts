import { AttendanceNoticeProcessor } from './attendance-notice.processor'
import { createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock'

describe('AttendanceNoticeProcessor', () => {
  let prisma: PrismaMock
  let push: { sendToStudentParents: jest.Mock }
  let sms: { send: jest.Mock }
  let processor: AttendanceNoticeProcessor

  const student = {
    firstName: 'Малика',
    lastName: 'Рахимова',
    status: 'ACTIVE',
    motherPhone: '+992900000001',
    fatherPhone: null,
    parents: [{ phone: '+992900000002' }, { phone: null }],
  }

  beforeEach(() => {
    prisma = createPrismaMock()
    push = { sendToStudentParents: jest.fn().mockResolvedValue(undefined) }
    sms = { send: jest.fn().mockResolvedValue({ sent: 0, skipped: 'sms-provider-not-configured' }) }
    processor = new AttendanceNoticeProcessor(prisma as any, push as any, sms as any)
    prisma.attendance.findUnique.mockResolvedValue({ status: 'ABSENT' })
    prisma.notification.findFirst.mockResolvedValue(null)
    prisma.student.findUnique.mockResolvedValue(student)
  })

  it('ABSENT: push родителям ученика с данными для перехода и текстом с именем и датой', async () => {
    const res = await processor.notifyAbsence('s1', '2026-11-25')

    expect(res).toBe('sent')
    expect(push.sendToStudentParents).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({
        title: 'Отсутствие в школе',
        body: expect.stringContaining('Рахимова Малика'),
        data: { kind: 'absence', studentId: 's1', date: '2026-11-25' },
      }),
    )
    expect(push.sendToStudentParents.mock.calls[0][1].body).toContain('25.11')
  })

  it('место для SMS вызывается с телефонами родителей (пока заглушка)', async () => {
    await processor.notifyAbsence('s1', '2026-11-25')
    expect(sms.send).toHaveBeenCalledWith(
      ['+992900000001', '+992900000002'],
      expect.stringContaining('отсутствие'),
    )
  })

  it('сбой SMS не ломает уведомление', async () => {
    sms.send.mockRejectedValue(new Error('provider down'))
    await expect(processor.notifyAbsence('s1', '2026-11-25')).resolves.toBe('sent')
  })

  it('ученика уже отметили иначе (учитель исправил тап) — ничего не уходит', async () => {
    prisma.attendance.findUnique.mockResolvedValue({ status: 'PRESENT' })
    expect(await processor.notifyAbsence('s1', '2026-11-25')).toBe('skipped')
    expect(push.sendToStudentParents).not.toHaveBeenCalled()
    expect(sms.send).not.toHaveBeenCalled()
  })

  it('об этом дне родителям уже сообщали (учитель переставил «Нет» после «Есть») — не повторяем', async () => {
    prisma.notification.findFirst.mockResolvedValue({ id: 'n1' })
    expect(await processor.notifyAbsence('s1', '2026-11-25')).toBe('skipped')
    expect(push.sendToStudentParents).not.toHaveBeenCalled()
    expect(sms.send).not.toHaveBeenCalled()
    // проверка идёт по записи «absence» этого ученика и этого дня
    expect(prisma.notification.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { payload: { path: ['studentId'], equals: 's1' } },
            { payload: { path: ['date'], equals: '2026-11-25' } },
          ]),
        }),
      }),
    )
  })

  it('отметки нет (удалена) — пропуск', async () => {
    prisma.attendance.findUnique.mockResolvedValue(null)
    expect(await processor.notifyAbsence('s1', '2026-11-25')).toBe('skipped')
    expect(push.sendToStudentParents).not.toHaveBeenCalled()
  })

  it('ученик больше не учится (не ACTIVE) — пропуск', async () => {
    prisma.student.findUnique.mockResolvedValue({ ...student, status: 'GRADUATED' })
    expect(await processor.notifyAbsence('s1', '2026-11-25')).toBe('skipped')
    expect(push.sendToStudentParents).not.toHaveBeenCalled()
  })

  it('process() берёт данные из задания', async () => {
    const res = await processor.process({ data: { studentId: 's1', date: '2026-11-25' } } as any)
    expect(res).toBe('sent')
    expect(prisma.attendance.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId_date: { studentId: 's1', date: new Date('2026-11-25') } },
      }),
    )
  })
})
