import { SetMetadata } from '@nestjs/common'

export const IS_PUBLIC_KEY = 'isPublic'

/** Помечает эндпоинт как доступный без авторизации. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)
