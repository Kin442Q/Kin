import { ApiProperty, PartialType } from '@nestjs/swagger'
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator'

export class CreateGroupDto {
  @ApiProperty()
  @IsString()
  name!: string

  @ApiProperty()
  @IsString()
  ageRange!: string

  @ApiProperty({ default: 20, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number

  // Необязательны: если разделы «Оплата»/«Расходы» выключены для учреждения,
  // клиент их не отправляет, и в БД берётся default(0) из схемы.
  @ApiProperty({ default: 0, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyFee?: number

  @ApiProperty({ default: 0, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fixedMonthlyExpense?: number

  @ApiProperty({ default: '#6366f1' })
  @IsString()
  color!: string

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}

export class UpdateGroupDto extends PartialType(CreateGroupDto) {}
