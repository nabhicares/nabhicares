const http = require('http');

function request(method, path, body, roleToken = 'mock-super_admin') {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api/v1${path}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${roleToken}`,
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(json);
          else reject({ statusCode: res.statusCode, data: json });
        } catch (e) {
          reject(new Error(`HTTP ${res.statusCode}: Raw body: ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const AUTH = 'mock-super_admin';
const HOSPITAL = 'HOSP-DEMO';

async function medQty(medicineId) {
  const res = await request('GET', `/inventory/medicines/${medicineId}`, null, AUTH);
  return res.data.totalQuantity;
}

async function run() {
  console.log('=== SALES / STOCK / CREDIT FLOW VERIFICATION ===\n');

  try {
    console.log('[1] Snapshot stock before sale (MED-CET-10)...');
    const beforeSale = await medQty('MED-CET-10');
    console.log('  qty:', beforeSale);

    console.log('[2] Cash sale → stock deduction...');
    const saleRes = await request(
      'POST',
      '/sales',
      {
        hospitalId: HOSPITAL,
        customer: { name: 'Walk-in Test', phone: '+919899990001' },
        paymentMethod: 'cash',
        items: [{ medicineId: 'MED-CET-10', qty: 2, batchNo: 'BATCH-A' }],
      },
      AUTH,
    );
    const afterSale = await medQty('MED-CET-10');
    if (afterSale !== beforeSale - 2) {
      throw new Error(`Expected qty ${beforeSale - 2}, got ${afterSale}`);
    }
    console.log('✔ Sale', saleRes.data.id, 'stock', beforeSale, '→', afterSale);

    console.log('[3] Purchase receive → stock increase...');
    const beforeRecv = await medQty('MED-ORS-200');
    const poRes = await request(
      'POST',
      '/purchases',
      {
        hospitalId: HOSPITAL,
        supplierId: (await request('GET', '/purchases/suppliers?limit=1', null, AUTH)).data[0]?.id
          || (await request('GET', '/purchases/suppliers?limit=1', null, AUTH)).data?.items?.[0]?.id,
        items: [{ medicineId: 'MED-ORS-200', quantity: 10, unitPrice: 15 }],
      },
      AUTH,
    );
    const poId = poRes.data.id;
    const batchNo = `BATCH-RECV-${Date.now().toString(36)}`;
    const future = new Date();
    future.setFullYear(future.getFullYear() + 2);
    await request(
      'PUT',
      `/purchases/orders/${poId}/receive`,
      {
        items: [
          {
            medicineId: 'MED-ORS-200',
            batchNo,
            expiryDate: future.toISOString().slice(0, 10),
            quantityReceived: 10,
          },
        ],
      },
      AUTH,
    );
    const afterRecv = await medQty('MED-ORS-200');
    if (afterRecv !== beforeRecv + 10) {
      throw new Error(`Expected qty ${beforeRecv + 10}, got ${afterRecv}`);
    }
    console.log('✔ PO', poId, 'received; stock', beforeRecv, '→', afterRecv);

    console.log('[4] Credit sale → creditLedger entry...');
    const doctors = await request('GET', '/doctors', null, AUTH);
    const doctorList = Array.isArray(doctors.data) ? doctors.data : doctors.data.items;
    const doctorId = doctorList[0].id;
    const creditSale = await request(
      'POST',
      '/sales',
      {
        hospitalId: HOSPITAL,
        doctorId,
        customer: { name: 'Credit Customer', phone: '+919899990002' },
        paymentMethod: 'credit',
        items: [{ medicineId: 'MED-CET-10', qty: 1, batchNo: 'BATCH-A' }],
      },
      AUTH,
    );
    if (!creditSale.data.creditLedgerId) {
      throw new Error('creditLedgerId missing on credit sale');
    }
    const credits = await request('GET', `/doctors/${doctorId}/credits?hospitalId=${HOSPITAL}`, null, AUTH);
    const hit = credits.data.entries.find((e) => e.saleId === creditSale.data.id);
    if (!hit) throw new Error('credit ledger entry not found for sale');
    console.log('✔ Credit sale', creditSale.data.id, 'ledger', hit.id, 'amount', hit.amount);

    console.log('[5] Batch lookup...');
    const batch = await request('GET', `/stock/batches/${batchNo}?hospitalId=${HOSPITAL}`, null, AUTH);
    if (batch.data.batchNo !== batchNo) throw new Error('batch lookup failed');
    console.log('✔ Batch lookup OK; remaining', batch.data.quantityRemaining);

    console.log('\n=== SALES/STOCK VERIFICATION COMPLETE ===');
  } catch (err) {
    console.error('❌ Verification failed:', err.message || JSON.stringify(err, null, 2));
    process.exitCode = 1;
  }
}

run();
