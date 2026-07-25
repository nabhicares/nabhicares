import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { FirestoreService } from '../../database/firestore.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';

@Injectable()
export class BillingService {
  constructor(private firestore: FirestoreService) {}

  async createInvoice(dto: CreateInvoiceDto) {
    const patientDoc = await this.firestore.collection('patients').doc(dto.patientId).get();
    if (!patientDoc.exists) {
      throw new NotFoundException(`Patient with ID ${dto.patientId} does not exist.`);
    }

    const totalAmount = dto.items.reduce((sum, item) => sum + item.amount, 0);

    const invoiceRef = this.firestore.collection('invoices').doc();
    const invoice = {
      id: invoiceRef.id,
      patientId: dto.patientId,
      patientName: patientDoc.data()!.name,
      appointmentId: dto.appointmentId || null,
      items: dto.items,
      totalAmount,
      status: 'unpaid',
      createdAt: new Date().toISOString(),
    };

    await invoiceRef.set(invoice);
    return invoice;
  }

  async findOne(id: string) {
    const doc = await this.firestore.collection('invoices').doc(id).get();
    if (!doc.exists) {
      throw new NotFoundException(`Invoice with ID ${id} does not exist.`);
    }
    return doc.data();
  }

  async recordPayment(invoiceId: string, amount: number, method: string) {
    return this.firestore.runTransaction(async (transaction) => {
      const invoiceRef = this.firestore.collection('invoices').doc(invoiceId);
      const invoiceDoc = await transaction.get(invoiceRef);
      if (!invoiceDoc.exists) {
        throw new NotFoundException(`Invoice with ID ${invoiceId} does not exist.`);
      }

      const invoiceData = invoiceDoc.data()!;
      if (invoiceData.status === 'paid') {
        throw new BadRequestException(`Invoice ${invoiceId} has already been paid.`);
      }

      if (amount < invoiceData.totalAmount) {
        throw new BadRequestException(
          `Insufficient payment. Expected total ${invoiceData.totalAmount}, provided ${amount}.`,
        );
      }

      transaction.update(invoiceRef, { status: 'paid', paidAt: new Date().toISOString() });

      const paymentRef = this.firestore.collection('payments').doc();
      const payment = {
        id: paymentRef.id,
        invoiceId,
        amount,
        method,
        createdAt: new Date().toISOString(),
      };
      transaction.set(paymentRef, payment);

      return { invoiceId, status: 'paid', payment };
    });
  }

  async refundInvoice(invoiceId: string, reason: string) {
    return this.firestore.runTransaction(async (transaction) => {
      const invoiceRef = this.firestore.collection('invoices').doc(invoiceId);
      const invoiceDoc = await transaction.get(invoiceRef);
      if (!invoiceDoc.exists) {
        throw new NotFoundException(`Invoice with ID ${invoiceId} does not exist.`);
      }

      const invoiceData = invoiceDoc.data()!;
      if (invoiceData.status !== 'paid') {
        throw new BadRequestException(
          `Only fully paid invoices are eligible for refunds. Current status: ${invoiceData.status}.`,
        );
      }

      transaction.update(invoiceRef, { status: 'refunded', refundedAt: new Date().toISOString() });

      const refundRef = this.firestore.collection('refunds').doc();
      const refund = {
        id: refundRef.id,
        invoiceId,
        amount: invoiceData.totalAmount,
        reason,
        createdAt: new Date().toISOString(),
      };
      transaction.set(refundRef, refund);

      return { invoiceId, status: 'refunded', refund };
    });
  }
}
