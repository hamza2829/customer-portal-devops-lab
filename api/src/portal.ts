import {
  BadGatewayException, Body, ConflictException, Controller, Delete, Get, HttpCode, Injectable,
  NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, Res, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import type { Response } from 'express';
import { Between, DataSource, FindOptionsWhere, QueryFailedError, Repository } from 'typeorm';
import { AuthGuard, CurrentUser, DEMO_CUSTOMER_ID, Principal, Roles } from './auth';
import { CustomerDto, CustomerPatch, OrderDto, OrderFilter, OrderPatch, ReportQuery } from './dto';
import { Customer, Order, OrderStatus, PortalSeed } from './model';

const uuid = new ParseUUIDPipe({ version: '4' });

@Injectable()
export class PortalService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Customer) private readonly customers: Repository<Customer>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
  ) {}

  async seed() {
    await this.dataSource.transaction(async (transaction) => {
      const seed = await transaction.createQueryBuilder().insert().into(PortalSeed)
        .values({ name: 'synthetic-demo-v1' }).orIgnore().returning('name').execute();
      if (!seed.raw.length) return;

      await transaction.insert(Customer, [
        { id: DEMO_CUSTOMER_ID, name: 'Avery Morgan', email: 'customer@example.test' },
        { id: '22222222-2222-4222-8222-222222222222', name: 'Riley Jordan', email: 'riley@example.test' },
      ]);
      await transaction.insert(Order, [
        {
          id: '33333333-3333-4333-8333-333333333333', customerId: DEMO_CUSTOMER_ID,
          item: 'Desk organizer', amountCents: 2450, status: OrderStatus.Open, orderDate: '2026-01-08',
        },
        {
          id: '44444444-4444-4444-8444-444444444444', customerId: DEMO_CUSTOMER_ID,
          item: 'Notebook set', amountCents: 1800, status: OrderStatus.Shipped, orderDate: '2026-01-15',
        },
      ]);
    });
  }

  listCustomers() {
    return this.customers.find({ order: { name: 'ASC', id: 'ASC' } });
  }

  async customer(id: string) {
    const row = await this.customers.findOneBy({ id });
    if (!row) throw new NotFoundException('Customer not found');
    return row;
  }

  private isDuplicate(error: unknown) {
    return error instanceof QueryFailedError && error.driverError.code === '23505';
  }

  async saveCustomer(input: CustomerDto | CustomerPatch, id?: string) {
    const row = id ? await this.customer(id) : this.customers.create();
    try {
      return await this.customers.save(Object.assign(row, input));
    } catch (error) {
      if (this.isDuplicate(error)) throw new ConflictException('Customer email already exists');
      throw error;
    }
  }

  async deleteCustomer(id: string) {
    if (!(await this.customers.delete(id)).affected) throw new NotFoundException('Customer not found');
  }

  private orderScope(user: Principal): FindOptionsWhere<Order> {
    return user.role === 'customer' ? { customerId: user.customerId } : {};
  }

  listOrders(user: Principal, status?: OrderStatus) {
    const where = this.orderScope(user);
    if (status) where.status = status;
    return this.orders.find({ where, order: { orderDate: 'DESC', id: 'ASC' } });
  }

  async order(user: Principal, id: string) {
    const row = await this.orders.findOneBy({ ...this.orderScope(user), id });
    if (!row) throw new NotFoundException('Order not found');
    return row;
  }

  async saveOrder(user: Principal, input: OrderDto | OrderPatch, id?: string) {
    const row = id ? await this.order(user, id) : this.orders.create();
    if (input.customerId) await this.customer(input.customerId);
    try {
      return await this.orders.save(Object.assign(row, input));
    } catch (error) {
      if (error instanceof QueryFailedError && error.driverError.code === '23503') {
        throw new NotFoundException('Customer not found');
      }
      throw error;
    }
  }

  async deleteOrder(id: string) {
    if (!(await this.orders.delete(id)).affected) throw new NotFoundException('Order not found');
  }

  async report(user: Principal, id: string, query: ReportQuery) {
    if (user.role === 'customer' && user.customerId !== id) {
      throw new NotFoundException('Customer not found');
    }
    await this.customer(id);
    const orders = await this.orders.findBy({
      customerId: id,
      orderDate: Between(`${query.month}-01`, `${query.month}-${monthEnd(query.month)}`),
    });
    const format = query.format ?? 'json';
    const url = `${process.env.REPORT_URL ?? 'http://127.0.0.1:8000'}/reports/${id}/${query.month}?format=${format}`;
    try {
      const upstream = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.REPORT_TOKEN ?? 'lab-report-token'}`,
        },
        body: JSON.stringify({ orders: orders.map(({ status, amountCents }) => ({ status, amountCents })) }),
        signal: AbortSignal.timeout(5000),
      });
      if (!upstream.ok) throw new Error(`Report service returned ${upstream.status}`);
      return { format, body: await upstream.text() };
    } catch {
      throw new BadGatewayException('Report service unavailable');
    }
  }
}

export function monthEnd(value: string) {
  const [year, month] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month, 0);
  return date.getUTCDate();
}

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly portal: PortalService) {}

  @Get()
  @Roles('admin')
  list() { return this.portal.listCustomers(); }

  @Get(':id')
  @Roles('admin')
  get(@Param('id', uuid) id: string) { return this.portal.customer(id); }

  @Post()
  @Roles('admin')
  create(@Body() input: CustomerDto) { return this.portal.saveCustomer(input); }

  @Patch(':id')
  @Roles('admin')
  update(@Param('id', uuid) id: string, @Body() input: CustomerPatch) {
    return this.portal.saveCustomer(input, id);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(204)
  remove(@Param('id', uuid) id: string) { return this.portal.deleteCustomer(id); }

  @Get(':id/report')
  async report(
    @CurrentUser() user: Principal,
    @Param('id', uuid) id: string,
    @Query() query: ReportQuery,
    @Res() response: Response,
  ) {
    const { body, format } = await this.portal.report(user, id, query);
    response.setHeader('Cache-Control', 'no-store');
    if (format === 'csv') response.attachment(`orders-${query.month}.csv`);
    response.type(format === 'csv' ? 'text/csv' : 'application/json').send(body);
  }
}

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly portal: PortalService) {}

  @Get()
  list(@CurrentUser() user: Principal, @Query() filter: OrderFilter) {
    return this.portal.listOrders(user, filter.status);
  }

  @Get(':id')
  get(@CurrentUser() user: Principal, @Param('id', uuid) id: string) {
    return this.portal.order(user, id);
  }

  @Post()
  @Roles('admin')
  create(@CurrentUser() user: Principal, @Body() input: OrderDto) {
    return this.portal.saveOrder(user, input);
  }

  @Patch(':id')
  @Roles('admin')
  update(@CurrentUser() user: Principal, @Param('id', uuid) id: string, @Body() input: OrderPatch) {
    return this.portal.saveOrder(user, input, id);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(204)
  remove(@Param('id', uuid) id: string) { return this.portal.deleteOrder(id); }
}
