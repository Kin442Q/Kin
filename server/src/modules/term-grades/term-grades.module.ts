import { Body, Controller, Delete, Get, Module, Put, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { IsInt, IsString, Max, Min } from 'class-validator'

import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Feature } from '../../common/decorators/feature.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'
import { ClassAccessModule } from '../class-access/class-access.module'
import { TermGradesService } from './term-grades.service'

class ClassTermGradesQuery {
  @IsString() termId!: string
  @IsString() subjectId!: string
  @IsString() groupId!: string
}

class StudentTermGradeQuery {
  @IsString() termId!: string
  @IsString() subjectId!: string
  @IsString() studentId!: string
}

class SetTermGradeDto extends StudentTermGradeQuery {
  /** Точную границу (5 или 10) проверяет сервис по шкале школы. */
  @IsInt() @Min(1) @Max(10) value!: number
}

@ApiTags('term-grades')
@ApiBearerAuth()
@Feature('grades', 'terms')
@Controller({ path: 'term-grades', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
class TermGradesController {
  constructor(private readonly service: TermGradesService) {}

  @Get()
  @ApiOperation({ summary: 'Итоги четверти класса по предмету: расчёт и оценка учителя' })
  list(@CurrentUser() user: AuthUser, @Query() query: ClassTermGradesQuery) {
    return this.service.list(user, query)
  }

  @Put()
  @Roles('TEACHER')
  @ApiOperation({ summary: 'Поставить или изменить итог четверти (только учитель)' })
  set(@CurrentUser() user: AuthUser, @Body() dto: SetTermGradeDto) {
    return this.service.set(user, dto)
  }

  @Delete()
  @Roles('TEACHER')
  @ApiOperation({ summary: 'Сбросить оценку учителя: снова действует расчётный итог' })
  reset(@CurrentUser() user: AuthUser, @Query() query: StudentTermGradeQuery) {
    return this.service.reset(user, query)
  }
}

@Module({
  imports: [ClassAccessModule],
  controllers: [TermGradesController],
  providers: [TermGradesService],
})
export class TermGradesModule {}
