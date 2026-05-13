import { Controller, Get, Module } from '@nestjs/common'
import { HealthCheckService, TerminusModule } from '@nestjs/terminus'
import { ApiTags } from '@nestjs/swagger'
import { Public } from '../../common/decorators/public.decorator'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import { RedisService } from '../../infrastructure/redis/redis.service'

@ApiTags('health')
@Controller('health')
class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get('liveness')
  liveness() {
    return { ok: true, ts: Date.now() }
  }

  @Public()
  @Get('readiness')
  async readiness() {
    return this.health.check([
      async () => {
        await this.prisma.$queryRaw`SELECT 1`
        return { db: { status: 'up' } }
      },
      async () => {
        const pong = await this.redis.client.ping()
        return { redis: { status: pong === 'PONG' ? 'up' : 'down' } }
      },
    ])
  }
}

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
})
export class HealthModule {}
