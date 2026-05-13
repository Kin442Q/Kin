import {
  Body,
  Controller,
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
    res.clearCookie('refreshToken')
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
    res.cookie('refreshToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
      expires: expiresAt,
    })
  }
}
