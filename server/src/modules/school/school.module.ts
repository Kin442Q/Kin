import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { GradeType } from '@prisma/client'
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { PushService } from '../push/push.module'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'
import { Feature } from '../../common/decorators/feature.decorator'
import { buildDirectorReport, type ReportGrade, type ReportSubject } from './director-report'

// ─── DTOs ─────────────────────────────────────────────────────────────

class CreateSubjectDto {
  @IsString() @MaxLength(80) name!: string
  @IsOptional() @IsString() color?: string
}
class UpdateSubjectDto {
  @IsOptional() @IsString() @MaxLength(80) name?: string
  @IsOptional() @IsString() color?: string
}

class UpsertGradeDto {
  @IsString() studentId!: string
  @IsString() subjectId!: string
  @IsInt() @Min(1) @Max(10) value!: number
  @IsOptional() @IsEnum(GradeType) type?: GradeType
  @IsDateString() date!: string
  @IsOptional() @IsString() @MaxLength(500) comment?: string
}

class CreateHomeworkDto {
  @IsString() subjectId!: string
  @IsString() groupId!: string
  @IsString() @MaxLength(200) title!: string
  @IsOptional() @IsString() @MaxLength(4000) description?: string
  @IsDateString() dueDate!: string
  @IsOptional() @IsArray() attachments?: string[]
}
class UpdateHomeworkDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string
  @IsOptional() @IsString() @MaxLength(4000) description?: string
  @IsOptional() @IsDateString() dueDate?: string
  @IsOptional() @IsArray() attachments?: string[]
}

// ─── Service ──────────────────────────────────────────────────────────

