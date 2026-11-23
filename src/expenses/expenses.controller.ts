import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/auth.guard.js';
import { ApiJwtAuth } from '../common/swagger/api-docs.decorators.js';
import { ExpensesService } from './expenses.service.js';
import { CreateExpenseDto } from './dto/create-expense.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ExpenseOwnerGuard } from './guards/expense-owner.guard.js';

// Toutes les routes de ce contrôleur commencent par /wallets/:walletId/expenses
// et exigent un jeton JWT (JwtAuthGuard) : c'est déjà configuré.
@Controller('wallets/:walletId/expenses')
@ApiTags('expenses')
@UseGuards(JwtAuthGuard)
@ApiJwtAuth()
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  async findAll(
    @Param('walletId') walletId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.expensesService.findAll(walletId, userId);
  }

  @Post()
  async create(
    @Param('walletId') walletId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.expensesService.create(walletId, userId, dto);
  }

  @Delete(':id')
  @UseGuards(ExpenseOwnerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('walletId') walletId: string,
    @Param('id') expenseId: string,
  ) {
    return this.expensesService.remove(walletId, expenseId);
  }
}
