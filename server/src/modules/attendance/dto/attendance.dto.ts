import { ApiProperty } from '@nestjs/swagger'
import { AttendanceStatus } from '@prisma/client'
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator'

export class MarkAttendanceDto {
  @ApiProperty()
  @IsString()
  studentId!: string

  @ApiProperty({ description: 'YYYY-MM-DD' })
  @IsDateString()
  date!: string

  @ApiProperty({ enum: AttendanceStatus })
  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string
}
