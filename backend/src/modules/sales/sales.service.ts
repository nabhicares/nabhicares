import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { FirestoreService } from '../../database/firestore.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import { applyStockChanges } from '../inventory/stock-mutation';
import { ProfileService } from '../profile/profile.service';
import { MessagingProvider } from '../messaging/messaging.provider';

@Injectable()
export class SalesService {
  constructor(
    private firestore: FirestoreService,
    private profileService: ProfileService,
    private messaging: MessagingProvider,
  ) {}

  async createCustomer(dto: CreateCustomerDto) {
    const ref = this.firestore.collection('customers').doc();
    const customer = {
      id: ref.id,
      hospitalId: dto.hospitalId,
      name: dto.name,
      phone: dto.phone || null,
      email: dto.email || null,
      address: dto.address || null,
      createdAt: new Date().toISOString(),
    };
    await ref.set(customer);
    return customer;
  }

  async updateCustomer(id: string, dto: UpdateCustomerDto, hospitalId?: string) {
    const ref = this.firestore.collection('customers').doc(id);
    const doc = await ref.get();
    if (!doc.exists) throw new NotFoundException(`Customer ${id} not found.`);
    const data = doc.data()!;
    if (hospitalId && data.hospitalId && data.hospitalId !== hospitalId) {
      throw new BadRequestException('Customer does not belong to this hospital.');
    }
    await ref.update({ ...dto, updatedAt: new Date().toISOString() });
    return (await ref.get()).data();
  }

  async listCustomers(hospitalId: string, page = 1, limit = 20) {
    const snap = await this.firestore.collection('customers').get();
    const list = snap.docs.map((d) => d.data()).filter((c: any) => c.hospitalId === hospitalId);
    const pageNum = Number(page) > 0 ? Number(page) : 1;
    const limitNum = Number(limit) > 0 ? Number(limit) : 20;
    const start = (pageNum - 1) * limitNum;
    return {
      items: list.slice(start, start + limitNum),
      meta: {
        totalCount: list.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(list.length / limitNum),
      },
    };
  }

