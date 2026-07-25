import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { FirestoreService } from '../../database/firestore.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';

@Injectable()
export class PurchasesService {
  constructor(private firestore: FirestoreService) {}

  async createSupplier(dto: CreateSupplierDto) {
    const supplierRef = this.firestore.collection('suppliers').doc();
    const supplier = {
      id: supplierRef.id,
      name: dto.name,
      contactEmail: dto.contactEmail,
      address: dto.address,
      phone: dto.phone || null,
      gstin: dto.gstin || null,
      contactPerson: dto.contactPerson || null,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    await supplierRef.set(supplier);
    return supplier;
  }

  async findSupplier(id: string) {
    const doc = await this.firestore.collection('suppliers').doc(id).get();
    if (!doc.exists) {
      throw new NotFoundException(`Supplier with ID ${id} does not exist.`);
    }
    return doc.data();
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto) {
    const supRef = this.firestore.collection('suppliers').doc(id);
    const doc = await supRef.get();
    if (!doc.exists) {
      throw new NotFoundException(`Supplier with ID ${id} does not exist.`);
    }
    await supRef.update({ ...dto });
    const updated = await supRef.get();
    return updated.data();
  }

  async findAllSuppliers() {
    const snapshot = await this.firestore.collection('suppliers').get();
    return snapshot.docs.map((doc) => doc.data());
  }

  async createPurchaseOrder(dto: CreatePurchaseOrderDto) {
    const supDoc = await this.firestore.collection('suppliers').doc(dto.supplierId).get();
    if (!supDoc.exists) {
      throw new NotFoundException(`Supplier with ID ${dto.supplierId} does not exist.`);
    }

    const itemsWithNames: any[] = [];
    for (const item of dto.items) {
      const medDoc = await this.firestore.collection('medicines').doc(item.medicineId).get();
      if (!medDoc.exists) {
        throw new NotFoundException(`Medicine SKU with ID ${item.medicineId} does not exist.`);
      }
      itemsWithNames.push({
        medicineId: item.medicineId,
        medicineName: medDoc.data()!.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        quantityReceived: 0,
      });
    }

    const orderRef = this.firestore.collection('purchaseOrders').doc();
    const order = {
      id: orderRef.id,
      supplierId: dto.supplierId,
      supplierName: supDoc.data()!.name,
      items: itemsWithNames,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    await orderRef.set(order);
    return order;
  }

  async findPurchaseOrder(id: string) {
    const doc = await this.firestore.collection('purchaseOrders').doc(id).get();
    if (!doc.exists) {
      throw new NotFoundException(`Purchase order with ID ${id} does not exist.`);
    }
    return doc.data();
  }

  async cancelPurchaseOrder(id: string) {
    const orderRef = this.firestore.collection('purchaseOrders').doc(id);
    const doc = await orderRef.get();
    if (!doc.exists) {
      throw new NotFoundException(`Purchase order with ID ${id} does not exist.`);
    }
    if (doc.data()!.status === 'received') {
      throw new BadRequestException('Cannot cancel a fully received purchase order.');
    }
    await orderRef.update({ status: 'cancelled' });
    return { id, status: 'cancelled' };
  }

  async getPurchaseOrders() {
    const snapshot = await this.firestore.collection('purchaseOrders').get();
    return snapshot.docs.map((doc) => doc.data());
  }

  async receivePurchaseOrder(orderId: string, dto: ReceivePurchaseOrderDto) {
    return this.firestore.runTransaction(async (transaction) => {
      const orderRef = this.firestore.collection('purchaseOrders').doc(orderId);
      const orderDoc = await transaction.get(orderRef);
      if (!orderDoc.exists) {
        throw new NotFoundException(`Purchase order with ID ${orderId} does not exist.`);
      }

      const orderData = orderDoc.data()!;
      if (orderData.status === 'received' || orderData.status === 'cancelled') {
        throw new BadRequestException(`Purchase order ${orderId} is already in state "${orderData.status}".`);
      }

      const updatedItems = [...orderData.items];

      for (const recItem of dto.items) {
        if (recItem.quantityReceived <= 0) {
          throw new BadRequestException('Received quantity must be greater than 0.');
        }

        const orderLineItem = updatedItems.find((item) => item.medicineId === recItem.medicineId);
        if (!orderLineItem) {
          throw new NotFoundException(`Medicine ${recItem.medicineId} is not part of this purchase order.`);
        }

        orderLineItem.quantityReceived = (orderLineItem.quantityReceived || 0) + recItem.quantityReceived;

        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const expiry = new Date(recItem.expiryDate);
        if (isNaN(expiry.getTime()) || expiry < now) {
          throw new BadRequestException('Expiry date must be valid and cannot be in the past.');
        }

        const medRef = this.firestore.collection('medicines').doc(recItem.medicineId);
        const medDoc = await transaction.get(medRef);
        if (!medDoc.exists) {
          throw new NotFoundException(`Medicine with ID ${recItem.medicineId} does not exist.`);
        }
        const medData = medDoc.data()!;

        const batchRef = medRef.collection('batches').doc(recItem.batchNo);
        const batchDoc = await transaction.get(batchRef);

        let newBatchQty = recItem.quantityReceived;
        if (batchDoc.exists) {
          const existingBatch = batchDoc.data()!;
          if (existingBatch.expiryDate !== recItem.expiryDate || existingBatch.unitPrice !== orderLineItem.unitPrice) {
            throw new ConflictException(
              `Batch ${recItem.batchNo} already exists with a different expiry date (${existingBatch.expiryDate}) or unit price (${existingBatch.unitPrice}).`
            );
          }
          newBatchQty += existingBatch.quantity;
        }

        const newBatch = {
          batchNo: recItem.batchNo,
          expiryDate: recItem.expiryDate,
          quantity: newBatchQty,
          unitPrice: orderLineItem.unitPrice,
          updatedAt: new Date().toISOString(),
        };
        transaction.set(batchRef, newBatch);

        const newTotal = medData.totalQuantity + recItem.quantityReceived;
        transaction.update(medRef, { totalQuantity: newTotal });

        const txRef = this.firestore.collection('stockTransactions').doc();
        const tx = {
          id: txRef.id,
          medicineId: recItem.medicineId,
          medicineName: medData.name,
          batchNo: recItem.batchNo,
          type: 'purchase',
          quantityChange: recItem.quantityReceived,
          reason: 'purchase_order_receipt',
          createdAt: new Date().toISOString(),
        };
        transaction.set(txRef, tx);
      }

      let allReceived = true;
      let anyReceived = false;
      for (const item of updatedItems) {
        if ((item.quantityReceived || 0) < item.quantity) {
          allReceived = false;
        }
        if ((item.quantityReceived || 0) > 0) {
          anyReceived = true;
        }
      }

      const newStatus = allReceived ? 'received' : (anyReceived ? 'partial' : 'pending');
      transaction.update(orderRef, {
        items: updatedItems,
        status: newStatus,
        receivedAt: anyReceived ? new Date().toISOString() : null,
      });

      return { orderId, status: newStatus };
    });
  }
}
