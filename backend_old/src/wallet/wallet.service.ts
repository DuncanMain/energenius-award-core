import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from './entities/wallet.entity';
import { Transaction } from './entities/transaction.entity';
import { AwardRule } from './entities/award-rule.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(AwardRule)
    private readonly awardRuleRepo: Repository<AwardRule>,
  ) {}

  async createWallet(uid: string, address: string) {
    const existing = await this.walletRepo.findOne({ where: { uid } });
    if (existing) {
      throw new ConflictException('Wallet already exists for this user');
    }

    const wallet = this.walletRepo.create({
      uid,
      walletId: `wallet_${uuidv4()}`,
      address,
      balance: 0,
    });

    await this.walletRepo.save(wallet);

    return {
      walletId: wallet.walletId,
      uid: wallet.uid,
      address: wallet.address,
      balance: parseFloat(wallet.balance.toString()),
      createdAt: wallet.createdAt,
    };
  }

  async getWallet(uid: string) {
    const wallet = await this.walletRepo.findOne({ where: { uid } });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return {
      walletId: wallet.walletId,
      uid: wallet.uid,
      address: wallet.address,
      balance: parseFloat(wallet.balance.toString()),
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
  }

  async getBalance(uid: string) {
    const wallet = await this.walletRepo.findOne({ where: { uid } });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return {
      balance: parseFloat(wallet.balance.toString()),
      currency: 'USD',
    };
  }

  async credit(uid: string, amount: number, description?: string) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    const wallet = await this.walletRepo.findOne({ where: { uid } });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    wallet.balance = parseFloat(wallet.balance.toString()) + amount;
    await this.walletRepo.save(wallet);

    const transaction = this.transactionRepo.create({
      txId: `tx_${uuidv4()}`,
      walletId: wallet.id,
      type: 'credit',
      amount,
      description: description || 'Credit transaction',
      timestamp: new Date(),
    });

    await this.transactionRepo.save(transaction);

    return {
      txId: transaction.txId,
      type: 'credit',
      amount: parseFloat(amount.toString()),
      balance: parseFloat(wallet.balance.toString()),
      timestamp: transaction.timestamp,
    };
  }

  async debit(uid: string, amount: number, description?: string) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    const wallet = await this.walletRepo.findOne({ where: { uid } });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    if (parseFloat(wallet.balance.toString()) < amount) {
      throw new BadRequestException('Insufficient balance');
    }

    wallet.balance = parseFloat(wallet.balance.toString()) - amount;
    await this.walletRepo.save(wallet);

    const transaction = this.transactionRepo.create({
      txId: `tx_${uuidv4()}`,
      walletId: wallet.id,
      type: 'debit',
      amount,
      description: description || 'Debit transaction',
      timestamp: new Date(),
    });

    await this.transactionRepo.save(transaction);

    return {
      txId: transaction.txId,
      type: 'debit',
      amount: parseFloat(amount.toString()),
      balance: parseFloat(wallet.balance.toString()),
      timestamp: transaction.timestamp,
    };
  }

  async getTransactions(uid: string) {
    const wallet = await this.walletRepo.findOne({ where: { uid } });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const transactions = await this.transactionRepo.find({
      where: { walletId: wallet.id },
      order: { timestamp: 'DESC' },
      take: 100,
    });

    return transactions.map((tx) => ({
      txId: tx.txId,
      type: tx.type,
      amount: parseFloat(tx.amount.toString()),
      description: tx.description,
      timestamp: tx.timestamp,
    }));
  }

  async awardEvent(uid: string, eventId: string) {
    const wallet = await this.walletRepo.findOne({ where: { uid } });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const rule = await this.awardRuleRepo.findOne({ where: { eventId } });
    if (!rule) {
      throw new NotFoundException('Award rule not found for this event');
    }

    const amount = parseFloat(rule.encAmount.toString());
    await this.credit(uid, amount, `Award: ${rule.title}`);

    return {
      awarded: true,
      amount,
      eventId: rule.eventId,
      title: rule.title,
    };
  }

  async getAwardRules() {
    const rules = await this.awardRuleRepo.find();
    return rules.map((rule) => ({
      id: rule.id,
      title: rule.title,
      eventId: rule.eventId,
      encAmount: parseFloat(rule.encAmount.toString()),
      maxCount: rule.maxCount,
    }));
  }
}