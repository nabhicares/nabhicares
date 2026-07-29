import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { FirestoreService } from '../../database/firestore.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { assertPatientRecordAccess, AuthUser } from '../../common/privacy/patient-access';

@Injectable()
export class BillingService {
  constructor(private firestore: FirestoreService) {}

  async createInvoice(dto: CreateInvoiceDto) {
    const patientDoc = await this.firestore.collection('patients').doc(dto.patientId).get();
    if (!patientDoc.exists) {
      throw new NotFoundException(`Patient with ID ${dto.patientId} does not exist.`);
    }

    // Server-side total only — never trust a client-supplied total field.
    // Line amounts are still staff-entered (desk invoice); reject negatives / NaN.
    const items = dto.items.map((item) => {
      const amount = Number(item.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        throw new BadRequestException('Invoice line amounts must be non-negative numbers.');
      }
      return { description: item.description, amount };
    });

    if (items.length === 0) {
      throw new BadRequestException('Invoice must contain at least one line item.');
    }

    // If linked to an appointment, pin consultation line to the doctor's fee when description matches.
    let resolvedItems = items;
    if (dto.appointmentId) {
      const apptDoc = await this.firestore.collection('appointments').doc(dto.appointmentId).get();
      if (apptDoc.exists) {
        const appt = apptDoc.data()!;
        const doctorDoc = await this.firestore.collection('doctors').doc(appt.doctorId).get();
        if (doctorDoc.exists) {
          const fee = Number(doctorDoc.data()!.consultationFee);
          if (Number.isFinite(fee) && fee >= 0) {
            resolvedItems = items.map((item) => {
              if (/consultation/i.test(item.description)) {
                return { ...item, amount: fee };
              }
              return item;
            });
          }
        }
      }
    }

    const totalAmount = resolvedItems.reduce((sum, item) => sum + item.amount, 0);

    const invoiceRef = this.firestore.collection('invoices').doc();
    const invoice = {
      id: invoiceRef.id,
      patientId: dto.patientId,
      patientName: patientDoc.data()!.name,
      appointmentId: dto.appointmentId || null,
      items: resolvedItems,
      totalAmount,
      status: 'unpaid',
      createdAt: new Date().toISOString(),
    };

    await invoiceRef.set(invoice);
    return invoice;
  }

  async findOne(id: string, user?: AuthUser) {
    const doc = await this.firestore.collection('invoices').doc(id).get();
    if (!doc.exists) {
      throw new NotFoundException(`Invoice with ID ${id} does not exist.`);
    }
    const data = doc.data()!;
    if (user?.role === 'patient') {
      await assertPatientRecordAccess(this.firestore, data.patientId, user);
    }
    return data;
  }

  async findByPatient(patientId: string, user?: AuthUser) {
    if (user) {
      await assertPatientRecordAccess(this.firestore, patientId, user);
    }
    const snapshot = await this.firestore
      .collection('invoices')
      .where('patientId', '==', patientId)
      .get();

    return snapshot.docs
      .map((doc) => doc.data())
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  async recordPayment(invoiceId: string, amount: number, method: string) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Payment amount must be a positive number.');
    }
    if (!method || typeof method !== 'string') {
      throw new BadRequestException('Payment method is required.');
    }

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

      const due = Number(invoiceData.totalAmount);
      if (!Number.isFinite(due)) {
        throw new BadRequestException('Invoice total is invalid.');
      }

      // Exact match required — no NaN bypass, no underpayment, no silent overpay mark.
      if (amount + 1e-9 < due) {
        throw new BadRequestException(
          `Insufficient payment. Expected total ${due}, provided ${amount}.`,
        );
      }

      const recordedAmount = due; // store server total, ignore client overpay padding
      transaction.update(invoiceRef, { status: 'paid', paidAt: new Date().toISOString() });

      const paymentRef = this.firestore.collection('payments').doc();
      const payment = {
        id: paymentRef.id,
        invoiceId,
        amount: recordedAmount,
        method,
        createdAt: new Date().toISOString(),
      };
      transaction.set(paymentRef, payment);

      return { invoiceId, status: 'paid', payment };
    });
  }

  async refundInvoice(invoiceId: string, reason: string) {
    if (!reason?.trim()) {
      throw new BadRequestException('Refund reason is required.');
    }

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
        reason: reason.trim(),
        createdAt: new Date().toISOString(),
      };
      transaction.set(refundRef, refund);

      return { invoiceId, status: 'refunded', refund };
    });
  }
}
