import { IsOptional, IsString, IsUrl, MaxLength, MinLength, ValidateIf } from 'class-validator'

/** Сколько дней живёт материал к уроку. По истечении запись и файл удаляются сами. */
export const LESSON_MATERIAL_TTL_DAYS = 30

export class CreateLessonMaterialDto {
  @IsString()
  groupId!: string

  @IsOptional()
  @IsString()
  subjectId?: string | null

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string

  /** Текст урока / пояснение учителя. */
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null

  /** Ссылка (YouTube, Google Drive, сайт школы). Нужна хотя бы одна из трёх: файл, ссылка, текст. */
  @IsOptional()
  @ValidateIf((o) => o.url !== undefined && o.url !== null && o.url !== '')
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_tld: false })
  @MaxLength(2000)
  url?: string | null

  /** id файла, загруженного через POST /lesson-materials/upload. */
  @IsOptional()
  @IsString()
  fileId?: string | null
}
