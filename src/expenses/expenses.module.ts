import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ExpensesController } from './expenses.controller.js';

@Module({
  imports: [PrismaModule],
  controllers: [ExpensesController],
  providers: [], // Oubli du service dans providers !
})
export class ExpensesModule {}
