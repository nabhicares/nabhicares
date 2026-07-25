import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { FirestoreService } from '../../database/firestore.service';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';
import { AddBatchDto } from './dto/add-batch.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';

@Injectable()
export class InventoryService {
  constructor(private firestore: FirestoreService) {}

  async createMedicine(dto: CreateMedicineDto) {
    const normalizedName = (dto.name + (dto.strength || '') + (dto.form || '')).toLowerCase().replace(/\s+/g, '');
    
    const existingSnapshot = await this.firestore.collection('medicines')
      .where('normalizedName', '==', normalizedName)
      .get();
    
    if (!existingSnapshot.empty) {
      throw new ConflictException(`Medicine with name "${dto.name}", strength "${dto.strength || ''}", and form "${dto.form || ''}" already exists.`);
    }

    const medicineRef = this.firestore.collection('medicines').doc();
    const medicine = {
      id: medicineRef.id,
      name: dto.name,
      genericName: dto.genericName,
      category: dto.category,
      reorderLevel: dto.reorderLevel,
      totalQuantity: 0,
      brand: dto.brand || null,
      form: dto.form || null,
      strength: dto.strength || null,
      unit: dto.unit || null,
      packSize: dto.packSize || null,
      mrp: dto.mrp || null,
      gstPercent: dto.gstPercent || null,
      barcode: dto.barcode || null,
      location: dto.location || null,
      status: 'active',
      normalizedName,
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
    const data = doc.data()!;
    const batchesSnapshot = await this.firestore.collection('medicines').doc(id).collection('batches').get();
    data.batches = batchesSnapshot.docs.map((b) => b.data());
    return data;
  }

  async findAllMedicines(q?: string, category?: string, status?: string, page = 1, limit = 10) {
    const snapshot = await this.firestore.collection('medicines').get();
    let list = snapshot.docs.map((doc) => doc.data());

    if (q) {
      const term = q.toLowerCase();
      list = list.filter((m: any) => 
        (m.name && m.name.toLowerCase().includes(term)) ||
        (m.genericName && m.genericName.toLowerCase().includes(term)) ||
        (m.brand && m.brand.toLowerCase().includes(term)) ||
        (m.barcode && m.barcode.toLowerCase().includes(term))
      );
    }

    if (category && category !== 'All') {
      list = list.filter((m: any) => m.category === category);
    }

    if (status) {
      if (status === 'low') {
        list = list.filter((m: any) => m.totalQuantity > 0 && m.totalQuantity <= m.reorderLevel);
      } else if (status === 'out') {
        list = list.filter((m: any) => m.totalQuantity === 0);
      } else if (status === 'ok') {
        list = list.filter((m: any) => m.totalQuantity > m.reorderLevel);
      }
    }

    const totalCount = list.length;
    const pageNum = (page && !isNaN(Number(page)) && Number(page) > 0) ? Number(page) : 1;
    const limitNum = (limit && !isNaN(Number(limit)) && Number(limit) > 0) ? Number(limit) : 10;
    
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = list.slice(startIndex, startIndex + limitNum);

    return {
      data: paginated,
      totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum)
    };
  }

  async getLowStockMedicines() {
    const snapshot = await this.firestore.collection('medicines').get();
    const medicines = snapshot.docs.map((doc) => doc.data());
    return medicines.filter((m: any) => m.status === 'active' && m.totalQuantity <= m.reorderLevel);
  }

  async addBatch(medicineId: string, dto: AddBatchDto) {
    if (dto.quantity <= 0) {
      throw new BadRequestException('Batch quantity must be greater than 0.');
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const expiry = new Date(dto.expiryDate);
    if (isNaN(expiry.getTime()) || expiry < now) {
      throw new BadRequestException('Expiry date must be a valid date and cannot be in the past.');
    }

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
        const existingBatch = batchDoc.data()!;
        if (existingBatch.expiryDate !== dto.expiryDate || existingBatch.unitPrice !== dto.unitPrice) {
          throw new ConflictException(
            `Batch ${dto.batchNo} already exists with a different expiry date (${existingBatch.expiryDate}) or unit price (${existingBatch.unitPrice}).`
          );
        }
        newQty += existingBatch.quantity;
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

  async updateMedicine(id: string, dto: UpdateMedicineDto) {
    const medRef = this.firestore.collection('medicines').doc(id);
    const doc = await medRef.get();
    if (!doc.exists) {
      throw new NotFoundException(`Medicine with ID ${id} does not exist.`);
    }

    const updateData: any = { ...dto };
    
    if (dto.name || dto.strength || dto.form) {
      const currentData = doc.data()!;
      const newName = dto.name ?? currentData.name;
      const newStrength = dto.strength ?? currentData.strength ?? '';
      const newForm = dto.form ?? currentData.form ?? '';
      const normalizedName = (newName + newStrength + newForm).toLowerCase().replace(/\s+/g, '');
      
      const existingSnapshot = await this.firestore.collection('medicines')
        .where('normalizedName', '==', normalizedName)
        .get();
      
      const conflicts = existingSnapshot.docs.filter(d => d.id !== id);
      if (conflicts.length > 0) {
        throw new ConflictException(`Another medicine with this name, strength, and form already exists.`);
      }
      updateData.normalizedName = normalizedName;
    }

    await medRef.update(updateData);
    const updatedDoc = await medRef.get();
    return updatedDoc.data();
  }

  async getAlerts(withinDays = 30) {
    const medsSnapshot = await this.firestore.collection('medicines').get();
    const medicines = medsSnapshot.docs.map((doc) => doc.data());

    const lowStock = medicines.filter((m: any) => m.status === 'active' && m.totalQuantity > 0 && m.totalQuantity <= m.reorderLevel);
    const outOfStock = medicines.filter((m: any) => m.status === 'active' && m.totalQuantity === 0);

    const expiring: any[] = [];
    const now = new Date();
    const limitDate = new Date();
    limitDate.setDate(now.getDate() + Number(withinDays));

    for (const med of medicines) {
      if (med.status !== 'active') continue;
      const batchesSnapshot = await this.firestore.collection('medicines')
        .doc(med.id)
        .collection('batches')
        .get();
      
      for (const batchDoc of batchesSnapshot.docs) {
        const batch = batchDoc.data();
        if (batch.expiryDate && batch.quantity > 0) {
          const expiry = new Date(batch.expiryDate);
          if (expiry >= now && expiry <= limitDate) {
            expiring.push({
              medicineId: med.id,
              medicineName: med.name,
              batchNo: batch.batchNo,
              quantity: batch.quantity,
              expiryDate: batch.expiryDate,
              unitPrice: batch.unitPrice,
            });
          }
        }
      }
    }

    return { lowStock, outOfStock, expiring };
  }

  async findTransactions(medicineId?: string, from?: string, to?: string, type?: string) {
    let query: any = this.firestore.collection('stockTransactions');
    
    if (medicineId) {
      query = query.where('medicineId', '==', medicineId);
    }
    if (type) {
      query = query.where('type', '==', type);
    }

    const snapshot = await query.get();
    let list = snapshot.docs.map((doc: any) => doc.data());

    if (from) {
      list = list.filter((tx: any) => tx.createdAt >= from);
    }
    if (to) {
      list = list.filter((tx: any) => tx.createdAt <= to);
    }

    list.sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt));
    return list;
  }
}
