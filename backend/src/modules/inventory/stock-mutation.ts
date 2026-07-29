import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { FirestoreService } from '../../database/firestore.service';

export type StockTxType = 'purchase' | 'sale' | 'adjustment' | 'manual_add';

export interface ApplyStockChangeInput {
  medicineId: string;
  batchNo: string;
  /** Positive = add stock, negative = deduct. */
  quantityChange: number;
  type: StockTxType;
  reason: string;
  hospitalId: string;
  /** Required when creating a new batch (positive change, batch missing). */
  expiryDate?: string;
  unitPrice?: number;
  purchaseOrderId?: string;
  saleId?: string;
  userId?: string;
  supplierId?: string;
  supplierName?: string;
}

export interface ApplyStockChangeResult {
  medicineId: string;
  medicineName: string;
  batchNo: string;
  batchQuantity: number;
  totalQuantity: number;
  unitPrice: number;
  stockTransactionId: string;
}

function assertExpiryNotPast(expiryDate: string) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  if (isNaN(expiry.getTime()) || expiry < now) {
    throw new BadRequestException('Expiry date must be valid and cannot be in the past.');
  }
}

/**
 * Apply one or more batch stock mutations inside an existing Firestore transaction.
 * All reads happen before any writes (Firestore transaction rule).
 * Each input writes one `stockTransactions` row; hospital `stockSummaries` is bumped once.
 */
