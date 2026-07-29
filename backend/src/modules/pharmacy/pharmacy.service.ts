import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { FirestoreService } from '../../database/firestore.service';
import { CreateDispensationDto } from './dto/create-dispensation.dto';

@Injectable()
export class PharmacyService {
  constructor(private firestore: FirestoreService) {}

  async dispensePrescription(dto: CreateDispensationDto) {
    const { prescriptionId, items } = dto;

    return this.firestore.runTransaction(async (transaction) => {
      const prescriptionRef = this.firestore.collection('prescriptions').doc(prescriptionId);
      const prescriptionDoc = await transaction.get(prescriptionRef);
      if (!prescriptionDoc.exists) {
        throw new NotFoundException(`Prescription with ID ${prescriptionId} does not exist.`);
      }
      const prescriptionData = prescriptionDoc.data()!;

      if (prescriptionData.status === 'dispensed') {
        throw new BadRequestException(`Prescription ${prescriptionId} has already been fully dispensed.`);
      }

      const invoiceItems: any[] = [];
      const rxItems = [...(prescriptionData.items || [])];

      for (const item of items) {
        if (!Number.isFinite(item.quantity) || item.quantity < 1) {
          throw new BadRequestException('Dispense quantity must be a positive integer.');
        }

        const rxItemIndex = rxItems.findIndex(
          (rxItem: any) => rxItem.medicineId === item.medicineId && rxItem.status !== 'dispensed',
        );
        if (rxItemIndex === -1) {
          throw new BadRequestException(
            `Medicine ${item.medicineId} is not an open line on this prescription.`,
          );
        }

        const prescribedQty = Number(rxItems[rxItemIndex].quantity);
        if (Number.isFinite(prescribedQty) && item.quantity > prescribedQty) {
          throw new BadRequestException(
            `Cannot dispense more than prescribed (${prescribedQty}) for medicine ${item.medicineId}.`,
          );
        }

        const medRef = this.firestore.collection('medicines').doc(item.medicineId);
        const medDoc = await transaction.get(medRef);
        if (!medDoc.exists) {
          throw new NotFoundException(`Medicine with ID ${item.medicineId} does not exist.`);
        }
        const medData = medDoc.data()!;

        const batchRef = medRef.collection('batches').doc(item.batchNo);
        const batchDoc = await transaction.get(batchRef);
        if (!batchDoc.exists) {
          throw new NotFoundException(`Batch ${item.batchNo} not found for Medicine ${medData.name}.`);
        }
        const batchData = batchDoc.data()!;
        const unitPrice = Number(batchData.unitPrice);
        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
          throw new BadRequestException(`Invalid unit price on batch ${item.batchNo}.`);
        }

        if (batchData.quantity < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for Medicine ${medData.name} (Batch: ${item.batchNo}). Available: ${batchData.quantity}, requested: ${item.quantity}`,
          );
        }

        transaction.update(batchRef, { quantity: batchData.quantity - item.quantity });
        transaction.update(medRef, { totalQuantity: medData.totalQuantity - item.quantity });

        const txRef = this.firestore.collection('stockTransactions').doc();
        transaction.set(txRef, {
          id: txRef.id,
          medicineId: item.medicineId,
          medicineName: medData.name,
          batchNo: item.batchNo,
          type: 'sale',
          quantityChange: -item.quantity,
          reason: 'prescription_dispensation',
          createdAt: new Date().toISOString(),
        });

        rxItems[rxItemIndex] = { ...rxItems[rxItemIndex], status: 'dispensed' };

        // Price from batch — never from client body.
        invoiceItems.push({
          description: `Medicine: ${medData.name} (Batch: ${item.batchNo}) x${item.quantity}`,
          amount: item.quantity * unitPrice,
        });
      }

      const allDispensed = rxItems.every((rxItem: any) => rxItem.status === 'dispensed');
      const nextRxStatus = allDispensed ? 'dispensed' : 'partial';
      transaction.update(prescriptionRef, {
        items: rxItems,
        status: nextRxStatus,
      });

      const invoiceRef = this.firestore.collection('invoices').doc();
      const totalAmount = invoiceItems.reduce((sum, line) => sum + line.amount, 0);
      const invoice = {
        id: invoiceRef.id,
        patientId: prescriptionData.patientId,
        patientName: prescriptionData.patientName || 'Patient',
        items: invoiceItems,
        totalAmount,
        status: 'unpaid',
        createdAt: new Date().toISOString(),
      };
      transaction.set(invoiceRef, invoice);

      return {
        prescriptionId,
        prescriptionStatus: nextRxStatus,
        invoiceId: invoiceRef.id,
        invoiceAmount: totalAmount,
      };
    });
  }

  async findPrescriptions(status?: string) {
    const snapshot = await this.firestore.collection('prescriptions').get();
    let prescriptions = snapshot.docs.map((doc) => doc.data());

    if (status) {
      prescriptions = prescriptions.filter((p: any) => p.status === status);
    }

    prescriptions.sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt));

    for (const rx of prescriptions) {
      for (const item of rx.items) {
        const batchesSnapshot = await this.firestore
          .collection('medicines')
          .doc(item.medicineId)
          .collection('batches')
          .get();

        const batches = batchesSnapshot.docs.map((d) => d.data());
        const activeBatches = batches.filter((b: any) => b.quantity > 0 && b.expiryDate);
        activeBatches.sort((a: any, b: any) => a.expiryDate.localeCompare(b.expiryDate));

        if (activeBatches.length > 0) {
          item.suggestedBatch = activeBatches[0].batchNo;
          item.suggestedBatchExpiry = activeBatches[0].expiryDate;
          item.availableStock = activeBatches[0].quantity;
        } else {
          item.suggestedBatch = null;
          item.availableStock = 0;
        }
      }
    }

    return prescriptions;
  }
}
