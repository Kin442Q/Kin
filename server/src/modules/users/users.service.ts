import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import {
  AccessService,
  assertNoPassword,
  requireInviteEmail,
} from "../access/access.service";

interface CreateTeacherDto {
  fullName: string;
  phone: string;
  /** Обязателен: на него уходит приглашение со ссылкой, по которой учитель сам задаёт пароль. */
  email: string;
  groupId?: string;
  /** Доп. классы, которые ведёт (many-to-many). */
  teachingGroupIds?: string[];
}

interface UpdateTeacherDto {
  fullName?: string;
  phone?: string;
  email?: string;
  groupId?: string | null;
  /** Полный набор классов учителя (заменяет текущий). */
  teachingGroupIds?: string[];
}

interface ActorContext {
  /** kindergartenId текущего админа (из JWT). null = global super admin */
  kindergartenId?: string | null;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

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
        teachingGroups: { select: { id: true } },
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
    assertNoPassword(dto);
    // Доступ только письмом: без настоящей почты учителя не создаём.
    const email = requireInviteEmail(dto.email);

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

    // Пароль админ не вводит и не видит: человек задаёт его сам по ссылке из письма.
    const secret = await this.access.newSecret();
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: secret.hash,
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

    const access = await this.access.deliver(user);
    return { ...user, access };
  }

  /** Обновление учителя. */
  async updateTeacher(
    actor: ActorContext,
    teacherId: string,
    dto: UpdateTeacherDto,
  ) {
    assertNoPassword(dto);
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
    if (dto.groupId !== undefined) data.groupId = dto.groupId || null;
    if (dto.teachingGroupIds !== undefined) {
      const ids = Array.from(new Set(dto.teachingGroupIds.filter(Boolean)));
      data.teachingGroups = { set: ids.map((id) => ({ id })) };
      // основная группа — первая из набора (если явно не задана отдельно)
      if (dto.groupId === undefined) data.groupId = ids[0] ?? null;
    }

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
        teachingGroups: { select: { id: true } },
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
