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
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator'

import { TimeTrackingService } from './time-tracking.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'

enum VerifyMethodDto {
  MANUAL = 'MANUAL',
  FACE = 'FACE',
  PIN = 'PIN',
  QR = 'QR',
}

enum SalaryModeDto {
  HOURLY = 'HOURLY',
  FIXED = 'FIXED',
}

class CheckInBody {
  @IsOptional() @IsEnum(VerifyMethodDto) verifyMethod?: VerifyMethodDto
  @IsOptional() @IsString() @MaxLength(500) note?: string
  /** GPS-координаты из мобайла (для геофенс-валидации) */
  @IsOptional() @IsNumber() lat?: number
  @IsOptional() @IsNumber() lon?: number
}

class CheckOutBody {
  @IsOptional() @IsString() @MaxLength(500) note?: string
}

class UpdateEntryBody {
  @IsOptional() @IsDateString() checkIn?: string
  @IsOptional() @IsDateString() checkOut?: string
  @IsOptional() @IsString() @MaxLength(500) note?: string
}

class SetSalaryBody {
  @IsOptional() @IsEnum(SalaryModeDto) salaryMode?: SalaryModeDto
  @IsOptional() @IsNumber() hourlyRate?: number
  @IsOptional() @IsNumber() monthlySalaryFixed?: number
  @IsOptional() @IsInt() @Min(1) workNorm?: number
}

class SetFaceBody {
  @IsArray() descriptor!: number[]
}

@ApiTags('time-tracking')
@ApiBearerAuth()
@Controller({ path: 'time', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
export class TimeTrackingController {
  constructor(private readonly service: TimeTrackingService) {}

  // ─── Учитель ─────────────────────────────────────────────────────

  @Post('check-in')
  @ApiOperation({ summary: 'Отметить приход (старт смены)' })
  checkIn(@CurrentUser() user: AuthUser, @Body() dto: CheckInBody) {
    return this.service.checkIn(user, dto as any)
  }

  @Post('check-out')
  @ApiOperation({ summary: 'Отметить уход (конец смены)' })
  checkOut(@CurrentUser() user: AuthUser, @Body() dto: CheckOutBody) {
    return this.service.checkOut(user, dto)
  }

  @Get('status')
  @ApiOperation({ summary: 'Текущая открытая смена (если есть)' })
  status(@CurrentUser() user: AuthUser) {
    return this.service.myStatus(user)
  }

  @Get('me')
  @ApiOperation({ summary: 'Мои записи за месяц + сводка зарплаты' })
  @ApiQuery({ name: 'month', required: true, description: 'YYYY-MM' })
  myMonth(@CurrentUser() user: AuthUser, @Query('month') month: string) {
    return this.service.myMonth(user, month)
  }

  // ─── Face ID ─────────────────────────────────────────────────────

  @Post('face')
  @ApiOperation({ summary: 'Зарегистрировать/обновить мой face descriptor' })
  setFace(@CurrentUser() user: AuthUser, @Body() dto: SetFaceBody) {
    return this.service.setMyFace(user, dto.descriptor)
  }

  @Get('face')
  @ApiOperation({ summary: 'Получить мой сохранённый face descriptor' })
  getFace(@CurrentUser() user: AuthUser) {
    return this.service.getMyFace(user)
  }

  // ─── Админ ───────────────────────────────────────────────────────

  @Get('teachers')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Сводка по всем учителям садика за месяц' })
  @ApiQuery({ name: 'month', required: true })
  allTeachers(@CurrentUser() user: AuthUser, @Query('month') month: string) {
    return this.service.allTeachersMonth(user, month)
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Коррекция записи (только админ)' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateEntryBody,
  ) {
    return this.service.updateEntry(user, id, dto)
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Удалить запись (только админ)' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.deleteEntry(user, id)
  }

  @Patch('teacher/:id/salary')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Установить зарплатные параметры учителя' })
  setSalary(
    @CurrentUser() user: AuthUser,
    @Param('id') teacherId: string,
    @Body() dto: SetSalaryBody,
  ) {
    return this.service.setTeacherSalary(user, teacherId, dto as any)
  }

  @Post('setup-demo-teachers')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary:
      'Обновить демо-учителей телефонами/кодами/ставками (идемпотентно, для тестирования)',
  })
  setupDemoTeachers(@CurrentUser() user: AuthUser) {
    return this.service.setupDemoTeachers(user)
  }
}
