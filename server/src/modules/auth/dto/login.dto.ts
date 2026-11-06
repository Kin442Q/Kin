import { ApiProperty } from '@nestjs/swagger'
import { IsOptional, IsString, MinLength } from 'class-validator'

/**
 * Поддерживается вход по email, по телефону ИЛИ по логину ученика (его выдаёт классный руководитель).
 * Должно быть указано одно из трёх.
 */
export class LoginDto {
  @ApiProperty({ example: 'admin@kindergarten.tj', required: false })
  @IsOptional()
  @IsString()
  email?: string

  @ApiProperty({ example: '+992901234567', required: false })
  @IsOptional()
  @IsString()
  phone?: string

  @ApiProperty({ example: 'st4k9x2m', required: false, description: 'Логин ученика' })
  @IsOptional()
  @IsString()
  login?: string

  @ApiProperty({ example: 'Admin123456!' })
  @IsString()
  @MinLength(1)
  password!: string
}
