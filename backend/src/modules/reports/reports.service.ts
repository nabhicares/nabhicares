import { Injectable } from '@nestjs/common';
import { FirestoreService } from '../../database/firestore.service';

@Injectable()
export class ReportsService {
  constructor(private firestore: FirestoreService) {}

  async getDashboardSummary() {
    // Read total count of active appointments
    const appointmentsSnapshot = await this.firestore.collection('appointments').get();
    const totalAppointments = appointmentsSnapshot.size;

    // Calculate low-stock item counts
    const medicinesSnapshot = await this.firestore.collection('medicines').get();
    let totalStockItems = 0;
    let lowStockCount = 0;

    const medicines = medicinesSnapshot.docs.map((doc) => {
      const data = doc.data();
      totalStockItems += data.totalQuantity || 0;
      if (data.totalQuantity <= data.reorderLevel) {
        lowStockCount++;
      }
      return data;
    });

    // Calculate total revenue from paid invoices
    const invoicesSnapshot = await this.firestore
      .collection('invoices')
      .where('status', '==', 'paid')
      .get();

    let totalRevenue = 0;
    invoicesSnapshot.docs.forEach((doc) => {
      totalRevenue += doc.data().totalAmount || 0;
    });

    return {
      appointmentsCount: totalAppointments,
      totalStockItems,
      lowStockItemsCount: lowStockCount,
      totalRevenue,
      fastMovingMedicines: medicines.slice(0, 3).map((m: any) => m.name),
      timestamp: new Date().toISOString(),
    };
  }
}
