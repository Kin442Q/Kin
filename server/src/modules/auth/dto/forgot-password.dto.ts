import { ApiProperty } from '@nestjs/swagger'
import { IsOptional, IsString } from 'class-validator'

/**
 * Запрос на восстановление доступа. Указывается email ИЛИ телефон —
 * тот же логин, что и при входе. Если у человека настоящий email, ему уходит
 * письмо со ссылкой для нового пароля; иначе запрос приходит администратору,
 * и тот отправляет ссылку сам (пароль не называет никто).
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
