import { ApiProperty } from '@nestjs/swagger'
import { IsString, MaxLength, MinLength } from 'class-validator'

/** Установка пароля по одноразовой ссылке из письма (приглашение или сброс). */
export class SetPasswordDto {
  @ApiProperty({ description: 'Токен из ссылки письма' })
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  token!: string

  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8, { message: 'Пароль минимум 8 символов' })
  @MaxLength(128)
  password!: string
}
