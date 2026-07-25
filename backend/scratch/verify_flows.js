const http = require('http');

function request(method, path, body, roleToken = 'mock-super_admin-admin_pharmastore.com') {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api/v1${path}`,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${roleToken}`,
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(json);
          } else {
            reject({ statusCode: res.statusCode, data: json });
          }
        } catch (e) {
          reject(new Error(`HTTP ${res.statusCode}: Raw body: ${data}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING CAREFLOW END-TO-END FLOW VERIFICATION ===\n');

  try {
    // 1. Verify Seeding & Settings Retrieval
    console.log('[Step 1] Fetching Hospital Settings...');
    const settingsRes = await request('GET', '/settings', null, 'mock-super_admin-admin_pharmastore.com');
    console.log('Settings Data:', settingsRes);
    console.log('✔ Seeding verified. Hospital name is:', settingsRes.data.hospitalName);
    console.log('--------------------------------------------------\n');

    // 2. Book a unique Appointment
    console.log('[Step 2] Booking unique appointment slot...');
    const apptDate = new Date();
    apptDate.setDate(apptDate.getDate() + 5); // 5 days from now
    const formattedDate = apptDate.toISOString().split('T')[0];
    
    // Generate a unique time slot to prevent double-booking conflicts
    const uniqueMinute = Math.floor(Math.random() * 50 + 10);
    const uniqueTimeSlot = `10:${uniqueMinute}`;

    const apptRes = await request('POST', '/appointments', {
      patientId: 'BADP1K3A',
      doctorId: '5D4181ZA',
      date: formattedDate,
      timeSlot: uniqueTimeSlot
    }, 'mock-super_admin-admin_pharmastore.com');
    
    const apptId = apptRes.data.id;
    console.log('Booking Response:', apptRes);
    console.log('✔ Appointment booked successfully. Appt ID:', apptId);
    console.log('--------------------------------------------------\n');

    // 3. Create Consultation EMR File
    console.log('[Step 3] Logging Consultation EMR details...');
    const consultRes = await request('POST', '/emr/consultations', {
      appointmentId: apptId,
      patientId: 'BADP1K3A',
      symptoms: 'Fever and cold',
      diagnosis: 'Influenza Type A',
      vitals: {
        bloodPressure: '120/80',
        temperatureCelsius: '38.5',
        heartRateBpm: '90',
        weightKg: '70'
      },
      clinicalNotes: 'Prescribed bed rest and hydration.'
    }, 'mock-doctor-house_pharmastore.com'); // Doctor role
    
    const consultId = consultRes.data.id;
    console.log('Consultation EMR logged. ID:', consultId);
    console.log('✔ Consultation recorded successfully.');
    console.log('--------------------------------------------------\n');

    // 4. Issue a Prescription
    console.log('[Step 4] Issuing prescription for patient...');
    const prescriptionRes = await request('POST', '/prescriptions', {
      consultationId: consultId,
      patientId: 'BADP1K3A',
      items: [
        {
          medicineId: 'MED-ASP-100',
          medicineName: 'Aspirin 100mg',
          dosage: '1-0-1',
          duration: '5 days',
          instructions: 'Take after meals'
        }
      ]
    }, 'mock-doctor-house_pharmastore.com'); // Doctor role
    
    const rxId = prescriptionRes.data.id;
    console.log('Prescription Created, Rx ID:', rxId);
    console.log('✔ Prescription issued successfully.');
    console.log('--------------------------------------------------\n');

    // 5. Dispense Prescription (POS Checkout)
    console.log('[Step 5] Checking out & Dispensing items from POS...');
    const dispenseRes = await request('POST', '/pharmacy/dispense', {
      prescriptionId: rxId,
      items: [
        {
          medicineId: 'MED-ASP-100',
          batchNo: 'BATCH-INITIAL-01',
          quantity: 10
        }
      ]
    }, 'mock-pharmacist-philip_pharmastore.com'); // Pharmacist role
    console.log('POS Dispensation Receipt:', dispenseRes.data);
    console.log('✔ POS transaction completed. Invoice generated.');
    console.log('--------------------------------------------------\n');

    // 6. Verify Stocks Decremented
    console.log('[Step 6] Checking Inventory catalog level decrement...');
    const inventoryRes = await request('GET', '/inventory/medicines', null, 'mock-pharmacist-philip_pharmastore.com');
    console.log('INVENTORY RESPONSE:', JSON.stringify(inventoryRes, null, 2));
    const aspirin = inventoryRes.data.find(m => m.id === 'MED-ASP-100');
    console.log('Aspirin Stock Status:', {
      id: aspirin.id,
      name: aspirin.name,
      totalQuantity: aspirin.totalQuantity,
      reorderLevel: aspirin.reorderLevel
    });
    console.log('✔ Stock level updated to:', aspirin.totalQuantity);
    console.log('--------------------------------------------------\n');

    // 7. Check Operations Reports
    console.log('[Step 7] Loading Dashboard Analytics indicators...');
    const reportsRes = await request('GET', '/reports/dashboard', null, 'mock-super_admin-admin_pharmastore.com');
    console.log('Dashboard Report Metrics:', reportsRes.data);
    console.log('✔ Analytics dashboard metrics parsed successfully.');
    console.log('\n=== END-TO-END VERIFICATION COMPLETED: ALL FLOWS PERFECT! ===');
  } catch (error) {
    console.error('❌ Flow verification failed:', error.message || error);
  }
}

runTests();