export async function applyStockChanges(
  firestore: FirestoreService,
  transaction: any,
  inputs: ApplyStockChangeInput[],
): Promise<ApplyStockChangeResult[]> {
  if (!inputs.length) return [];

  const hospitalId = inputs[0].hospitalId;
  if (!hospitalId || inputs.some((i) => i.hospitalId !== hospitalId)) {
    throw new BadRequestException('All stock mutations in a transaction must share hospitalId.');
  }

  // --- READ PHASE ---
  const medCache = new Map<string, any>();
  const batchCache = new Map<string, { ref: any; data: any | null }>();

  for (const input of inputs) {
    if (!input.quantityChange) {
      throw new BadRequestException('quantityChange must be non-zero.');
    }
    if (!medCache.has(input.medicineId)) {
      const medRef = firestore.collection('medicines').doc(input.medicineId);
      const medDoc = await transaction.get(medRef);
      if (!medDoc.exists) {
        throw new NotFoundException(`Medicine with ID ${input.medicineId} does not exist.`);
      }
      const medData = medDoc.data()!;
      if (medData.status === 'inactive') {
        throw new BadRequestException(`Cannot mutate stock for inactive medicine SKU: ${medData.name}.`);
      }
      if (medData.hospitalId && medData.hospitalId !== hospitalId) {
        throw new BadRequestException('Medicine does not belong to this hospital.');
      }
      medCache.set(input.medicineId, { ref: medRef, data: { ...medData } });
    }

    const batchKey = `${input.medicineId}::${input.batchNo}`;
    if (!batchCache.has(batchKey)) {
      const medRef = medCache.get(input.medicineId).ref;
      const batchRef = medRef.collection('batches').doc(input.batchNo);
      const batchDoc = await transaction.get(batchRef);
      batchCache.set(batchKey, {
        ref: batchRef,
        data: batchDoc.exists ? { ...batchDoc.data() } : null,
      });
    }
  }

  const summaryRef = firestore.collection('stockSummaries').doc(hospitalId);
  const summaryDoc = await transaction.get(summaryRef);
  const summaryPrev = summaryDoc.exists
    ? summaryDoc.data()!
    : { totalUnits: 0, mutationCount: 0 };

  // --- COMPUTE + WRITE PHASE ---
  const results: ApplyStockChangeResult[] = [];
  let unitsDelta = 0;

  for (const input of inputs) {
    const med = medCache.get(input.medicineId);
    const batchKey = `${input.medicineId}::${input.batchNo}`;
    const batchEntry = batchCache.get(batchKey)!;
    const existing = batchEntry.data;

    let newBatchQty: number;
    let expiryDate: string;
    let unitPrice: number;

    if (input.quantityChange > 0) {
      if (existing) {
        if (input.expiryDate && existing.expiryDate !== input.expiryDate) {
          throw new ConflictException(
            `Batch ${input.batchNo} already exists with a different expiry date (${existing.expiryDate}).`,
          );
        }
        if (input.unitPrice != null && existing.unitPrice !== input.unitPrice) {
          throw new ConflictException(
            `Batch ${input.batchNo} already exists with a different unit price (${existing.unitPrice}).`,
          );
        }
        newBatchQty = existing.quantity + input.quantityChange;
        expiryDate = existing.expiryDate;
        unitPrice = existing.unitPrice;
      } else {
        if (!input.expiryDate || input.unitPrice == null) {
          throw new BadRequestException(
            'expiryDate and unitPrice are required when creating a new batch.',
          );
        }
        assertExpiryNotPast(input.expiryDate);
        newBatchQty = input.quantityChange;
        expiryDate = input.expiryDate;
        unitPrice = input.unitPrice;
      }
    } else {
      if (!existing) {
        throw new NotFoundException(
          `Batch ${input.batchNo} not found for Medicine ${input.medicineId}.`,
        );
      }
      newBatchQty = existing.quantity + input.quantityChange;
      if (newBatchQty < 0) {
        throw new BadRequestException(
          `Insufficient stock on batch ${input.batchNo}. Available: ${existing.quantity}, requested: ${Math.abs(input.quantityChange)}`,
        );
      }
      expiryDate = existing.expiryDate;
      unitPrice = existing.unitPrice;
    }

    const newTotal = (med.data.totalQuantity || 0) + input.quantityChange;
    if (newTotal < 0) {
      throw new BadRequestException('Medicine total quantity cannot go below 0.');
    }

    // Update in-memory caches so subsequent lines see prior deltas in this tx.
    batchEntry.data = {
      batchNo: input.batchNo,
      expiryDate,
      quantity: newBatchQty,
      unitPrice,
      hospitalId,
      updatedAt: new Date().toISOString(),
    };
    med.data.totalQuantity = newTotal;
    unitsDelta += input.quantityChange;

    transaction.set(batchEntry.ref, batchEntry.data);
    transaction.update(med.ref, { totalQuantity: newTotal });

    const txRef = firestore.collection('stockTransactions').doc();
    transaction.set(txRef, {
      id: txRef.id,
      medicineId: input.medicineId,
      medicineName: med.data.name,
      batchNo: input.batchNo,
      type: input.type,
      quantityChange: input.quantityChange,
      reason: input.reason,
      hospitalId,
      purchaseOrderId: input.purchaseOrderId || null,
      saleId: input.saleId || null,
      userId: input.userId || null,
      supplierId: input.supplierId || null,
      supplierName: input.supplierName || null,
      expiryDate,
      unitPrice,
      createdAt: new Date().toISOString(),
    });

    results.push({
      medicineId: input.medicineId,
      medicineName: med.data.name,
      batchNo: input.batchNo,
      batchQuantity: newBatchQty,
      totalQuantity: newTotal,
      unitPrice,
      stockTransactionId: txRef.id,
    });
  }

  transaction.set(summaryRef, {
    hospitalId,
    totalUnits: (summaryPrev.totalUnits || 0) + unitsDelta,
    mutationCount: (summaryPrev.mutationCount || 0) + inputs.length,
    updatedAt: new Date().toISOString(),
  });

  return results;
}

export async function applyStockChange(
  firestore: FirestoreService,
  transaction: any,
  input: ApplyStockChangeInput,
): Promise<ApplyStockChangeResult> {
  const [result] = await applyStockChanges(firestore, transaction, [input]);
  return result;
}
