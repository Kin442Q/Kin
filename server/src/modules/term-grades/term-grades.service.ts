import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { ClassAccessService } from '../class-access/class-access.service'
import type { AuthUser } from '../../common/types/jwt-payload'
import { calculateTermGrade, resolveTermGrade } from './term-grade-calc'
import { scaleMaxOf } from './term-grade-report'

export interface StudentTermGradeKey {
  termId: string
  subjectId: string
  studentId: string
}

const SET_BY = { select: { id: true, fullName: true } }

/**
 * Итоги четвертей для сотрудников: журнал видит расчёт и оценку учителя по каждому ученику класса.
 * Ставит и сбрасывает итог только учитель — по своим классам и выданным ему предметам (как обычные
 * оценки). Расчёт никогда ничего не пишет в базу, поэтому не может затереть оценку учителя.
 */
@Injectable()
export class TermGradesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ClassAccessService,
  ) {}

  /** Период и предмет одной школы, доступной пользователю. */
  private async loadContext(user: AuthUser, termId: string, subjectId: string) {
    const [term, subject] = await Promise.all([
      this.prisma.term.findUnique({ where: { id: termId } }),
      this.prisma.subject.findUnique({ where: { id: subjectId }, select: { id: true, kindergartenId: true } }),
    ])
    if (!term) throw new NotFoundException('Период не найден')
    if (!subject) throw new NotFoundException('Предмет не найден')
    if (
      term.kindergartenId !== subject.kindergartenId ||
      (user.kindergartenId && term.kindergartenId !== user.kindergartenId)
    ) {
      throw new ForbiddenException('Объект из другого учреждения')
    }
    return { term, subject }
  }

  /** Учитель работает только с предметами, которые ему выдали. Админу проверка не нужна. */
  private async assertTeacherSubject(user: AuthUser, subjectId: string) {
    if (user.role !== 'TEACHER') return
    const own = await this.prisma.subject.findFirst({
      where: { id: subjectId, teachers: { some: { id: user.sub } } },
      select: { id: true },
    })
    if (!own) {
      throw new ForbiddenException('Этот предмет вам не выдан. Попросите администратора открыть доступ.')
    }
  }

  /** Расчёт и оценка учителя по списку учеников. */
  private async views(
    term: { id: string; startDate: Date; endDate: Date; kindergartenId: string | null },
    subjectId: string,
    studentIds: string[],
  ) {
    const [scaleMax, grades, manual] = await Promise.all([
      scaleMaxOf(this.prisma, term.kindergartenId),
      this.prisma.grade.findMany({
        where: { subjectId, studentId: { in: studentIds }, date: { gte: term.startDate, lte: term.endDate } },
        select: { studentId: true, value: true, date: true },
      }),
      this.prisma.termGrade.findMany({
        where: { termId: term.id, subjectId, studentId: { in: studentIds } },
        select: { studentId: true, value: true, setAt: true, setBy: SET_BY },
      }),
    ])
    const gradesBy = new Map<string, typeof grades>()
    for (const g of grades) {
      const list = gradesBy.get(g.studentId) ?? []
      list.push(g)
      gradesBy.set(g.studentId, list)
    }
    const manualBy = new Map(manual.map((m) => [m.studentId, m]))
    return {
      scaleMax,
      items: studentIds.map((studentId) => ({
        studentId,
        ...resolveTermGrade(manualBy.get(studentId), calculateTermGrade(gradesBy.get(studentId) ?? [], scaleMax)),
      })),
    }
  }

  /** Итоги класса по предмету за период. */
  async list(user: AuthUser, params: { termId: string; subjectId: string; groupId: string }) {
    const [{ term }, group] = await Promise.all([
      this.loadContext(user, params.termId, params.subjectId),
      this.prisma.group.findUnique({
        where: { id: params.groupId },
        select: { id: true, kindergartenId: true },
      }),
    ])
    if (!group) throw new NotFoundException('Класс не найден')
    await this.access.assertStaffAccess(user, group)
    if (group.kindergartenId !== term.kindergartenId) {
      throw new ForbiddenException('Объект из другого учреждения')
    }
    await this.assertTeacherSubject(user, params.subjectId)

    const students = await this.prisma.student.findMany({
      where: { groupId: group.id },
      select: { id: true },
    })
    return this.views(term, params.subjectId, students.map((s) => s.id))
  }

  /** Может ли этот пользователь ставить итог этому ученику по этому предмету за этот период. */
  private async assertCanWrite(user: AuthUser, key: StudentTermGradeKey) {
    if (user.role !== 'TEACHER') {
      throw new ForbiddenException('Итог четверти ставит только учитель')
    }
    const [{ term }, student] = await Promise.all([
      this.loadContext(user, key.termId, key.subjectId),
      this.prisma.student.findUnique({
        where: { id: key.studentId },
        select: { id: true, groupId: true, kindergartenId: true },
      }),
    ])
    if (!student) throw new NotFoundException('Ученик не найден')
    if (student.kindergartenId !== term.kindergartenId) {
      throw new ForbiddenException('Объект из другого учреждения')
    }
    if (!(await this.access.teacherGroupIds(user)).includes(student.groupId)) {
      throw new ForbiddenException('Ученик не из ваших классов')
    }
    await this.assertTeacherSubject(user, key.subjectId)
    return term
  }

  private async one(
    term: Parameters<TermGradesService['views']>[0],
    key: StudentTermGradeKey,
  ) {
    const { scaleMax, items } = await this.views(term, key.subjectId, [key.studentId])
    return { scaleMax, item: items[0] }
  }

  /** Учитель ставит (или меняет) итог. Дата обновляется при каждом изменении. */
  async set(user: AuthUser, dto: StudentTermGradeKey & { value: number }) {
    const term = await this.assertCanWrite(user, dto)
    const max = await scaleMaxOf(this.prisma, term.kindergartenId)
    if (!Number.isInteger(dto.value) || dto.value < 1 || dto.value > max) {
      throw new BadRequestException(`Оценка по шкале школы: от 1 до ${max}`)
    }
    const mark = { value: dto.value, setById: user.sub, setAt: new Date() }
    const where = { studentId: dto.studentId, subjectId: dto.subjectId, termId: dto.termId }
    await this.prisma.termGrade.upsert({
      where: { studentId_subjectId_termId: where },
      create: { ...where, ...mark },
      update: mark,
    })
    return this.one(term, dto)
  }

  /** Убрать оценку учителя: снова показывается расчётный итог. Повторный сброс — не ошибка. */
  async reset(user: AuthUser, key: StudentTermGradeKey) {
    const term = await this.assertCanWrite(user, key)
    await this.prisma.termGrade.deleteMany({
      where: { studentId: key.studentId, subjectId: key.subjectId, termId: key.termId },
    })
    return this.one(term, key)
  }
}
