import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity('award_rules')
export class AwardRule {
  @PrimaryColumn()
  id: string;

  @Column()
  title: string;

  @Column({ name: 'event_id', unique: true })
  eventId: string;

  @Column('decimal', { name: 'enc_amount', precision: 10, scale: 2 })
  encAmount: number;

  @Column({ name: 'max_count', nullable: true, type: 'int' })
  maxCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

