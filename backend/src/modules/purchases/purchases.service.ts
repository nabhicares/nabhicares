import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { FirestoreService } from '../../database/firestore.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';

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
      createdAt: new Date().toISOString(),
    };
    await supplierRef.set(supplier);
    return supplier;
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

    const orderRef = this.firestore.collection('purchaseOrders').doc();
    const order = {
      id: orderRef.id,
      supplierId: dto.supplierId,
      supplierName: supDoc.data()!.name,
      items: dto.items,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    await orderRef.set(order);
    return order;
  }

  async getPurchaseOrders() {
    const snapshot = await this.firestore.collection('purchaseOrders').get();
    return snapshot.docs.map((doc) => doc.data());
  }

  async receivePurchaseOrder(orderId: string, batchNo: string, expiryDate: string) {
    return this.firestore.runTransaction(async (transaction) => {
      const orderRef = this.firestore.collection('purchaseOrders').doc(orderId);
      const orderDoc = await transaction.get(orderRef);
      if (!orderDoc.exists) {
        throw new NotFoundException(`Purchase order with ID ${orderId} does not exist.`);
      }

      const orderData = orderDoc.data()!;
      if (orderData.status === 'received') {
        throw new BadRequestException(`Purchase order ${orderId} has already been received.`);
      }

      transaction.update(orderRef, { status: 'received', receivedAt: new Date().toISOString() });

      for (const item of orderData.items) {
        const medRef = this.firestore.collection('medicines').doc(item.medicineId);
        const medDoc = await transaction.get(medRef);
        if (!medDoc.exists) {
          throw new NotFoundException(`Medicine SKU with ID ${item.medicineId} does not exist.`);
        }
        const medData = medDoc.data()!;

        const batchRef = medRef.collection('batches').doc(batchNo);
        const batchDoc = await transaction.get(batchRef);

        let newQty = item.quantity;
        if (batchDoc.exists) {
          newQty += batchDoc.data()!.quantity;
        }

        const batch = {
          batchNo,
          expiryDate,
          quantity: newQty,
          unitPrice: item.unitPrice,
          updatedAt: new Date().toISOString(),
        };

        transaction.set(batchRef, batch);

        const newTotal = medData.totalQuantity + item.quantity;
        transaction.update(medRef, { totalQuantity: newTotal });

        const txRef = this.firestore.collection('stockTransactions').doc();
        const tx = {
          id: txRef.id,
          medicineId: item.medicineId,
          medicineName: medData.name,
          batchNo,
          type: 'purchase',
          quantityChange: item.quantity,
          reason: 'purchase_order_receipt',
          createdAt: new Date().toISOString(),
        };
        transaction.set(txRef, tx);
      }

      return { orderId, status: 'received' };
    });
  }
}
