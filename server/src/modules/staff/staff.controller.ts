import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { StaffPosition } from '@prisma/client'
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator'

import { StaffService } from './staff.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'

enum RoleDto {
  TEACHER = 'TEACHER',
  ADMIN = 'ADMIN',
}

enum SalaryModeDto {
  HOURLY = 'HOURLY',
  FIXED = 'FIXED',
}

class CreateStaffBody {
  @IsString() firstName!: string
  @IsString() lastName!: string
  @IsOptional() @IsString() middleName?: string
  @IsEnum(StaffPosition) position!: StaffPosition
  @IsString() phone!: string
  @IsOptional() @IsEmail() email?: string
  @IsOptional() @IsString() groupId?: string | null
  @IsNumber() @Min(0) salary!: number
  @IsDateString() hireDate!: string

  // ─── Логин в систему ────────────────────────────────────────
  @IsOptional() @IsBoolean() canLogin?: boolean
  @IsOptional() @IsString() @MinLength(6) password?: string
  @IsOptional() @IsEnum(RoleDto) role?: RoleDto

  // ─── Параметры зарплаты для тех у кого учётка ────────────────
  @IsOptional() @IsEnum(SalaryModeDto) salaryMode?: SalaryModeDto
  @IsOptional() @IsNumber() @Min(0) hourlyRate?: number
  @IsOptional() @IsNumber() @Min(0) monthlySalaryFixed?: number
  @IsOptional() @IsInt() @Min(1) workNorm?: number
  @IsOptional() @IsString() terminalCode?: string
}

class UpdateStaffBody {
  @IsOptional() @IsString() firstName?: string
  @IsOptional() @IsString() lastName?: string
  @IsOptional() @IsString() middleName?: string
  @IsOptional() @IsEnum(StaffPosition) position?: StaffPosition
  @IsOptional() @IsString() phone?: string
  @IsOptional() @IsEmail() email?: string
  @IsOptional() @IsString() groupId?: string | null
  @IsOptional() @IsNumber() @Min(0) salary?: number
  @IsOptional() @IsDateString() hireDate?: string

  @IsOptional() @IsBoolean() canLogin?: boolean
  @IsOptional() @IsString() @MinLength(6) password?: string
  @IsOptional() @IsEnum(RoleDto) role?: RoleDto

  @IsOptional() @IsEnum(SalaryModeDto) salaryMode?: SalaryModeDto
  @IsOptional() @IsNumber() @Min(0) hourlyRate?: number
  @IsOptional() @IsNumber() @Min(0) monthlySalaryFixed?: number
  @IsOptional() @IsInt() @Min(1) workNorm?: number
  @IsOptional() @IsString() terminalCode?: string
}

@ApiTags('staff')
@ApiBearerAuth()
@Controller({ path: 'staff', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
export class StaffController {
  constructor(private readonly service: StaffService) {}

  @Get()
  @ApiQuery({ name: 'position', required: false, enum: StaffPosition })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('position') position?: StaffPosition,
  ) {
    return this.service.findAll(user, { position })
  }

  @Post()
  @ApiOperation({ summary: 'Создать сотрудника (+ опционально учётку для входа)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateStaffBody) {
    return this.service.create(user, dto as any)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить сотрудника (+ опционально учётку)' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateStaffBody,
  ) {
    return this.service.update(user, id, dto as any)
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user, id)
  }
}
