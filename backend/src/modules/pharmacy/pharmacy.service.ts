import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { FirestoreService } from '../../database/firestore.service';
import { CreateDispensationDto } from './dto/create-dispensation.dto';

@Injectable()
export class PharmacyService {
  constructor(private firestore: FirestoreService) {}

  async dispensePrescription(dto: CreateDispensationDto) {
    const { prescriptionId, items } = dto;

    return this.firestore.runTransaction(async (transaction) => {
      // 1. Fetch Prescription
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

      // 2. Verify stock levels and deduct quantities
      for (const item of items) {
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

        if (batchData.quantity < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for Medicine ${medData.name} (Batch: ${item.batchNo}). Available: ${batchData.quantity}, requested: ${item.quantity}`,
          );
        }

        // Decrement batch stock
        const newBatchQty = batchData.quantity - item.quantity;
        transaction.update(batchRef, { quantity: newBatchQty });

        // Decrement medicine total
        const newTotalQty = medData.totalQuantity - item.quantity;
        transaction.update(medRef, { totalQuantity: newTotalQty });

        // Log Stock Transaction
        const txRef = this.firestore.collection('stockTransactions').doc();
        const tx = {
          id: txRef.id,
          medicineId: item.medicineId,
          medicineName: medData.name,
          batchNo: item.batchNo,
          type: 'sale',
          quantityChange: -item.quantity,
          reason: 'prescription_dispensation',
          createdAt: new Date().toISOString(),
        };
        transaction.set(txRef, tx);

        // Update Prescription line item status
        const rxItemIndex = prescriptionData.items.findIndex(
          (rxItem: any) => rxItem.medicineId === item.medicineId,
        );
        if (rxItemIndex !== -1) {
          prescriptionData.items[rxItemIndex].status = 'dispensed';
        }

        // Append to invoice items
        invoiceItems.push({
          description: `Medicine: ${medData.name} (Batch: ${item.batchNo}) x${item.quantity}`,
          amount: item.quantity * batchData.unitPrice,
        });
      }

      // 3. Update global prescription status
      const allDispensed = prescriptionData.items.every((rxItem: any) => rxItem.status === 'dispensed');
      const nextRxStatus = allDispensed ? 'dispensed' : 'partial';
      transaction.update(prescriptionRef, {
        items: prescriptionData.items,
        status: nextRxStatus,
      });

      // 4. Generate Billing Invoice
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
        const batchesSnapshot = await this.firestore.collection('medicines')
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
