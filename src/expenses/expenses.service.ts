import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  assertMemberOfWallet,
  assertWalletOpen,
  expenseSelect,
  isMemberOfWallet,
  toExpenseItem,
} from './expenses.helpers.js';
import type { CreateExpenseDto } from './dto/create-expense.dto.js';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(walletId: string, userId: string) {
    await assertMemberOfWallet(this.prisma, walletId, userId);

    const expenses = await this.prisma.expense.findMany({
      where: { walletId },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      select: expenseSelect,
    });

    const aggregate = await this.prisma.expense.aggregate({
      where: { walletId },
      _sum: { amount: true },
    });

    return {
      items: expenses.map(toExpenseItem),
      totalAmount: aggregate._sum.amount ?? 0,
    };
  }

  async create(walletId: string, userId: string, dto: CreateExpenseDto) {
    const wallet = await assertMemberOfWallet(this.prisma, walletId, userId);
    assertWalletOpen(wallet);

    const paidById = dto.paidById ?? userId;
    if (paidById !== userId) {
      const isMember = await isMemberOfWallet(this.prisma, walletId, paidById);
      if (!isMember) {
        throw new ForbiddenException(
          'Le dépenseur doit être membre du porte-monnaie.',
        );
      }
    }

    const expense = await this.prisma.expense.create({
      data: {
        walletId,
        title: dto.title,
        amount: dto.amount,
        date: new Date(dto.date),
        paidById,
        createdById: userId,
      },
      select: expenseSelect,
    });

    await this.prisma.wallet.update({
      where: { id: walletId },
      data: { updatedAt: new Date() },
    });

    return toExpenseItem(expense);
  }

  // TODO étape 2 : écrivez  async create(walletId: string, userId: string, dto: CreateExpenseDto)
  //   1. accès + porte-monnaie ouvert (assertMemberOfWallet, assertWalletOpen)
  //   2. dépenseur = dto.paidById ?? userId ; s'il est différent de userId,
  //      il doit être membre (isMemberOfWallet), sinon ForbiddenException
  //   3. this.prisma.expense.create({ data: {..., createdById: userId}, select: expenseSelect })
  //   4. mettre à jour wallet.updatedAt (règle métier : chaque action rafraîchit updatedAt)
  //   5. renvoyer toExpenseItem(...)

  async remove(walletId: string, expenseId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
      select: { status: true },
    });
    if (!wallet) {
      throw new NotFoundException('Porte-monnaie introuvable.');
    }
    assertWalletOpen(wallet);

    await this.prisma.expense.delete({
      where: { id: expenseId },
    });

    await this.prisma.wallet.update({
      where: { id: walletId },
      data: { updatedAt: new Date() },
    });
  }
}
