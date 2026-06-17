import { ApiProperty } from '@nestjs/swagger'
import { IsOptional, IsString } from 'class-validator'

/**
 * Запрос на восстановление доступа. Указывается email ИЛИ телефон —
 * тот же логин, что и при входе. Реальный сброс пароля делает
 * администратор: запрос приходит ему уведомлением.
 */
export class ForgotPasswordDto {
  @ApiProperty({ example: 'admin@kindergarten.tj', required: false })
  @IsOptional()
  @IsString()
  email?: string

  @ApiProperty({ example: '+992901234567', required: false })
  @IsOptional()
  @IsString()
  phone?: string
}
