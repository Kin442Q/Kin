import {
  Module,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  UseGuards,
  Query,
  Injectable,
  Param,
  HttpCode,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { IsNumber, IsOptional, IsString, Min } from 'class-validator'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { PrismaModule } from '../../infrastructure/prisma/prisma.module'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'

class CreateExtraIncomeDto {
  @IsString() title!: string
  @IsNumber() @Min(0) amount!: number
  @IsString() month!: string
  @IsOptional() @IsString() groupId?: string
  @IsOptional() @IsString() comment?: string
}

class UpdateExtraIncomeDto {
  @IsOptional() @IsString() title?: string
  @IsOptional() @IsNumber() @Min(0) amount?: number
  @IsOptional() @IsString() month?: string
  @IsOptional() @IsString() groupId?: string | null
  @IsOptional() @IsString() comment?: string
}

@Injectable()
class ExtraIncomeService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: AuthUser, params: { month?: string; groupId?: string }) {
    return this.prisma.extraIncome.findMany({
      where: {
        ...(user.kindergartenId
          ? { kindergartenId: user.kindergartenId }
          : {}),
        ...(params.month ? { month: params.month } : {}),
        ...(params.groupId ? { groupId: params.groupId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async create(user: AuthUser, dto: CreateExtraIncomeDto) {
    if (!user.kindergartenId) {
      throw new ForbiddenException('Не привязан к садику')
    }
    if (!dto.title?.trim()) {
      throw new BadRequestException('Название обязательно')
    }
    if (dto.groupId) {
      const g = await this.prisma.group.findUnique({
        where: { id: dto.groupId },
      })
      if (!g) throw new NotFoundException('Группа не найдена')
      if (g.kindergartenId !== user.kindergartenId) {
        throw new ForbiddenException('Группа из другого садика')
      }
    }
    return this.prisma.extraIncome.create({
      data: {
        title: dto.title.trim(),
        amount: dto.amount,
        month: dto.month,
        groupId: dto.groupId || null,
        comment: dto.comment?.trim() || null,
        kindergartenId: user.kindergartenId,
      },
    })
  }

  async update(user: AuthUser, id: string, dto: UpdateExtraIncomeDto) {
    const existing = await this.prisma.extraIncome.findUnique({
      where: { id },
    })
    if (!existing) throw new NotFoundException('Запись не найдена')
    if (
      user.kindergartenId &&
      existing.kindergartenId !== user.kindergartenId
    ) {
      throw new ForbiddenException('Из другого садика')
    }
    return this.prisma.extraIncome.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        amount: dto.amount,
        month: dto.month,
        groupId:
          dto.groupId !== undefined ? dto.groupId || null : undefined,
        comment: dto.comment?.trim(),
      },
    })
  }

  async remove(user: AuthUser, id: string) {
    const existing = await this.prisma.extraIncome.findUnique({
      where: { id },
    })
    if (!existing) throw new NotFoundException('Запись не найдена')
    if (
      user.kindergartenId &&
      existing.kindergartenId !== user.kindergartenId
    ) {
      throw new ForbiddenException('Из другого садика')
    }
    await this.prisma.extraIncome.delete({ where: { id } })
    return { success: true }
  }
}

@ApiTags('extra-income')
@ApiBearerAuth()
@Controller({ path: 'extra-income', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
class ExtraIncomeController {
  constructor(private readonly service: ExtraIncomeService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('month') month?: string,
    @Query('groupId') groupId?: string,
  ) {
    return this.service.list(user, { month, groupId })
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateExtraIncomeDto,
  ) {
    return this.service.create(user, dto)
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateExtraIncomeDto,
  ) {
    return this.service.update(user, id, dto)
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id)
  }
}

@Module({
  imports: [PrismaModule],
  controllers: [ExtraIncomeController],
  providers: [ExtraIncomeService],
})
export class ExtraIncomeModule {}
