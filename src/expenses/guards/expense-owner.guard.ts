import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedRequest } from '../../auth/authenticated-request.js';

@Injectable()
export class ExpenseOwnerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const { walletId, id } = request.params as Record<string, string>;
    const { userId } = request.user;

    const expense = await this.prisma.expense.findFirst({
      where: { id, walletId },
      select: { paidById: true, createdById: true },
    });

    if (!expense) {
      throw new NotFoundException('Dépense introuvable.');
    }

    if (expense.paidById !== userId && expense.createdById !== userId) {
      throw new ForbiddenException(
        'Seul le dépenseur ou le créateur peut supprimer cette dépense.',
      );
    }

    return true;
  }
}