@Injectable()
export class SchoolService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  private tenantFilter(user: AuthUser) {
    return user.kindergartenId ? { kindergartenId: user.kindergartenId } : {}
  }

  /** Все классы, к которым у учителя есть доступ: основная группа + M:N. */
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

  /** Предметы, которые администратор открыл учителю. */
  private async teacherSubjectIds(user: AuthUser): Promise<string[]> {
    const rows = await this.prisma.subject.findMany({
      where: { teachers: { some: { id: user.sub } } },
      select: { id: true },
    })
    return rows.map((r) => r.id)
  }

  /** Учитель работает только с предметами, которые ему выдали. Админу проверка не нужна. */
  private async assertTeacherSubject(user: AuthUser, subjectId: string) {
    if (user.role !== 'TEACHER') return
    if (!(await this.teacherSubjectIds(user)).includes(subjectId)) {
      throw new ForbiddenException('Этот предмет вам не выдан. Попросите администратора открыть доступ.')
    }
  }

  // ─── Subjects ───────────────────────────────────────────────────────

  async listSubjects(user: AuthUser) {
    return this.prisma.subject.findMany({
      where: {
        ...this.tenantFilter(user),
        // Учитель видит только свои предметы, а не все предметы школы
        ...(user.role === 'TEACHER' ? { teachers: { some: { id: user.sub } } } : {}),
      },
      orderBy: { name: 'asc' },
    })
  }

  async createSubject(user: AuthUser, dto: CreateSubjectDto) {
    if (!user.kindergartenId) {
      throw new ForbiddenException('Не привязан к учреждению')
    }
    return this.prisma.subject.create({
      data: {
        name: dto.name.trim(),
        color: dto.color ?? '#4FB286',
        kindergartenId: user.kindergartenId,
      },
    })
  }

  async updateSubject(user: AuthUser, id: string, dto: UpdateSubjectDto) {
    await this.assertSubjectAccess(user, id)
    return this.prisma.subject.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        color: dto.color,
      },
    })
  }

  async deleteSubject(user: AuthUser, id: string) {
    await this.assertSubjectAccess(user, id)
    await this.prisma.subject.delete({ where: { id } })
  }

  private async assertSubjectAccess(user: AuthUser, subjectId: string) {
    const s = await this.prisma.subject.findUnique({ where: { id: subjectId } })
    if (!s) throw new NotFoundException('Предмет не найден')
    if (user.kindergartenId && s.kindergartenId !== user.kindergartenId) {
      throw new ForbiddenException('Предмет из другого учреждения')
    }
    return s
  }

  // ─── Grades ─────────────────────────────────────────────────────────

  async listGrades(
    user: AuthUser,
    params: { studentId?: string; subjectId?: string; from?: string; to?: string },
  ) {
    // Учителю можно видеть оценки учеников всех классов, которые он ведёт
    let teacherGroups: string[] = []
    if (user.role === 'TEACHER') {
      teacherGroups = await this.teacherGroupIds(user)
      if (teacherGroups.length === 0) return []
    }

    const where: Record<string, unknown> = {}
    if (params.studentId) where.studentId = params.studentId
    if (params.subjectId) where.subjectId = params.subjectId
    if (user.role === 'TEACHER') {
      // только выданные предметы: чужой предмет не показываем, даже если запросили по id
      const subjectIds = await this.teacherSubjectIds(user)
      if (params.subjectId ? !subjectIds.includes(params.subjectId) : subjectIds.length === 0) return []
      if (!params.subjectId) where.subjectId = { in: subjectIds }
    }
    if (params.from || params.to) {
      where.date = {
        ...(params.from ? { gte: new Date(params.from) } : {}),
        ...(params.to ? { lte: new Date(params.to) } : {}),
      }
    }

    if (user.role === 'TEACHER') {
      where.student = { groupId: { in: teacherGroups }, ...this.tenantFilter(user) }
    } else if (user.kindergartenId) {
      where.student = { kindergartenId: user.kindergartenId }
    }

    return this.prisma.grade.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        subject: { select: { id: true, name: true, color: true } },
        student: { select: { id: true, firstName: true, lastName: true } },
        author: { select: { id: true, fullName: true } },
      },
    })
  }

  async upsertGrade(user: AuthUser, dto: UpsertGradeDto) {
    // Оценки ставит только учитель. Директор и администратор школы журнал видят, но не пишут в него.
    if (user.role !== 'TEACHER') {
      throw new ForbiddenException('Оценки ставит только учитель')
    }

    // Доступ к ученику и предмету
    const [student, subject] = await Promise.all([
      this.prisma.student.findUnique({
        where: { id: dto.studentId },
        select: { id: true, groupId: true, kindergartenId: true },
      }),
      this.prisma.subject.findUnique({ where: { id: dto.subjectId } }),
    ])
    if (!student) throw new NotFoundException('Ученик не найден')
    if (!subject) throw new NotFoundException('Предмет не найден')

    if (user.role === 'TEACHER') {
      const groups = await this.teacherGroupIds(user)
      if (!student.groupId || !groups.includes(student.groupId)) {
        throw new ForbiddenException('Ученик не из ваших классов')
      }
      await this.assertTeacherSubject(user, dto.subjectId)
    }
    if (
      user.kindergartenId &&
      (student.kindergartenId !== user.kindergartenId ||
        subject.kindergartenId !== user.kindergartenId)
    ) {
      throw new ForbiddenException('Объект из другого учреждения')
    }

    if (dto.value < 1) throw new BadRequestException('Оценка должна быть >= 1')

    const grade = await this.prisma.grade.create({
      data: {
        studentId: dto.studentId,
        subjectId: dto.subjectId,
        value: dto.value,
        type: dto.type ?? 'CLASSWORK',
        date: new Date(dto.date),
        comment: dto.comment,
        authorId: user.sub,
      },
      include: {
        subject: { select: { id: true, name: true, color: true } },
      },
    })

    this.push
      .sendToStudentParents(dto.studentId, {
        title: `Новая оценка · ${grade.subject.name}`,
        body: `${dto.value}${dto.comment ? ' · ' + dto.comment : ''}`,
        data: { kind: 'grade', gradeId: grade.id, studentId: dto.studentId },
      })
      .catch(() => {})

    return grade
  }

  async deleteGrade(user: AuthUser, id: string) {
    if (user.role !== 'TEACHER') {
      throw new ForbiddenException('Оценки удаляет только учитель')
    }
    const g = await this.prisma.grade.findUnique({
      where: { id },
      include: { student: true },
    })
    if (!g) throw new NotFoundException('Оценка не найдена')
    if (
      user.role === 'TEACHER' &&
      !(await this.teacherGroupIds(user)).includes(g.student.groupId ?? '')
    ) {
      throw new ForbiddenException('Не ваш ученик')
    }
    await this.assertTeacherSubject(user, g.subjectId)
    if (user.kindergartenId && g.student.kindergartenId !== user.kindergartenId) {
      throw new ForbiddenException('Из другого учреждения')
    }
    await this.prisma.grade.delete({ where: { id } })
  }

  /** Сводка по предмету: средняя + количество оценок. */
  async gradeStats(user: AuthUser, studentId: string) {
    // Доступы: учитель → ученик из его группы; админ → ученик его учреждения;
    // родитель — отдельный эндпоинт, тут не пускаем.
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { groupId: true, kindergartenId: true },
    })
    if (!student) throw new NotFoundException('Ученик не найден')
    if (
      user.role === 'TEACHER' &&
      !(await this.teacherGroupIds(user)).includes(student.groupId ?? '')
    ) {
      throw new ForbiddenException()
    }
    if (user.kindergartenId && student.kindergartenId !== user.kindergartenId) {
      throw new ForbiddenException()
    }

    const grades = await this.prisma.grade.findMany({
      where: { studentId },
      select: { subjectId: true, value: true, subject: true },
    })
    const map: Record<
      string,
      { subjectId: string; name: string; color: string; count: number; sum: number }
    > = {}
    for (const g of grades) {
      const m =
        map[g.subjectId] ||
        (map[g.subjectId] = {
          subjectId: g.subjectId,
          name: g.subject.name,
          color: g.subject.color,
          count: 0,
          sum: 0,
        })
      m.count++
      m.sum += g.value
    }
    return Object.values(map).map((m) => ({
      ...m,
      average: m.count ? Number((m.sum / m.count).toFixed(2)) : 0,
    }))
  }

  /**
   * Отчёт директору за период: общий средний балл, полнота журнала по классам,
   * отличные и самые низкие оценки.
   */
  async directorReport(user: AuthUser, params: { from?: string; to?: string }) {
    if (user.role === 'TEACHER') {
      throw new ForbiddenException('Отчёт доступен директору')
    }
    if (!user.kindergartenId) {
      return buildDirectorReport({
        groups: [],
        subjectsByGroup: new Map(),
        schoolSubjects: [],
        grades: [],
      })
    }

    const kg = user.kindergartenId
    const [groups, subjects, schedule, gradeRows] = await Promise.all([
      this.prisma.group.findMany({
        where: { kindergartenId: kg, isActive: true },
        orderBy: [{ gradeNumber: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          gradeLabel: true,
          students: {
            where: { status: 'ACTIVE' },
            select: { id: true, firstName: true, lastName: true },
            orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
          },
        },
      }),
      this.prisma.subject.findMany({
        where: { kindergartenId: kg },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.scheduleItem.findMany({
        where: { subjectId: { not: null }, group: { kindergartenId: kg, isActive: true } },
        select: {
          groupId: true,
          subject: { select: { id: true, name: true } },
        },
      }),
      this.prisma.grade.findMany({
        where: {
          student: { kindergartenId: kg, status: 'ACTIVE' },
          ...(params.from || params.to
            ? {
                date: {
                  ...(params.from ? { gte: new Date(params.from) } : {}),
                  ...(params.to ? { lte: new Date(params.to) } : {}),
                },
              }
            : {}),
        },
        select: {
          value: true,
          date: true,
          studentId: true,
          subjectId: true,
          subject: { select: { name: true } },
          student: { select: { firstName: true, lastName: true, groupId: true } },
        },
      }),
    ])

    const subjectsByGroup = new Map<string, ReportSubject[]>()
    for (const item of schedule) {
      if (!item.subject) continue
      const list = subjectsByGroup.get(item.groupId) ?? []
      if (!list.some((s) => s.id === item.subject!.id)) {
        list.push({ id: item.subject.id, name: item.subject.name })
      }
      subjectsByGroup.set(item.groupId, list)
    }

    const grades: ReportGrade[] = gradeRows.map((g) => ({
      value: g.value,
      date: utcDay(g.date),
      studentId: g.studentId,
      studentName: `${g.student.lastName} ${g.student.firstName}`.trim(),
      groupId: g.student.groupId,
      subjectId: g.subjectId,
      subjectName: g.subject.name,
    }))

    return buildDirectorReport({
      groups: groups.map((g) => ({
        id: g.id,
        name: g.gradeLabel?.trim() || g.name,
        students: g.students.map((s) => ({
          id: s.id,
          name: `${s.lastName} ${s.firstName}`.trim(),
        })),
      })),
      subjectsByGroup,
      schoolSubjects: subjects,
      grades,
    })
  }

  // ─── Homework ───────────────────────────────────────────────────────

  async listHomework(
    user: AuthUser,
    params: { groupId?: string; subjectId?: string; from?: string; to?: string },
  ) {
    const where: Record<string, unknown> = {}
    if (params.subjectId) where.subjectId = params.subjectId
    if (params.from || params.to) {
      where.dueDate = {
        ...(params.from ? { gte: new Date(params.from) } : {}),
        ...(params.to ? { lte: new Date(params.to) } : {}),
      }
    }
    if (user.role === 'TEACHER') {
      const groups = await this.teacherGroupIds(user)
      if (groups.length === 0) return []
      where.groupId = params.groupId && groups.includes(params.groupId)
        ? params.groupId
        : { in: groups }
      const subjectIds = await this.teacherSubjectIds(user)
      if (params.subjectId ? !subjectIds.includes(params.subjectId) : subjectIds.length === 0) return []
      if (!params.subjectId) where.subjectId = { in: subjectIds }
    } else if (params.groupId) {
      where.groupId = params.groupId
    }
    if (user.kindergartenId) {
      where.group = { kindergartenId: user.kindergartenId }
    }

    const list = await this.prisma.homework.findMany({
      where,
      orderBy: { dueDate: 'asc' },
      include: {
        subject: { select: { id: true, name: true, color: true } },
        group: { select: { id: true, name: true } },
      },
    })
    return this.withSubmissionStats(list)
  }

  /**
   * Сколько учеников класса сдали каждое ДЗ: `total` — учеников в классе, `submitted` — отметили «сделал» или
   * получили вердикт учителя (выполнено / частично), `toCheck` — отметили сами, а учитель ещё не проверил.
   */
  private async withSubmissionStats<T extends { id: string; groupId: string }>(list: T[]) {
    if (list.length === 0) return list.map((h) => ({ ...h, stats: { total: 0, submitted: 0, toCheck: 0 } }))
    const [byStatus, sizes] = await Promise.all([
      this.prisma.homeworkSubmission.groupBy({
        by: ['homeworkId', 'status'],
        where: { homeworkId: { in: list.map((h) => h.id) } },
        _count: { _all: true },
      }),
      this.prisma.student.groupBy({
        by: ['groupId'],
        where: { groupId: { in: [...new Set(list.map((h) => h.groupId))] }, status: 'ACTIVE' },
        _count: { _all: true },
      }),
    ])
    const total = new Map(sizes.map((s) => [s.groupId, s._count._all]))
    const counts = new Map<string, Record<string, number>>()
    for (const row of byStatus) {
      const cur = counts.get(row.homeworkId) ?? {}
      cur[row.status] = row._count._all
      counts.set(row.homeworkId, cur)
    }
    return list.map((h) => {
      const c = counts.get(h.id) ?? {}
      return {
        ...h,
        stats: {
          total: total.get(h.groupId) ?? 0,
          submitted: (c.SUBMITTED ?? 0) + (c.DONE ?? 0) + (c.PARTIAL ?? 0),
          toCheck: c.SUBMITTED ?? 0,
        },
      }
    })
  }

  async createHomework(user: AuthUser, dto: CreateHomeworkDto) {
    if (user.role !== 'TEACHER' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Доступно учителю/админу')
    }
    if (
      user.role === 'TEACHER' &&
      !(await this.teacherGroupIds(user)).includes(dto.groupId)
    ) {
      throw new ForbiddenException('Можно задавать только своим классам')
    }
    await this.assertTeacherSubject(user, dto.subjectId)
    const [group, subject] = await Promise.all([
      this.prisma.group.findUnique({ where: { id: dto.groupId } }),
      this.prisma.subject.findUnique({ where: { id: dto.subjectId } }),
    ])
    if (!group) throw new NotFoundException('Класс не найден')
    if (!subject) throw new NotFoundException('Предмет не найден')
    if (
      user.kindergartenId &&
      (group.kindergartenId !== user.kindergartenId ||
        subject.kindergartenId !== user.kindergartenId)
    ) {
      throw new ForbiddenException('Объект из другого учреждения')
    }

    const hw = await this.prisma.homework.create({
      data: {
        subjectId: dto.subjectId,
        groupId: dto.groupId,
        title: dto.title.trim(),
        description: dto.description,
        dueDate: new Date(dto.dueDate),
        attachments: dto.attachments ?? [],
        authorId: user.sub,
      },
      include: {
        subject: { select: { id: true, name: true, color: true } },
      },
    })

    this.push
      .sendToGroupParents(dto.groupId, {
        title: `Новое ДЗ · ${hw.subject.name}`,
        body: `${hw.title} · до ${new Date(hw.dueDate).toLocaleDateString('ru-RU')}`,
        data: { kind: 'homework', homeworkId: hw.id, groupId: dto.groupId },
      })
      .catch(() => {})

    return hw
  }

  async updateHomework(user: AuthUser, id: string, dto: UpdateHomeworkDto) {
    const hw = await this.prisma.homework.findUnique({
      where: { id },
      include: { group: true },
    })
    if (!hw) throw new NotFoundException('ДЗ не найдено')
    if (
      user.role === 'TEACHER' &&
      !(await this.teacherGroupIds(user)).includes(hw.groupId)
    ) {
      throw new ForbiddenException()
    }
    await this.assertTeacherSubject(user, hw.subjectId)
    if (user.kindergartenId && hw.group.kindergartenId !== user.kindergartenId) {
      throw new ForbiddenException()
    }
    return this.prisma.homework.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        description: dto.description,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        attachments: dto.attachments,
      },
    })
  }

  async deleteHomework(user: AuthUser, id: string) {
    const hw = await this.prisma.homework.findUnique({
      where: { id },
      include: { group: true },
    })
    if (!hw) throw new NotFoundException('ДЗ не найдено')
    if (
      user.role === 'TEACHER' &&
      !(await this.teacherGroupIds(user)).includes(hw.groupId)
    ) {
      throw new ForbiddenException()
    }
    await this.assertTeacherSubject(user, hw.subjectId)
    if (user.kindergartenId && hw.group.kindergartenId !== user.kindergartenId) {
      throw new ForbiddenException()
    }
    await this.prisma.homework.delete({ where: { id } })
  }
}

