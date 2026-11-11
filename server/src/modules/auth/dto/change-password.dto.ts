import { ApiProperty } from '@nestjs/swagger'
import { IsString, MaxLength, MinLength } from 'class-validator'

/** Смена своего пароля: нужен текущий (его знает только владелец аккаунта). */
export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  currentPassword!: string

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Пароль минимум 8 символов' })
  @MaxLength(200)
  newPassword!: string
}
