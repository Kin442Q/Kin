import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Request, Response } from 'express'
import { AuthGuard } from '@nestjs/passport'

import { AuthService } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { RegisterDto } from './dto/register.dto'
import { ForgotPasswordDto } from './dto/forgot-password.dto'
import { Public } from '../../common/decorators/public.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthUser } from '../../common/types/jwt-payload'

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

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
    return {
      user: result.user,
      accessToken: result.accessToken,
    }
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
    return { user: result.user, accessToken: result.accessToken }
  }

  // ---------------- Forgot password (запрос админу) ------------
  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Запросить сброс пароля — уведомление администратору' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.requestPasswordReset(dto)
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
    return { accessToken: tokens.accessToken, user: tokens.user }
  }

  // ---------------- Logout -------------------------------------
  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response, @CurrentUser() user: AuthUser) {
    // Если есть refresh-cookie — извлекаем jti (быстрая decode)
    const refresh = req.cookies?.refreshToken
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

  // ---------------- Register (only super admin) ----------------
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  @Post('register')
  register(@Body() dto: RegisterDto, @CurrentUser() user: AuthUser) {
    return this.auth.register({ role: user.role }, dto)
  }

  // ============================================================
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
