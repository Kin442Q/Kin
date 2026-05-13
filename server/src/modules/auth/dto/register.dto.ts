import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator'
import { Role } from '@prisma/client'

/**
 * Регистрация (вызывается только SUPER_ADMIN-ом).
 * Для self-signup такого эндпоинта не существует.
 */
export class RegisterDto {
  @ApiProperty()
  @IsEmail()
  email!: string

  @ApiProperty({ minLength: 6 })
  @IsString()
  @MinLength(6)
  password!: string

  @ApiProperty()
  @IsString()
  @MinLength(2)
  fullName!: string

  @ApiProperty({ enum: Role })
  @IsEnum(Role)
  role!: Role

  @ApiProperty({ required: false, description: 'Для TEACHER — id группы' })
  @IsOptional()
  @IsString()
  groupId?: string
}
