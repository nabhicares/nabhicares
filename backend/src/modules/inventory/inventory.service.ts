import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { FirestoreService } from '../../database/firestore.service';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';
import { AddBatchDto } from './dto/add-batch.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { ManualStockAddDto } from './dto/manual-stock-add.dto';
import { applyStockChange } from './stock-mutation';

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

  async findAllMedicines(q?: string, category?: string, status?: string, page = 1, limit = 10, includeInactive?: string | boolean) {
    const snapshot = await this.firestore.collection('medicines').get();
    let list = snapshot.docs.map((doc) => doc.data());

    // Exclude inactive medicines by default unless explicitly requested otherwise
    const showInactive = includeInactive === 'true' || includeInactive === true;
    if (!showInactive) {
      list = list.filter((m: any) => m.status !== 'inactive');
    }

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
      items: paginated,
      meta: {
        totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum),
      },
    };
  }

  async getLowStockMedicines() {
    const snapshot = await this.firestore.collection('medicines').get();
    const medicines = snapshot.docs.map((doc) => doc.data());
    return medicines.filter((m: any) => m.status === 'active' && m.totalQuantity <= m.reorderLevel);
  }

  async addBatch(medicineId: string, dto: AddBatchDto, hospitalId = 'default') {
    if (dto.quantity <= 0) {
      throw new BadRequestException('Batch quantity must be greater than 0.');
    }

    return this.firestore.runTransaction(async (transaction) => {
      const result = await applyStockChange(this.firestore, transaction, {
        medicineId,
        batchNo: dto.batchNo,
        quantityChange: dto.quantity,
        type: 'purchase',
        reason: 'purchase_order_receipt',
        hospitalId,
        expiryDate: dto.expiryDate,
        unitPrice: dto.unitPrice,
      });
      return {
        medicineId,
        batch: {
          batchNo: result.batchNo,
          quantity: result.batchQuantity,
          expiryDate: dto.expiryDate,
          unitPrice: dto.unitPrice,
        },
        totalQuantity: result.totalQuantity,
      };
    });
  }

  async manualAddStock(dto: ManualStockAddDto) {
    if (dto.qty <= 0) {
      throw new BadRequestException('qty must be greater than 0.');
    }
    return this.firestore.runTransaction(async (transaction) => {
      return applyStockChange(this.firestore, transaction, {
        medicineId: dto.medicineId,
        batchNo: dto.batchNo,
        quantityChange: dto.qty,
        type: 'manual_add',
        reason: 'manual_stock_add',
        hospitalId: dto.hospitalId,
        expiryDate: dto.expiryDate,
        unitPrice: dto.unitPrice ?? 0,
      });
    });
  }

  async getBatchByNo(batchNo: string, hospitalId?: string) {
    const txSnap = await this.firestore.collection('stockTransactions').where('batchNo', '==', batchNo).get();
    let txs = txSnap.docs.map((d) => d.data());
    if (hospitalId) {
      txs = txs.filter((t: any) => !t.hospitalId || t.hospitalId === hospitalId);
    }
    if (txs.length === 0) {
      throw new NotFoundException(`No stock transactions found for batch ${batchNo}.`);
    }

    const purchaseTxs = txs.filter((t: any) => t.quantityChange > 0);
    const saleTxs = txs.filter((t: any) => t.type === 'sale' || t.quantityChange < 0);
    const latest = [...txs].sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt))[0];
    const medicineId = latest.medicineId;

    let batchLive: any = null;
    try {
      const batchDoc = await this.firestore
        .collection('medicines')
        .doc(medicineId)
        .collection('batches')
        .doc(batchNo)
        .get();
      if (batchDoc.exists) batchLive = batchDoc.data();
    } catch {
      /* ignore */
    }

    const quantityReceived = purchaseTxs.reduce((s: number, t: any) => s + (t.quantityChange || 0), 0);
    const poIds = purchaseTxs
      .map((t: any) => (t.purchaseOrderId ? String(t.purchaseOrderId) : ''))
      .filter((id: string) => id.length > 0)
      .filter((id: string, i: number, arr: string[]) => arr.indexOf(id) === i);

    let supplier: any = null;
    let purchaseOrderId: string | null = poIds.length ? poIds[0] : null;
    if (purchaseOrderId) {
      const poDoc = await this.firestore.collection('purchaseOrders').doc(purchaseOrderId).get();
      if (poDoc.exists) {
        const po = poDoc.data()!;
        supplier = { id: po.supplierId, name: po.supplierName };
      }
    } else {
      const withSupplier = purchaseTxs.find((t: any) => t.supplierName);
      if (withSupplier) {
        supplier = { id: withSupplier.supplierId || null, name: withSupplier.supplierName };
      }
    }

    // Also scan POs that mention this batch in receive history via stock tx purchaseOrderId already covered.
    return {
      batchNo,
      medicineId,
      medicineName: latest.medicineName,
      expiryDate: batchLive?.expiryDate || latest.expiryDate || null,
      quantityReceived,
      quantityRemaining: batchLive?.quantity ?? Math.max(0, quantityReceived + saleTxs.reduce((s: number, t: any) => s + (t.quantityChange || 0), 0)),
      supplier,
      purchaseOrderId,
      sales: saleTxs.map((t: any) => ({
        stockTransactionId: t.id,
        saleId: t.saleId,
        quantityChange: t.quantityChange,
        createdAt: t.createdAt,
      })),
      stockTransactions: txs,
    };
  }

  async getExpiryList(hospitalId: string, thresholdDays = 30) {
    const medsSnapshot = await this.firestore.collection('medicines').get();
    let medicines = medsSnapshot.docs.map((doc) => doc.data());
    if (hospitalId) {
      medicines = medicines.filter(
        (m: any) => !m.hospitalId || m.hospitalId === hospitalId,
      );
    }

    const now = new Date();
    const limitDate = new Date();
    limitDate.setDate(now.getDate() + Number(thresholdDays));
    const items: any[] = [];

    for (const med of medicines) {
      if (med.status !== 'active') continue;
      const batchesSnapshot = await this.firestore
        .collection('medicines')
        .doc(med.id)
        .collection('batches')
        .get();
      for (const batchDoc of batchesSnapshot.docs) {
        const batch = batchDoc.data();
        if (!batch.expiryDate || !(batch.quantity > 0)) continue;
        if (hospitalId && batch.hospitalId && batch.hospitalId !== hospitalId) continue;
        const expiry = new Date(batch.expiryDate);
        if (expiry >= now && expiry <= limitDate) {
          items.push({
            medicineId: med.id,
            medicineName: med.name,
            batchNo: batch.batchNo,
            quantity: batch.quantity,
            expiryDate: batch.expiryDate,
            unitPrice: batch.unitPrice,
            hospitalId: batch.hospitalId || med.hospitalId || hospitalId,
            daysUntilExpiry: Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
          });
        }
      }
    }

    items.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
    return items;
  }

  async adjustStock(userId: string, dto: AdjustStockDto, hospitalId = 'default') {
    const { medicineId, batchNo, quantityChange, reason } = dto;

    return this.firestore.runTransaction(async (transaction) => {
      const result = await applyStockChange(this.firestore, transaction, {
        medicineId,
        batchNo,
        quantityChange,
        type: 'adjustment',
        reason,
        hospitalId,
        userId,
      });
      return {
        medicineId,
        batchNo,
        quantityChange,
        newTotal: result.totalQuantity,
      };
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

  async findTransactions(medicineId?: string, from?: string, to?: string, type?: string, page = 1, limit = 10) {
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

    const pageNum = (page && !isNaN(Number(page)) && Number(page) > 0) ? Number(page) : 1;
    const limitNum = (limit && !isNaN(Number(limit)) && Number(limit) > 0) ? Number(limit) : 10;
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = list.slice(startIndex, startIndex + limitNum);

    return {
      items: paginated,
      meta: {
        totalCount: list.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(list.length / limitNum),
      },
    };
  }

  async getInventorySummary() {
    const medsSnapshot = await this.firestore.collection('medicines').get();
    const medicines = medsSnapshot.docs.map((doc) => doc.data());
    const activeMeds = medicines.filter((m: any) => m.status === 'active');

    let totalSKUs = activeMeds.length;
    let totalUnits = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalValue = 0;
    let expiringCount = 0;

    const now = new Date();
    const limitDate = new Date();
    limitDate.setDate(now.getDate() + 30); // within 30 days

    for (const med of activeMeds) {
      totalUnits += med.totalQuantity || 0;
      if (med.totalQuantity === 0) {
        outOfStockCount++;
      } else if (med.totalQuantity <= med.reorderLevel) {
        lowStockCount++;
      }

      const batchesSnapshot = await this.firestore.collection('medicines')
        .doc(med.id)
        .collection('batches')
        .get();

      for (const batchDoc of batchesSnapshot.docs) {
        const batch = batchDoc.data();
        if (batch.quantity > 0) {
          totalValue += (batch.quantity * (batch.unitPrice || 0));

          if (batch.expiryDate) {
            const expiry = new Date(batch.expiryDate);
            if (expiry >= now && expiry <= limitDate) {
              expiringCount++;
            }
          }
        }
      }
    }

    return {
      totalSKUs,
      totalUnits,
      lowStockCount,
      outOfStockCount,
      expiringCount,
      totalValue,
      updatedAt: new Date().toISOString()
    };
  }
}
