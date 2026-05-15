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
import { MealType } from '@prisma/client'
import { IsDateString, IsEnum, IsOptional, IsInt, IsString, Min } from 'class-validator'

import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { PrismaModule } from '../../infrastructure/prisma/prisma.module'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'

class CreateMenuDto {
  @IsDateString() date!: string
  @IsEnum(MealType) meal!: MealType
  @IsString() title!: string
  @IsOptional() @IsString() description?: string
  @IsOptional() @IsInt() @Min(0) calories?: number
}

class UpdateMenuDto {
  @IsOptional() @IsDateString() date?: string
  @IsOptional() @IsEnum(MealType) meal?: MealType
  @IsOptional() @IsString() title?: string
  @IsOptional() @IsString() description?: string
  @IsOptional() @IsInt() @Min(0) calories?: number
}

@Injectable()
class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  list(
    user: AuthUser,
    params: { date?: string; month?: string },
  ) {
    const where: Record<string, unknown> = user.kindergartenId
      ? { kindergartenId: user.kindergartenId }
      : {}
    if (params.date) {
      const d = new Date(params.date)
      where.date = d
    } else if (params.month) {
      // YYYY-MM → start..end
      const [y, m] = params.month.split('-').map(Number)
      const start = new Date(y, m - 1, 1)
      const end = new Date(y, m, 1)
      where.date = { gte: start, lt: end }
    }
    return this.prisma.menuItem.findMany({
      where,
      orderBy: [{ date: 'asc' }, { meal: 'asc' }],
    })
  }

  async create(user: AuthUser, dto: CreateMenuDto) {
    if (!user.kindergartenId) {
      throw new ForbiddenException('Не привязан к садику')
    }
    if (!dto.title?.trim()) {
      throw new BadRequestException('Название обязательно')
    }
    return this.prisma.menuItem.create({
      data: {
        date: new Date(dto.date),
        meal: dto.meal,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        calories: dto.calories || null,
        kindergartenId: user.kindergartenId,
      },
    })
  }

  async update(user: AuthUser, id: string, dto: UpdateMenuDto) {
    const existing = await this.prisma.menuItem.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Не найдено')
    if (
      user.kindergartenId &&
      existing.kindergartenId !== user.kindergartenId
    ) {
      throw new ForbiddenException('Из другого садика')
    }
    return this.prisma.menuItem.update({
      where: { id },
      data: {
        date: dto.date ? new Date(dto.date) : undefined,
        meal: dto.meal,
        title: dto.title?.trim(),
        description: dto.description?.trim(),
        calories: dto.calories,
      },
    })
  }

  async remove(user: AuthUser, id: string) {
    const existing = await this.prisma.menuItem.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Не найдено')
    if (
      user.kindergartenId &&
      existing.kindergartenId !== user.kindergartenId
    ) {
      throw new ForbiddenException('Из другого садика')
    }
    await this.prisma.menuItem.delete({ where: { id } })
    return { success: true }
  }
}

@ApiTags('menu')
@ApiBearerAuth()
@Controller({ path: 'menu', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
class MenuController {
  constructor(private readonly service: MenuService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('date') date?: string,
    @Query('month') month?: string,
  ) {
    return this.service.list(user, { date, month })
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateMenuDto) {
    return this.service.create(user, dto)
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateMenuDto,
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
  imports: [PrismaModule],
  controllers: [MenuController],
  providers: [MenuService],
})
export class MenuModule {}
