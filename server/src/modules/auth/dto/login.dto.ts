import { ApiProperty } from '@nestjs/swagger'
import { IsOptional, IsString, MinLength } from 'class-validator'

/**
 * Поддерживается логин по email ИЛИ по телефону.
 * Должно быть указано одно из двух.
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

  @ApiProperty({ example: 'Admin123456!' })
  @IsString()
  @MinLength(1)
  password!: string
}
