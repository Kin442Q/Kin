import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { Mood, NapQuality } from '@prisma/client'
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { PushService } from '../push/push.module'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'

class UpsertDiaryDto {
  @IsString() groupId!: string
  @IsDateString() date!: string
  @IsOptional() @IsString() @MaxLength(500) breakfast?: string
  @IsOptional() @IsString() @MaxLength(500) lunch?: string
  @IsOptional() @IsString() @MaxLength(500) snack?: string
  @IsOptional() @IsString() @MaxLength(2000) activities?: string
  @IsOptional() @IsString() @MaxLength(2000) note?: string
}

class UpsertKidNoteDto {
  @IsString() studentId!: string
  @IsDateString() date!: string
  @IsOptional() @IsEnum(Mood) mood?: Mood
  @IsOptional() @IsEnum(NapQuality) napQuality?: NapQuality
  @IsOptional() @IsString() @MaxLength(2000) note?: string
  @IsOptional() @IsArray() photoUrls?: string[]
}

@Injectable()
class DiaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  // ─── Доступы ────────────────────────────────────────────────────────

  private async assertGroupAccess(user: AuthUser, groupId: string) {
    if (user.role === 'TEACHER') {
      if (user.groupId !== groupId) {
        throw new ForbiddenException('Доступ только к своей группе')
      }
      return
    }
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
      if (user.kindergartenId) {
        const g = await this.prisma.group.findUnique({ where: { id: groupId } })
        if (!g || g.kindergartenId !== user.kindergartenId) {
          throw new ForbiddenException('Группа из другого учреждения')
        }
      }
      return
    }
    throw new ForbiddenException('Недостаточно прав')
  }

  private async assertStudentWriteAccess(user: AuthUser, studentId: string) {
    const s = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, groupId: true, kindergartenId: true },
    })
    if (!s) throw new NotFoundException('Ученик не найден')
    if (user.role === 'TEACHER' && s.groupId !== user.groupId) {
      throw new ForbiddenException('Ученик не из вашей группы')
    }
    if (
      (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') &&
      user.kindergartenId &&
      s.kindergartenId !== user.kindergartenId
    ) {
      throw new ForbiddenException('Ученик из другого учреждения')
    }
    return s
  }

  private async assertStudentReadForParent(user: AuthUser, studentId: string) {
    const s = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        OR: [
          { id: user.childId ?? '__none__' },
          { parents: { some: { id: user.sub } } },
        ],
      },
    })
    if (!s) throw new ForbiddenException('Нет доступа к этому ребёнку')
    return s
  }

  // ─── Дневник группы ─────────────────────────────────────────────────

  async getGroupDiary(user: AuthUser, groupId: string, date: string) {
    await this.assertGroupAccess(user, groupId)
    return this.prisma.diaryEntry.findUnique({
      where: { groupId_date: { groupId, date: new Date(date) } },
      include: {
        author: { select: { id: true, fullName: true } },
      },
    })
  }

  async upsertGroupDiary(user: AuthUser, dto: UpsertDiaryDto) {
    if (user.role !== 'TEACHER' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Только учитель/администратор может вести дневник')
    }
    await this.assertGroupAccess(user, dto.groupId)

    const date = new Date(dto.date)
    const existed = await this.prisma.diaryEntry.findUnique({
      where: { groupId_date: { groupId: dto.groupId, date } },
      select: { id: true },
    })

    const entry = await this.prisma.diaryEntry.upsert({
      where: { groupId_date: { groupId: dto.groupId, date } },
      create: {
        groupId: dto.groupId,
        date,
        breakfast: dto.breakfast,
        lunch: dto.lunch,
        snack: dto.snack,
        activities: dto.activities,
        note: dto.note,
        authorId: user.sub,
      },
      update: {
        breakfast: dto.breakfast,
        lunch: dto.lunch,
        snack: dto.snack,
        activities: dto.activities,
        note: dto.note,
        authorId: user.sub,
      },
    })

    // Шлём push только при первой записи за день, чтобы не спамить
    // при каждом сохранении черновика.
    if (!existed) {
      this.push
        .sendToGroupParents(dto.groupId, {
          title: 'Дневник на сегодня обновлён',
          body: 'Воспитатель добавил запись о дне в саду',
          data: { kind: 'diary', groupId: dto.groupId, date: dto.date },
        })
        .catch(() => {})
    }
    return entry
  }

  // ─── Заметка про ребёнка ────────────────────────────────────────────

  async getKidNote(user: AuthUser, studentId: string, date: string) {
    if (user.role === 'PARENT') {
      await this.assertStudentReadForParent(user, studentId)
    } else {
      await this.assertStudentWriteAccess(user, studentId)
    }
    return this.prisma.kidNote.findUnique({
      where: { studentId_date: { studentId, date: new Date(date) } },
      include: {
        author: { select: { id: true, fullName: true } },
      },
    })
  }

  async upsertKidNote(user: AuthUser, dto: UpsertKidNoteDto) {
    if (user.role !== 'TEACHER' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Только учитель/администратор может вести дневник')
    }
    await this.assertStudentWriteAccess(user, dto.studentId)

    const date = new Date(dto.date)
    return this.prisma.kidNote.upsert({
      where: { studentId_date: { studentId: dto.studentId, date } },
      create: {
        studentId: dto.studentId,
        date,
        mood: dto.mood,
        napQuality: dto.napQuality,
        note: dto.note,
        photoUrls: dto.photoUrls ?? [],
        authorId: user.sub,
      },
      update: {
        mood: dto.mood,
        napQuality: dto.napQuality,
        note: dto.note,
        photoUrls: dto.photoUrls ?? undefined,
        authorId: user.sub,
      },
    })
  }

  /**
   * Все заметки по детям группы за день — учитель пишет, потом видит сводку.
   */
  async listKidNotesForGroup(user: AuthUser, groupId: string, date: string) {
    await this.assertGroupAccess(user, groupId)
    return this.prisma.kidNote.findMany({
      where: {
        date: new Date(date),
        student: { groupId },
      },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    })
  }
}

