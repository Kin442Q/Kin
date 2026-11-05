import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsString, MaxLength } from 'class-validator'

/** Смена своего email (он же логин): нужен текущий пароль. */
export class ChangeEmailDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  currentPassword!: string

  @ApiProperty()
  @IsEmail({}, { message: 'Укажите настоящий email' })
  @MaxLength(200)
  newEmail!: string
}
