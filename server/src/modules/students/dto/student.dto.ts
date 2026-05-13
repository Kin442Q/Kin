import { ApiProperty, PartialType } from '@nestjs/swagger'
import { Gender, StudentStatus } from '@prisma/client'
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator'

export class CreateStudentDto {
  @ApiProperty()
  @IsString()
  firstName!: string

  @ApiProperty()
  @IsString()
  lastName!: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  middleName?: string

  @ApiProperty()
  @IsDateString()
  birthDate!: string

  @ApiProperty({ enum: Gender })
  @IsEnum(Gender)
  gender!: Gender

  @ApiProperty()
  @IsString()
  groupId!: string

  @ApiProperty({ required: false })
  @IsOptional() @IsString() photoUrl?: string

  @ApiProperty({ required: false })
  @IsOptional() @IsString() medicalNotes?: string

  @ApiProperty({ required: false })
  @IsOptional() @IsString() notes?: string

  // Родители
  @IsOptional() @IsString() motherName?: string
  @IsOptional() @IsString() motherPhone?: string
  @IsOptional() @IsString() fatherName?: string
  @IsOptional() @IsString() fatherPhone?: string
  @IsOptional() @IsString() address?: string
  @IsOptional() @IsString() extraContact?: string
  @IsOptional() @IsString() telegram?: string
  @IsOptional() @IsString() whatsapp?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyFee?: number

  @ApiProperty({ enum: StudentStatus, required: false })
  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus
}

export class UpdateStudentDto extends PartialType(CreateStudentDto) {}
