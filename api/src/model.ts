import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

export enum OrderStatus {
  Open = 'open',
  Shipped = 'shipped',
  Cancelled = 'cancelled',
}

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ unique: true, length: 254 })
  email!: string;
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  customerId!: string;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'customerId' })
  customer!: Customer;

  @Column({ length: 120 })
  item!: string;

  @Column({ type: 'int' })
  amountCents!: number;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.Open })
  status!: OrderStatus;

  @Column({ type: 'date' })
  orderDate!: string;
}

@Entity('portal_seeds')
export class PortalSeed {
  @PrimaryColumn({ type: 'varchar', length: 40 })
  name!: string;
}
