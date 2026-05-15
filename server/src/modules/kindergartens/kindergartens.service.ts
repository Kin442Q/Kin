import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common'
import bcrypt from 'bcryptjs'
import { PrismaService } from '../../infrastructure/prisma/prisma.service'
import type { AuthUser } from '../../common/types/jwt-payload'

interface CreateKindergartenDto {
  name: string
  address?: string
  phone?: string
  owner: {
    fullName: string
    email: string
    password: string
  }
}

interface UpdateKindergartenDto {
  name?: string
  address?: string
  phone?: string
  isActive?: boolean
}

@Injectable()
export class KindergartensService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Только глобальный супер-админ (kindergartenId === null) может управлять
   * списком садиков.
   */
  private assertGlobalOwner(user: AuthUser) {
    if (user.kindergartenId) {
      throw new ForbiddenException(
        'Только владелец платформы может управлять садиками',
      )
    }
    if (user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Доступ запрещён')
    }
  }

  /** Список всех садиков + статистика. */
  async list(user: AuthUser) {
    this.assertGlobalOwner(user)
    const kindergartens = await this.prisma.kindergarten.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            users: true,
            groups: true,
            students: true,
          },
        },
      },
    })

    return kindergartens.map((k) => ({
      id: k.id,
      slug: k.slug,
      name: k.name,
      address: k.address,
      phone: k.phone,
      isActive: k.isActive,
      createdAt: k.createdAt,
      stats: {
        usersCount: k._count.users,
        groupsCount: k._count.groups,
        studentsCount: k._count.students,
      },
    }))
  }

  /** Создать новый садик + первого SUPER_ADMIN. Атомарно. */
  async create(user: AuthUser, dto: CreateKindergartenDto) {
    this.assertGlobalOwner(user)

    if (!dto.name?.trim()) {
      throw new BadRequestException('Название садика обязательно')
    }
    if (!dto.owner?.email?.trim()) {
      throw new BadRequestException('Email владельца обязателен')
    }
    if (!dto.owner?.password || dto.owner.password.length < 6) {
      throw new BadRequestException('Пароль минимум 6 символов')
    }
    if (!dto.owner?.fullName?.trim()) {
      throw new BadRequestException('ФИО владельца обязательно')
    }

    const ownerEmail = dto.owner.email.trim().toLowerCase()

    // Проверяем что email свободен
    const existing = await this.prisma.user.findUnique({
      where: { email: ownerEmail },
    })
    if (existing) {
      throw new ConflictException('Этот email уже используется')
    }

    // Генерируем уникальный slug из названия
    const slug = await this.generateUniqueSlug(dto.name)

    const passwordHash = await bcrypt.hash(dto.owner.password, 10)

    // Создаём в транзакции: садик + первый супер-админ
    const result = await this.prisma.$transaction(async (tx) => {
      const kindergarten = await tx.kindergarten.create({
        data: {
          name: dto.name.trim(),
          slug,
          address: dto.address?.trim() || null,
          phone: dto.phone?.trim() || null,
          isActive: true,
        },
      })

      const owner = await tx.user.create({
        data: {
          email: ownerEmail,
          passwordHash,
          fullName: dto.owner.fullName.trim(),
          role: 'SUPER_ADMIN',
          kindergartenId: kindergarten.id,
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
        },
      })

      return { kindergarten, owner }
    })

    return result
  }

  async update(user: AuthUser, id: string, dto: UpdateKindergartenDto) {
    this.assertGlobalOwner(user)
    const existing = await this.prisma.kindergarten.findUnique({
      where: { id },
    })
    if (!existing) throw new NotFoundException('Садик не найден')

    return this.prisma.kindergarten.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        address: dto.address?.trim(),
        phone: dto.phone?.trim(),
        isActive: dto.isActive,
      },
    })
  }

  async remove(user: AuthUser, id: string) {
    this.assertGlobalOwner(user)
    const existing = await this.prisma.kindergarten.findUnique({
      where: { id },
    })
    if (!existing) throw new NotFoundException('Садик не найден')

    await this.prisma.kindergarten.delete({ where: { id } })
    return { success: true }
  }

  // ----------------------------------------------------------------
  private async generateUniqueSlug(name: string): Promise<string> {
    const base =
      this.transliterate(name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 30) || 'kg'

    let slug = base
    let i = 1
    while (
      await this.prisma.kindergarten.findUnique({ where: { slug } })
    ) {
      slug = `${base}-${i++}`
    }
    return slug
  }

  private transliterate(s: string): string {
    const map: Record<string, string> = {
      а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e',
      ж: 'zh', з: 'z', и: 'i', й: 'i', к: 'k', л: 'l', м: 'm',
      н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
      ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
      ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
    }
    return s
      .split('')
      .map((c) => map[c.toLowerCase()] ?? c)
      .join('')
  }
}