@ApiTags('diary')
@ApiBearerAuth()
@Controller({ path: 'diary', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER', 'PARENT')
class DiaryController {
  constructor(private readonly service: DiaryService) {}

  @Get('group/:groupId')
  @ApiOperation({ summary: 'Запись дневника группы на дату' })
  @ApiQuery({ name: 'date', description: 'YYYY-MM-DD' })
  groupDiary(
    @CurrentUser() user: AuthUser,
    @Param('groupId') groupId: string,
    @Query('date') date: string,
  ) {
    return this.service.getGroupDiary(user, groupId, date)
  }

  @Post('group')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({
    summary: 'Создать/обновить запись дневника группы на дату',
  })
  upsertGroupDiary(@CurrentUser() user: AuthUser, @Body() dto: UpsertDiaryDto) {
    return this.service.upsertGroupDiary(user, dto)
  }

  @Get('kid/:studentId')
  @ApiOperation({ summary: 'Заметка о конкретном ребёнке на дату' })
  @ApiQuery({ name: 'date', description: 'YYYY-MM-DD' })
  kidNote(
    @CurrentUser() user: AuthUser,
    @Param('studentId') studentId: string,
    @Query('date') date: string,
  ) {
    return this.service.getKidNote(user, studentId, date)
  }

  @Post('kid')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Создать/обновить заметку про ребёнка на дату' })
  upsertKidNote(@CurrentUser() user: AuthUser, @Body() dto: UpsertKidNoteDto) {
    return this.service.upsertKidNote(user, dto)
  }

  @Get('group/:groupId/kids')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Сводка заметок по всем детям группы на дату' })
  @ApiQuery({ name: 'date', description: 'YYYY-MM-DD' })
  kidNotesForGroup(
    @CurrentUser() user: AuthUser,
    @Param('groupId') groupId: string,
    @Query('date') date: string,
  ) {
    return this.service.listKidNotesForGroup(user, groupId, date)
  }
}

@Module({
  controllers: [DiaryController],
  providers: [DiaryService],
})
export class DiaryModule {}
