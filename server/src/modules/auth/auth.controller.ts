import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Request, Response } from 'express'
import { AuthGuard } from '@nestjs/passport'
import { Throttle } from '@nestjs/throttler'

import { AuthService } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { ForgotPasswordDto } from './dto/forgot-password.dto'
import { SetPasswordDto } from './dto/set-password.dto'
import { StudentLinkDto } from './dto/student-link.dto'
import { ChangePasswordDto } from './dto/change-password.dto'
import { ChangeEmailDto } from './dto/change-email.dto'
import { PasswordTokensService } from '../password-tokens/password-tokens.service'
import { Public } from '../../common/decorators/public.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly passwordTokens: PasswordTokensService,
  ) {}

  // ---------------- Login --------------------------------------
  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Логин по email/password' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    })

    this.setRefreshCookie(res, result.refreshToken, result.refreshTokenExpiresAt)
    return this.tokenBody(req, result)
  }

  // ---------------- Вход ученика по личной ссылке --------------
  @Public()
  // Мягкий лимит: ученики класса входят с одного школьного адреса, поэтому он выше, чем у обычного входа.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('student-link')
  @HttpCode(200)
  @ApiOperation({ summary: 'Вход ученика по личной ссылке от классного руководителя' })
  async studentLink(
    @Body() dto: StudentLinkDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.loginWithStudentLink(dto.token, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    })
    this.setRefreshCookie(res, result.refreshToken, result.refreshTokenExpiresAt)
    return this.tokenBody(req, result)
  }

  // ---------------- Demo login (живое демо) --------------------
  @Public()
  @Post('demo-login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Войти в живое демо (учреждение isDemo, read-only)' })
  async demoLogin(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.demoLogin({
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    })
    this.setRefreshCookie(res, result.refreshToken, result.refreshTokenExpiresAt)
    return this.tokenBody(req, result)
  }

  // ---------------- Forgot password ----------------------------
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('forgot-password')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Забыли пароль: ссылка на email, а без email — запрос администратору',
  })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.requestPasswordReset(dto)
  }

  // ---------------- Пароль по ссылке из письма -----------------
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('password-token/:token')
  @ApiOperation({ summary: 'Проверить ссылку из письма (приглашение или сброс пароля)' })
  checkPasswordToken(@Param('token') token: string) {
    return this.passwordTokens.inspect(token)
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('set-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Задать пароль по одноразовой ссылке из письма' })
  setPassword(@Body() dto: SetPasswordDto) {
    return this.passwordTokens.consume(dto.token, dto.password)
  }

  // ---------------- Refresh ------------------------------------
  @Public()
  @ApiCookieAuth('refreshToken')
  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const payload = req.user as { sub: string; jti: string; raw: string }
    const tokens = await this.auth.refresh(payload, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    })
    this.setRefreshCookie(res, tokens.refreshToken, tokens.refreshTokenExpiresAt)
    return this.tokenBody(req, tokens)
  }

  // ---------------- Logout -------------------------------------
  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response, @CurrentUser() user: AuthUser) {
    // Если есть refresh-токен (cookie у сайта, тело запроса у мобильного приложения) — извлекаем jti (быстрая decode)
    const bodyToken = (req.body as { refreshToken?: unknown } | undefined)?.refreshToken
    const refresh = req.cookies?.refreshToken ?? (typeof bodyToken === 'string' ? bodyToken : undefined)
    let jti: string | undefined
    if (refresh) {
      try {
        const decoded = JSON.parse(Buffer.from(refresh.split('.')[1], 'base64').toString())
        jti = decoded.jti
      } catch {/* */}
    }
    const accessHeader = req.headers.authorization?.replace('Bearer ', '')
    let accessJti: string | undefined
    if (accessHeader) {
      try {
        const decoded = JSON.parse(Buffer.from(accessHeader.split('.')[1], 'base64').toString())
        accessJti = decoded.jti
      } catch {/* */}
    }

    await this.auth.logout(user.sub, jti, accessJti)
    res.clearCookie('refreshToken', { path: '/api/v1/auth' })
  }

  // ---------------- Current user -------------------------------
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({
    summary: 'Текущий пользователь + учреждение (тип, координаты, радиус)',
  })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.sub)
  }

  // ---------------- Смена своего пароля ------------------------
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('change-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Сменить свой пароль (нужен текущий). Остальные устройства выходят.' })
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.changePassword(user.sub, dto, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    })
    this.setRefreshCookie(res, result.refreshToken, result.refreshTokenExpiresAt)
    return this.tokenBody(req, result)
  }

  // ---------------- Смена своего email (логина) ----------------
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('change-email')
  @HttpCode(200)
  @ApiOperation({ summary: 'Сменить свой email (логин): нужен текущий пароль' })
  async changeEmail(
    @Body() dto: ChangeEmailDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.changeEmail(user.sub, dto, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    })
    this.setRefreshCookie(res, result.refreshToken, result.refreshTokenExpiresAt)
    return this.tokenBody(req, result)
  }

  // ============================================================
  /**
   * Тело ответа с токенами. Сайт получает refresh-токен в httpOnly cookie, а мобильное приложение
   * cookie не хранит: ему (заголовок `X-Client: mobile`) refresh-токен отдаётся в теле, и оно
   * присылает его в теле запроса /auth/refresh и /auth/logout.
   */
  private tokenBody(
    req: Request,
    result: { user: unknown; accessToken: string; refreshToken: string; refreshTokenExpiresAt: Date },
  ) {
    const base = { user: result.user, accessToken: result.accessToken }
    return req.headers['x-client'] === 'mobile'
      ? { ...base, refreshToken: result.refreshToken, refreshTokenExpiresAt: result.refreshTokenExpiresAt }
      : base
  }

  private setRefreshCookie(res: Response, token: string, expiresAt: Date) {
    const isProd = process.env.NODE_ENV === 'production'
    res.cookie('refreshToken', token, {
      httpOnly: true,
      // В проде фронт и бэкенд на разных доменах (GitHub Pages ↔ Railway),
      // поэтому cookie должна быть SameSite=None; Secure — иначе браузер
      // не отправит её на cross-site запрос /auth/refresh. В деве (один хост)
      // — Lax, без Secure (http).
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/api/v1/auth',
      expires: expiresAt,
    })
  }
}
