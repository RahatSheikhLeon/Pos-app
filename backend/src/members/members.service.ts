import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const FREE_CUSTOMER_LIMIT = 5;

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.member.findMany({ where: { userId }, orderBy: { name: 'asc' } });
  }

  async search(userId: string, q: string) {
    if (!q?.trim()) return this.prisma.member.findMany({ where: { userId } });
    return this.prisma.member.findMany({
      where: {
        userId,
        OR: [{ name: { contains: q } }, { phone: { contains: q } }, { membershipId: { contains: q } }],
      },
    });
  }

  async findOne(id: string) {
    const member = await this.prisma.member.findUnique({ where: { id } });
    if (!member) throw new NotFoundException(`Member ${id} not found`);
    return member;
  }

  async create(userId: string, plan: string, data: any) {
    if (plan === 'free') {
      const count = await this.prisma.member.count({ where: { userId } });
      if (count >= FREE_CUSTOMER_LIMIT) {
        throw new ForbiddenException(`Free plan allows up to ${FREE_CUSTOMER_LIMIT} customers. Upgrade to Pro for unlimited.`);
      }
    }
    return this.prisma.member.create({
      data: {
        ...data,
        userId,
        joinedAt: data.joinedAt ?? new Date().toISOString().split('T')[0],
        purchaseHistory: [],
      },
    });
  }

  async update(userId: string, id: string, data: any) {
    const member = await this.prisma.member.findFirst({ where: { id, userId } });
    if (!member) throw new NotFoundException(`Member ${id} not found`);
    return this.prisma.member.update({ where: { id }, data });
  }

  async addPurchase(memberId: string, record: any): Promise<void> {
    const member = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException(`Member ${memberId} not found`);
    const history = [record, ...((member.purchaseHistory as any[]) ?? [])];
    await this.prisma.member.update({ where: { id: memberId }, data: { purchaseHistory: history } });
  }
}
