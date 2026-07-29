import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { FirestoreService } from '../../database/firestore.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';
import { supplierView } from '../../common/privacy/sanitize';
import { applyStockChanges } from '../inventory/stock-mutation';

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
    return supplierView(supplier);
  }

  async findSupplier(id: string) {
    const doc = await this.firestore.collection('suppliers').doc(id).get();
    if (!doc.exists) {
      throw new NotFoundException(`Supplier with ID ${id} does not exist.`);
    }
    return supplierView(doc.data());
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto) {
    const supRef = this.firestore.collection('suppliers').doc(id);
    const doc = await supRef.get();
    if (!doc.exists) {
      throw new NotFoundException(`Supplier with ID ${id} does not exist.`);
    }
    await supRef.update({ ...dto });
    const updated = await supRef.get();
    return supplierView(updated.data());
  }

  async findAllSuppliers(includeInactive?: string, page = 1, limit = 10) {
    const snapshot = await this.firestore.collection('suppliers').get();
    let list = snapshot.docs.map((doc) => supplierView(doc.data()));
    if (includeInactive !== 'true') {
      list = list.filter((s: any) => s.status !== 'inactive');
    }
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

  async createPurchaseOrder(dto: CreatePurchaseOrderDto) {
    const hospitalId = dto.hospitalId || 'default';
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
      hospitalId,
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
    const orderData = doc.data()!;
    if (orderData.status === 'received') {
      throw new BadRequestException('Cannot cancel a fully received purchase order.');
    }
    const hasAnyReceived = orderData.items.some((item: any) => (item.quantityReceived || 0) > 0);
    if (hasAnyReceived) {
      throw new BadRequestException('Cannot cancel a purchase order that has been partially received.');
    }
    await orderRef.update({ status: 'cancelled' });
    return { id, status: 'cancelled' };
  }

  async getPurchaseOrders(page = 1, limit = 10, hospitalId?: string) {
    const snapshot = await this.firestore.collection('purchaseOrders').get();
    let list = snapshot.docs.map((doc) => doc.data());
    if (hospitalId) {
      list = list.filter((o: any) => !o.hospitalId || o.hospitalId === hospitalId);
    }

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

  async getPurchaseHistory(hospitalId?: string, page = 1, limit = 50) {
    const result = await this.getPurchaseOrders(page, limit, hospitalId);
    const items = [...result.items].sort((a: any, b: any) =>
      (b.createdAt || '').localeCompare(a.createdAt || ''),
    );
    return { ...result, items };
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

      const hospitalId = orderData.hospitalId || 'default';
      const updatedItems = [...orderData.items];
      const stockInputs: Parameters<typeof applyStockChanges>[2] = [];

      for (const recItem of dto.items) {
        if (recItem.quantityReceived <= 0) {
          throw new BadRequestException('Received quantity must be greater than 0.');
        }

        const orderLineItem = updatedItems.find((item) => item.medicineId === recItem.medicineId);
        if (!orderLineItem) {
          throw new NotFoundException(`Medicine ${recItem.medicineId} is not part of this purchase order.`);
        }

        const totalReceived = (orderLineItem.quantityReceived || 0) + recItem.quantityReceived;
        if (totalReceived > orderLineItem.quantity) {
          throw new BadRequestException(
            `Cannot receive more quantity than ordered for Medicine ${recItem.medicineId}. Ordered: ${orderLineItem.quantity}, Already Received: ${orderLineItem.quantityReceived || 0}, Incoming: ${recItem.quantityReceived}`,
          );
        }
        orderLineItem.quantityReceived = totalReceived;

        stockInputs.push({
          medicineId: recItem.medicineId,
          batchNo: recItem.batchNo,
          quantityChange: recItem.quantityReceived,
          type: 'purchase',
          reason: 'purchase_order_receipt',
          hospitalId,
          expiryDate: recItem.expiryDate,
          unitPrice: orderLineItem.unitPrice,
          purchaseOrderId: orderId,
          supplierId: orderData.supplierId,
          supplierName: orderData.supplierName,
        });
      }

      await applyStockChanges(this.firestore, transaction, stockInputs);

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
