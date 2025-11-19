import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Award } from './award.entity';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tx_id', unique: true })
  txId: string;

  @Column({ name: 'award_id' })
  awardId: string;

  @Column({ type: 'varchar', length: 20 })
  type: 'credit' | 'debit';

  @Column('decimal', { precision: 20, scale: 2 })
  amount: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'timestamp' })
  timestamp: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Award, (award) => award.transactions)
  @JoinColumn({ name: 'award_id' })
  award: Award;
}

