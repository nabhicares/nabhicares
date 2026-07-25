import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { FirestoreService } from '../../database/firestore.service';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { AddBatchDto } from './dto/add-batch.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';

@Injectable()
export class InventoryService {
  constructor(private firestore: FirestoreService) {}

  async createMedicine(dto: CreateMedicineDto) {
    const medicineRef = this.firestore.collection('medicines').doc();
    const medicine = {
      id: medicineRef.id,
      name: dto.name,
      genericName: dto.genericName,
      category: dto.category,
      reorderLevel: dto.reorderLevel,
      totalQuantity: 0,
      createdAt: new Date().toISOString(),
    };
    await medicineRef.set(medicine);
    return medicine;
  }

  async findMedicine(id: string) {
    const doc = await this.firestore.collection('medicines').doc(id).get();
    if (!doc.exists) {
      throw new NotFoundException(`Medicine with ID ${id} does not exist.`);
    }
    return doc.data();
  }

  async findAllMedicines() {
    const snapshot = await this.firestore.collection('medicines').get();
    return snapshot.docs.map((doc) => doc.data());
  }

  async getLowStockMedicines() {
    const snapshot = await this.firestore.collection('medicines').get();
    const medicines = snapshot.docs.map((doc) => doc.data());
    return medicines.filter((m: any) => m.totalQuantity <= m.reorderLevel);
  }

  async addBatch(medicineId: string, dto: AddBatchDto) {
    return this.firestore.runTransaction(async (transaction) => {
      const medRef = this.firestore.collection('medicines').doc(medicineId);
      const medDoc = await transaction.get(medRef);
      if (!medDoc.exists) {
        throw new NotFoundException(`Medicine with ID ${medicineId} does not exist.`);
      }
      const medData = medDoc.data()!;

      const batchRef = medRef.collection('batches').doc(dto.batchNo);
      const batchDoc = await transaction.get(batchRef);

      let newQty = dto.quantity;
      if (batchDoc.exists) {
        newQty += batchDoc.data()!.quantity;
      }

      const batch = {
        batchNo: dto.batchNo,
        expiryDate: dto.expiryDate,
        quantity: newQty,
        unitPrice: dto.unitPrice,
        updatedAt: new Date().toISOString(),
      };

      transaction.set(batchRef, batch);

      const newTotal = medData.totalQuantity + dto.quantity;
      transaction.update(medRef, { totalQuantity: newTotal });

      const txRef = this.firestore.collection('stockTransactions').doc();
      const tx = {
        id: txRef.id,
        medicineId,
        medicineName: medData.name,
        batchNo: dto.batchNo,
        type: 'purchase',
        quantityChange: dto.quantity,
        reason: 'purchase_order_receipt',
        createdAt: new Date().toISOString(),
      };

      transaction.set(txRef, tx);
      return { medicineId, batch, totalQuantity: newTotal };
    });
  }

  async adjustStock(userId: string, dto: AdjustStockDto) {
    const { medicineId, batchNo, quantityChange, reason } = dto;

    return this.firestore.runTransaction(async (transaction) => {
      const medRef = this.firestore.collection('medicines').doc(medicineId);
      const medDoc = await transaction.get(medRef);
      if (!medDoc.exists) {
        throw new NotFoundException(`Medicine with ID ${medicineId} does not exist.`);
      }
      const medData = medDoc.data()!;

      const batchRef = medRef.collection('batches').doc(batchNo);
      const batchDoc = await transaction.get(batchRef);
      if (!batchDoc.exists) {
        throw new NotFoundException(`Batch ${batchNo} not found for Medicine ${medicineId}.`);
      }
      const batchData = batchDoc.data()!;

      const newBatchQty = batchData.quantity + quantityChange;
      if (newBatchQty < 0) {
        throw new BadRequestException(
          `Cannot adjust stock below 0. Current batch qty: ${batchData.quantity}, requested change: ${quantityChange}`,
        );
      }

      transaction.update(batchRef, { quantity: newBatchQty });

      const newTotal = medData.totalQuantity + quantityChange;
      transaction.update(medRef, { totalQuantity: newTotal });

      const txRef = this.firestore.collection('stockTransactions').doc();
      const tx = {
        id: txRef.id,
        medicineId,
        medicineName: medData.name,
        batchNo,
        type: 'adjustment',
        quantityChange,
        reason,
        userId,
        createdAt: new Date().toISOString(),
      };

      transaction.set(txRef, tx);
      return { medicineId, batchNo, quantityChange, newTotal };
    });
  }

  async findBatches(medicineId: string) {
    const snapshot = await this.firestore
      .collection('medicines')
      .doc(medicineId)
      .collection('batches')
      .get();
    return snapshot.docs.map((doc) => doc.data());
  }
}
