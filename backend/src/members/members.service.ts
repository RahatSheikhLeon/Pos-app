import { Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuid } from 'uuid';

export interface PurchaseRecord {
  transactionId: string;
  date: string;
  items: { productName: string; sku: string; quantity: number; total: number }[];
  total: number;
}

export interface Member {
  id: string;
  membershipId: string;
  name: string;
  phone: string;
  email: string;
  joinedAt: string;
  purchaseHistory: PurchaseRecord[];
}

@Injectable()
export class MembersService {
  private members: Member[] = [];

  findAll(): Member[] {
    return this.members;
  }

  search(q: string): Member[] {
    if (!q?.trim()) return this.members;
    const query = q.toLowerCase();
    return this.members.filter(
      (m) =>
        m.membershipId.toLowerCase().includes(query) ||
        m.name.toLowerCase().includes(query) ||
        m.phone.includes(query),
    );
  }

  findOne(id: string): Member {
    const member = this.members.find((m) => m.id === id);
    if (!member) throw new NotFoundException(`Member ${id} not found`);
    return member;
  }

  create(data: Partial<Member>): Member {
    const member: Member = {
      id: uuid(),
      membershipId: data.membershipId || `MEM-${uuid().slice(0, 6).toUpperCase()}`,
      name: data.name || '',
      phone: data.phone || '',
      email: data.email || '',
      joinedAt: new Date().toISOString().split('T')[0],
      purchaseHistory: [],
    };
    this.members.push(member);
    return member;
  }

  update(id: string, data: Partial<Member>): Member {
    const member = this.findOne(id);
    Object.assign(member, { ...data, id, purchaseHistory: member.purchaseHistory });
    return member;
  }

  addPurchase(memberId: string, record: PurchaseRecord): void {
    const member = this.findOne(memberId);
    member.purchaseHistory.unshift(record);
  }
}