// ─── Controllers (subjects / grades / homework) ───────────────────────

@ApiTags('subjects')
@ApiBearerAuth()
@Feature('subjects')
@Controller({ path: 'subjects', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
class SubjectsController {
  constructor(private readonly service: SchoolService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.listSubjects(user)
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSubjectDto) {
    return this.service.createSubject(user, dto)
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateSubjectDto,
  ) {
    return this.service.updateSubject(user, id, dto)
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('SUPER_ADMIN', 'ADMIN')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.deleteSubject(user, id)
  }
}

@ApiTags('grades')
@ApiBearerAuth()
@Feature('grades')
@Controller({ path: 'grades', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
class GradesController {
  constructor(private readonly service: SchoolService) {}

  @Get()
  @ApiQuery({ name: 'studentId', required: false })
  @ApiQuery({ name: 'subjectId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  list(
    @CurrentUser() user: AuthUser,
    @Query('studentId') studentId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.listGrades(user, { studentId, subjectId, from, to })
  }

  @Post()
  @Roles('TEACHER')
  @ApiOperation({ summary: 'Поставить оценку (только учитель)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: UpsertGradeDto) {
    return this.service.upsertGrade(user, dto)
  }

  @Delete(':id')
  @Roles('TEACHER')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.deleteGrade(user, id)
  }

  @Get('stats/:studentId')
  @ApiOperation({ summary: 'Средняя оценка по предметам для ученика' })
  stats(@CurrentUser() user: AuthUser, @Param('studentId') studentId: string) {
    return this.service.gradeStats(user, studentId)
  }

  @Get('report')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Отчёт директору: средние баллы, полнота журнала, лучшие и слабые оценки' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  report(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.directorReport(user, { from, to })
  }
}

/** День @db.Date в UTC, без сдвига пояса. */
function utcDay(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

@ApiTags('homework')
@ApiBearerAuth()
@Feature('homework')
@Controller({ path: 'homework', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
class HomeworkController {
  constructor(private readonly service: SchoolService) {}

  @Get()
  @ApiQuery({ name: 'groupId', required: false })
  @ApiQuery({ name: 'subjectId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  list(
    @CurrentUser() user: AuthUser,
    @Query('groupId') groupId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.listHomework(user, { groupId, subjectId, from, to })
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateHomeworkDto) {
    return this.service.createHomework(user, dto)
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateHomeworkDto,
  ) {
    return this.service.updateHomework(user, id, dto)
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.deleteHomework(user, id)
  }
}

@Module({
  controllers: [SubjectsController, GradesController, HomeworkController],
  providers: [SchoolService],
})
export class SchoolModule {}
