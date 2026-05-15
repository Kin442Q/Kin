import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import bcrypt from "bcryptjs";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";

interface CreateTeacherDto {
  fullName: string;
  phone: string;
  email?: string;
  password: string;
  groupId?: string;
}

interface UpdateTeacherDto {
  fullName?: string;
  phone?: string;
  email?: string;
  password?: string;
  groupId?: string | null;
}

interface ActorContext {
  /** kindergartenId текущего админа (из JWT). null = global super admin */
  kindergartenId?: string | null;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Список пользователей текущего садика. */
  list(actor: ActorContext) {
    return this.prisma.user.findMany({
      where: actor.kindergartenId
        ? { kindergartenId: actor.kindergartenId }
        : {},
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        phone: true,
        groupId: true,
        kindergartenId: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Только учителя текущего садика. */
  listTeachers(actor: ActorContext) {
    return this.prisma.user.findMany({
      where: {
        role: "TEACHER",
        ...(actor.kindergartenId
          ? { kindergartenId: actor.kindergartenId }
          : {}),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        phone: true,
        groupId: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { fullName: "asc" },
    });
  }

  /** Создание учителя SUPER_ADMIN/ADMIN'ом. */
  async createTeacher(actor: ActorContext, dto: CreateTeacherDto) {
    if (!actor.kindergartenId) {
      throw new ForbiddenException(
        "Глобальный супер-админ не может создавать учителей без указания садика",
      );
    }
    if (!dto.fullName?.trim()) {
      throw new BadRequestException("fullName обязателен");
    }
    if (!dto.phone?.trim()) {
      throw new BadRequestException("phone обязателен");
    }
    if (!dto.password || dto.password.length < 6) {
      throw new BadRequestException("Пароль минимум 6 символов");
    }

    const phoneNorm = this.normalizePhone(dto.phone);
    const email =
      dto.email?.trim().toLowerCase() ||
      `teacher-${phoneNorm}@kindergarten.local`;

    // Email уникален глобально
    const existsEmail = await this.prisma.user.findUnique({ where: { email } });
    if (existsEmail) throw new ConflictException("Этот email уже занят");

    // Телефон уникален в рамках садика
    const existsPhone = await this.prisma.user.findFirst({
      where: {
        phone: dto.phone.trim(),
        kindergartenId: actor.kindergartenId,
      },
    });
    if (existsPhone) {
      throw new ConflictException("Учитель с таким телефоном уже есть");
    }

    // Если указана группа — проверить что у неё ещё нет учителя
    if (dto.groupId) {
      const occupiedTeacher = await this.prisma.user.findFirst({
        where: {
          role: "TEACHER",
          groupId: dto.groupId,
          kindergartenId: actor.kindergartenId,
        },
      });
      if (occupiedTeacher) {
        throw new ConflictException("У этой группы уже назначен учитель");
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: dto.fullName.trim(),
        phone: dto.phone.trim(),
        role: "TEACHER",
        groupId: dto.groupId || null,
        kindergartenId: actor.kindergartenId,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        phone: true,
        groupId: true,
        isActive: true,
        createdAt: true,
      },
    });

    return user;
  }

  /** Обновление учителя. */
  async updateTeacher(
    actor: ActorContext,
    teacherId: string,
    dto: UpdateTeacherDto,
  ) {
    const teacher = await this.prisma.user.findUnique({
      where: { id: teacherId },
    });
    if (!teacher || teacher.role !== "TEACHER") {
      throw new NotFoundException("Учитель не найден");
    }
    if (
      actor.kindergartenId &&
      teacher.kindergartenId !== actor.kindergartenId
    ) {
      throw new ForbiddenException(
        "Нельзя редактировать учителя другого садика",
      );
    }

    const data: Record<string, unknown> = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName.trim();
    if (dto.phone !== undefined) data.phone = dto.phone.trim();
    if (dto.email !== undefined) data.email = dto.email.trim().toLowerCase();
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    }
    if (dto.groupId !== undefined) data.groupId = dto.groupId || null;

    return this.prisma.user.update({
      where: { id: teacherId },
      data,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        phone: true,
        groupId: true,
        isActive: true,
      },
    });
  }

  /** Удалить учителя. */
  async deleteTeacher(actor: ActorContext, teacherId: string) {
    const teacher = await this.prisma.user.findUnique({
      where: { id: teacherId },
    });
    if (!teacher || teacher.role !== "TEACHER") {
      throw new NotFoundException("Учитель не найден");
    }
    if (
      actor.kindergartenId &&
      teacher.kindergartenId !== actor.kindergartenId
    ) {
      throw new ForbiddenException("Нельзя удалить учителя другого садика");
    }
    await this.prisma.user.delete({ where: { id: teacherId } });
    return { success: true };
  }

  setActive(actor: ActorContext, id: string, isActive: boolean) {
    return this.prisma.user.update({
      where: { id },
      data: { isActive },
    });
  }

  private normalizePhone(p: string): string {
    return (p || "").replace(/\D/g, "");
  }
}
