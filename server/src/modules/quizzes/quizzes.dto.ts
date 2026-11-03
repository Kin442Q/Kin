import { PartialType } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator'

import { QUIZ_LIMITS } from './quiz-logic'

export class OptionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(QUIZ_LIMITS.maxOptionText)
  text!: string

  @IsBoolean()
  correct!: boolean
}

export class QuestionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(QUIZ_LIMITS.maxQuestionText)
  text!: string

  @IsIn(['SINGLE', 'MULTIPLE'])
  kind!: 'SINGLE' | 'MULTIPLE'

  @IsArray()
  @ArrayMinSize(QUIZ_LIMITS.minOptions)
  @ArrayMaxSize(QUIZ_LIMITS.maxOptions)
  @ValidateNested({ each: true })
  @Type(() => OptionDto)
  options!: OptionDto[]

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  explanation?: string | null
}

export class CreateQuizDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null

  @IsOptional()
  @IsString()
  subjectId?: string | null

  /** Направление подготовки к экзамену (необязательно). */
  @IsOptional()
  @IsString()
  examTrackId?: string | null

  /** Лимит времени, секунды. Не указан — без лимита. */
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(14400)
  timeLimitSec?: number | null

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(QUIZ_LIMITS.maxQuestions)
  @ValidateNested({ each: true })
  @Type(() => QuestionDto)
  questions!: QuestionDto[]
}

/** При правке все поля необязательны; если переданы questions — они заменяют все вопросы. */
export class UpdateQuizDto extends PartialType(CreateQuizDto) {}

export class AnswerDto {
  @IsString()
  questionId!: string

  @IsArray()
  @ArrayMaxSize(QUIZ_LIMITS.maxOptions)
  @IsInt({ each: true })
  selected!: number[]
}

export class SubmitAttemptDto {
  @IsArray()
  @ArrayMaxSize(QUIZ_LIMITS.maxQuestions)
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers!: AnswerDto[]

  /** Сколько секунд ученик потратил (считает клиент, сервер только сохраняет). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86400)
  durationSec?: number
}
