import {
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
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { TermType } from '@prisma/client'
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'

class CreateTermDto {
  @IsString() @MaxLength(60) name!: string
  @IsOptional() @IsEnum(TermType) type?: TermType
  @IsDateString() startDate!: string
  @IsDateString() endDate!: string
}
class UpdateTermDto {
  @IsOptional() @IsString() @MaxLength(60) name?: string
  @IsOptional() @IsEnum(TermType) type?: TermType
  @IsOptional() @IsDateString() startDate?: string
  @IsOptional() @IsDateString() endDate?: string
}

@Injectable()
export class TermsService {
  constructor(private readonly prisma: PrismaService) {}

  private tenant(user: AuthUser) {
    return user.kindergartenId ? { kindergartenId: user.kindergartenId } : {}
  }

  async list(user: AuthUser) {
    return this.prisma.term.findMany({
      where: this.tenant(user),
      orderBy: { startDate: 'asc' },
    })
  }

  /** Текущий период (в который попадает сегодня). */
  async current(user: AuthUser) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return this.prisma.term.findFirst({
      where: {
        ...this.tenant(user),
        startDate: { lte: today },
        endDate: { gte: today },
      },
      orderBy: { startDate: 'desc' },
    })
  }

  async create(user: AuthUser, dto: CreateTermDto) {
    if (!user.kindergartenId) {
      throw new ForbiddenException('Не привязан к учреждению')
    }
    const start = new Date(dto.startDate)
    const end = new Date(dto.endDate)
    if (end < start) {
      throw new ForbiddenException('Дата конца раньше начала')
    }
    return this.prisma.term.create({
      data: {
        name: dto.name.trim(),
        type: dto.type ?? 'QUARTER',
        startDate: start,
        endDate: end,
        kindergartenId: user.kindergartenId,
      },
    })
  }

  async update(user: AuthUser, id: string, dto: UpdateTermDto) {
    await this.assertAccess(user, id)
    return this.prisma.term.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        type: dto.type,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    })
  }

  async remove(user: AuthUser, id: string) {
    await this.assertAccess(user, id)
    await this.prisma.term.delete({ where: { id } })
  }

  private async assertAccess(user: AuthUser, id: string) {
    const t = await this.prisma.term.findUnique({ where: { id } })
    if (!t) throw new NotFoundException('Период не найден')
    if (user.kindergartenId && t.kindergartenId !== user.kindergartenId) {
      throw new ForbiddenException('Период из другого учреждения')
    }
    return t
  }
}

@ApiTags('terms')
@ApiBearerAuth()
@Controller({ path: 'terms', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER', 'PARENT')
class TermsController {
  constructor(private readonly service: TermsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user)
  }

  @Get('current')
  @ApiOperation({ summary: 'Текущий учебный период (в который попадает сегодня)' })
  current(@CurrentUser() user: AuthUser) {
    return this.service.current(user)
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTermDto) {
    return this.service.create(user, dto)
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTermDto,
  ) {
    return this.service.update(user, id, dto)
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('SUPER_ADMIN', 'ADMIN')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id)
  }
}

@Module({
  controllers: [TermsController],
  providers: [TermsService],
  exports: [TermsService],
})
export class TermsModule {}
