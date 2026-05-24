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
class SchoolService {
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

  // ─── Subjects ───────────────────────────────────────────────────────

  async listSubjects(user: AuthUser) {
    return this.prisma.subject.findMany({
      where: this.tenantFilter(user),
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
    if (user.role !== 'TEACHER' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Доступно учителю/админу')
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
    } else if (params.groupId) {
      where.groupId = params.groupId
    }
    if (user.kindergartenId) {
      where.group = { kindergartenId: user.kindergartenId }
    }

    return this.prisma.homework.findMany({
      where,
      orderBy: { dueDate: 'asc' },
      include: {
        subject: { select: { id: true, name: true, color: true } },
        group: { select: { id: true, name: true } },
      },
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
    if (user.kindergartenId && hw.group.kindergartenId !== user.kindergartenId) {
      throw new ForbiddenException()
    }
    await this.prisma.homework.delete({ where: { id } })
  }
}

// ─── Controllers (subjects / grades / homework) ───────────────────────

@ApiTags('subjects')
@ApiBearerAuth()
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
  @ApiOperation({ summary: 'Поставить оценку' })
  create(@CurrentUser() user: AuthUser, @Body() dto: UpsertGradeDto) {
    return this.service.upsertGrade(user, dto)
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.deleteGrade(user, id)
  }

  @Get('stats/:studentId')
  @ApiOperation({ summary: 'Средняя оценка по предметам для ученика' })
  stats(@CurrentUser() user: AuthUser, @Param('studentId') studentId: string) {
    return this.service.gradeStats(user, studentId)
  }
}

@ApiTags('homework')
@ApiBearerAuth()
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
