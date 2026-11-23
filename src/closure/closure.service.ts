import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { calculateBalances } from './balance-calculator.js';
import { loadBalanceData } from './balance-data.js';

const closedWalletSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  closedAt: true,
} satisfies Prisma.WalletSelect;

@Injectable()
export class ClosureService {
  constructor(private readonly prisma: PrismaService) {}

  async close(walletId: string, userId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const wallet = await transaction.wallet.findUnique({
        where: { id: walletId },
        select: { createdById: true, status: true },
      });

      if (!wallet) {
        throw new NotFoundException('Porte-monnaie introuvable.');
      }

      if (wallet.createdById !== userId) {
        throw new ForbiddenException(
          'Seul le créateur peut clôturer ce porte-monnaie.',
        );
      }

      // La condition status: 'OPEN' empêche deux clôtures simultanées.
      const { count } = await transaction.wallet.updateMany({
        where: { id: walletId, status: 'OPEN' },
        data: { status: 'CLOSED', closedAt: new Date() },
      });

      if (count === 0) {
        throw new ConflictException('Ce porte-monnaie est déjà fermé.');
      }

      await transaction.walletMember.deleteMany({
        where: { walletId, status: 'INVITED' },
      });

      return transaction.wallet.findUniqueOrThrow({
        where: { id: walletId },
        select: closedWalletSelect,
      });
    });
  }

  async getBalance(walletId: string, userId: string): Promise<unknown> {
    // Erreur étudiant : oubli de await this.checkClosedWalletAccess(walletId, userId)
    const data = await loadBalanceData(this.prisma, walletId);
    const { balances, transfers } = calculateBalances(
      data.totalAmount,
      data.memberPayments,
    );
    return {
      walletId,
      totalAmount: data.totalAmount,
      balances,
      transfers,
    };
  }

  private async checkClosedWalletAccess(walletId: string, userId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
      select: { status: true },
    });

    if (!wallet) {
      throw new NotFoundException('Porte-monnaie introuvable.');
    }

    const membership = await this.prisma.walletMember.findUnique({
      where: { walletId_userId: { walletId, userId } },
      select: { status: true },
    });

    if (membership?.status !== 'MEMBER') {
      throw new ForbiddenException('Accès refusé à ce porte-monnaie.');
    }

    if (wallet.status !== 'CLOSED') {
      throw new ConflictException(
        'Le bilan n’est disponible que pour un porte-monnaie clôturé.',
      );
    }
  }
}
