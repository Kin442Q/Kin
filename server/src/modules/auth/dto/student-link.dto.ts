import { ApiProperty } from '@nestjs/swagger'
import { IsString, MaxLength } from 'class-validator'

/** Вход ученика по личной ссылке: токен — часть после «/s/» в ссылке. */
export class StudentLinkDto {
  @ApiProperty({ description: 'Токен из личной ссылки ученика' })
  // Минимальной длины нет намеренно: любой мусор получает тот же ответ "ссылка не работает".
  @IsString()
  @MaxLength(200)
  token!: string
}
