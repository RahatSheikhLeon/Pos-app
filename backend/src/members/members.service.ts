import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.member.findMany({ orderBy: { name: 'asc' } });
  }

  async search(q: string) {
    if (!q?.trim()) return this.prisma.member.findMany();
    return this.prisma.member.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { phone: { contains: q } },
          { membershipId: { contains: q } },
        ],
      },
    });
  }

  async findOne(id: string) {
    const member = await this.prisma.member.findUnique({ where: { id } });
    if (!member) throw new NotFoundException(`Member ${id} not found`);
    return member;
  }

  async create(data: any) {
    return this.prisma.member.create({
      data: {
        ...data,
        joinedAt: data.joinedAt ?? new Date().toISOString().split('T')[0],
        purchaseHistory: [],
      },
    });
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    return this.prisma.member.update({ where: { id }, data });
  }

  async addPurchase(memberId: string, record: any): Promise<void> {
    const member = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException(`Member ${memberId} not found`);
    const history = [(record), ...((member.purchaseHistory as any[]) ?? [])];
    await this.prisma.member.update({ where: { id: memberId }, data: { purchaseHistory: history } });
  }
}