  async createSale(dto: CreateSaleDto, userId?: string) {
    if (!dto.items?.length) {
      throw new BadRequestException('Sale requires at least one item.');
    }
    if (dto.paymentMethod === 'upi' && !dto.upiTransactionRef) {
      throw new BadRequestException('upiTransactionRef is required for UPI sales.');
    }
    if (!dto.customerId && !dto.customer) {
      throw new BadRequestException('Provide customerId or inline customer.');
    }

    return this.firestore.runTransaction(async (transaction) => {
      let customerId = dto.customerId;
      let customerName = '';
      let customerPhone: string | null = null;

      if (customerId) {
        const custDoc = await transaction.get(this.firestore.collection('customers').doc(customerId));
        if (!custDoc.exists) throw new NotFoundException(`Customer ${customerId} not found.`);
        const c = custDoc.data()!;
        if (c.hospitalId !== dto.hospitalId) {
          throw new BadRequestException('Customer does not belong to this hospital.');
        }
        customerName = c.name;
        customerPhone = c.phone || null;
      } else {
        customerName = dto.customer!.name;
        customerPhone = dto.customer!.phone || null;
      }

      let doctorName: string | null = null;
      let commissionRate = 0;
      let doctorRef: any = null;
      let doctorPrevBalance = 0;
      if (dto.doctorId) {
        doctorRef = this.firestore.collection('doctors').doc(dto.doctorId);
        const docSnap = await transaction.get(doctorRef);
        if (!docSnap.exists) throw new NotFoundException(`Doctor ${dto.doctorId} not found.`);
        const d = docSnap.data()!;
        if (d.hospitalId && d.hospitalId !== dto.hospitalId) {
          throw new BadRequestException('Doctor does not belong to this hospital.');
        }
        doctorName = d.name;
        commissionRate = Number(d.commissionRate || 0);
        doctorPrevBalance = Number(d.creditBalance || 0);
      }

      const saleRef = this.firestore.collection('sales').doc();
      const saleId = saleRef.id;

      const stockResults = await applyStockChanges(
        this.firestore,
        transaction,
        dto.items.map((item) => ({
          medicineId: item.medicineId,
          batchNo: item.batchNo,
          quantityChange: -item.qty,
          type: 'sale' as const,
          reason: 'retail_sale',
          hospitalId: dto.hospitalId,
          saleId,
          userId,
        })),
      );

      const lineItems = stockResults.map((result, idx) => {
        const qty = dto.items[idx].qty;
        return {
          medicineId: result.medicineId,
          medicineName: result.medicineName,
          batchNo: result.batchNo,
          qty,
          unitPrice: result.unitPrice,
          lineTotal: result.unitPrice * qty,
        };
      });
      const totalAmount = lineItems.reduce((s, i) => s + i.lineTotal, 0);

      if (!customerId) {
        const custRef = this.firestore.collection('customers').doc();
        customerId = custRef.id;
        transaction.set(custRef, {
          id: customerId,
          hospitalId: dto.hospitalId,
          name: dto.customer!.name,
          phone: dto.customer!.phone || null,
          email: dto.customer!.email || null,
          address: null,
          createdAt: new Date().toISOString(),
        });
      }

      const paymentRef = this.firestore.collection('payments').doc();
      const payment = {
        id: paymentRef.id,
        hospitalId: dto.hospitalId,
        saleId,
        amount: totalAmount,
        method: dto.paymentMethod,
        upiTransactionRef: dto.paymentMethod === 'upi' ? dto.upiTransactionRef : null,
        status: 'recorded',
        createdAt: new Date().toISOString(),
      };
      transaction.set(paymentRef, payment);

      let creditLedgerId: string | null = null;
      if (dto.paymentMethod === 'credit') {
        const creditRef = this.firestore.collection('creditLedger').doc();
        creditLedgerId = creditRef.id;
        transaction.set(creditRef, {
          id: creditLedgerId,
          hospitalId: dto.hospitalId,
          saleId,
          customerId,
          doctorId: dto.doctorId || null,
          doctorName,
          amount: totalAmount,
          commissionRate,
          commissionAmount: totalAmount * (commissionRate / 100),
          balance: totalAmount,
          status: 'open',
          createdAt: new Date().toISOString(),
        });
        if (doctorRef) {
          transaction.update(doctorRef, {
            creditBalance: doctorPrevBalance + totalAmount,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      const sale = {
        id: saleId,
        hospitalId: dto.hospitalId,
        customerId,
        customerName,
        customerPhone,
        doctorId: dto.doctorId || null,
        doctorName,
        items: lineItems,
        totalAmount,
        paymentMethod: dto.paymentMethod,
        paymentId: payment.id,
        upiTransactionRef: payment.upiTransactionRef,
        creditLedgerId,
        createdAt: new Date().toISOString(),
        createdBy: userId || null,
      };
      transaction.set(saleRef, sale);
      return sale;
    });
  }

  async listSales(filters: {
    hospitalId: string;
    customerId?: string;
    paymentMethod?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    const snap = await this.firestore.collection('sales').get();
    let list = snap.docs
      .map((d) => d.data())
      .filter((s: any) => s.hospitalId === filters.hospitalId);

    if (filters.customerId) list = list.filter((s: any) => s.customerId === filters.customerId);
    if (filters.paymentMethod) {
      list = list.filter((s: any) => s.paymentMethod === filters.paymentMethod);
    }
    if (filters.from) list = list.filter((s: any) => s.createdAt >= filters.from!);
    if (filters.to) list = list.filter((s: any) => s.createdAt <= filters.to!);
    list.sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt));

    const pageNum = Number(filters.page) > 0 ? Number(filters.page) : 1;
    const limitNum = Number(filters.limit) > 0 ? Number(filters.limit) : 20;
    const start = (pageNum - 1) * limitNum;
    return {
      items: list.slice(start, start + limitNum),
      meta: {
        totalCount: list.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(list.length / limitNum),
      },
    };
  }

  async findSale(id: string, hospitalId?: string) {
    const doc = await this.firestore.collection('sales').doc(id).get();
    if (!doc.exists) throw new NotFoundException(`Sale ${id} not found.`);
    const sale = doc.data()!;
    if (hospitalId && sale.hospitalId !== hospitalId) {
      throw new BadRequestException('Sale does not belong to this hospital.');
    }
    return sale;
  }

  async generateInvoicePdf(saleId: string, hospitalId: string) {
    const sale = await this.findSale(saleId, hospitalId);
    const profile = await this.profileService.getProfile(hospitalId);
    const lines = [
      profile.shopName || 'PharmaStore',
      profile.address || '',
      `Invoice for sale ${sale.id}`,
      `Customer: ${sale.customerName}`,
      `Date: ${sale.createdAt}`,
      ...sale.items.map(
        (i: any) => `${i.medicineName} x${i.qty} @ ${i.unitPrice} = ${i.lineTotal}`,
      ),
      `Total: ${sale.totalAmount}`,
      `Payment: ${sale.paymentMethod}`,
      profile.signatureText ? `Signed: ${profile.signatureText}` : '',
    ].filter(Boolean);

    // ponytail: stub PDF as base64 text; swap for pdfkit when needed
    const pdfBase64 = Buffer.from(lines.join('\n'), 'utf8').toString('base64');
    return {
      saleId,
      hospitalId,
      contentType: 'text/plain',
      filename: `invoice-${saleId}.txt`,
      pdfBase64,
      profile: {
        shopName: profile.shopName,
        logoUrl: profile.logoUrl,
        address: profile.address,
      },
    };
  }

  async sendInvoice(
    saleId: string,
    hospitalId: string,
    channels: 'sms' | 'whatsapp' | 'both' = 'both',
    phone?: string,
  ) {
    const sale = await this.findSale(saleId, hospitalId);
    const to = phone || sale.customerPhone;
    if (!to) throw new BadRequestException('No phone number available to send invoice.');
    const invoice = await this.generateInvoicePdf(saleId, hospitalId);
    const profile = await this.profileService.getProfile(hospitalId);
    return this.messaging.send({
      hospitalId,
      to,
      channels,
      message: `Invoice ${saleId} total ₹${sale.totalAmount} from ${profile.shopName}`,
      mediaBase64: invoice.pdfBase64,
      saleId,
    });
  }
}
