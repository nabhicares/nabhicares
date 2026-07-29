import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';
import { isProductionRuntime, isDemoMode } from '../common/config/env.validation';

// In-Memory Mock Store Classes representing Firestore (local/dev only)
class MockDocumentSnapshot {
  constructor(public id: string, private _data: any) {}
  get exists() {
    return this._data !== undefined;
  }
  data() {
    return this._data ? JSON.parse(JSON.stringify(this._data)) : undefined;
  }
}

class MockQuerySnapshot {
  constructor(public docs: MockDocumentSnapshot[]) {}
  get empty() {
    return this.docs.length === 0;
  }
  get size() {
    return this.docs.length;
  }
}

class MockDocumentReference {
  constructor(public id: string, private path: string, private store: any) {}

  async get() {
    const data = this.store.get(this.path, this.id);
    return new MockDocumentSnapshot(this.id, data);
  }

  async set(data: any) {
    this.store.set(this.path, this.id, data);
  }

  async update(data: any) {
    const existing = this.store.get(this.path, this.id);
    if (!existing) throw new Error(`Document not found for update: ${this.id}`);
    this.store.set(this.path, this.id, { ...existing, ...data });
  }

  collection(subPath: string) {
    return new MockCollectionReference(`${this.path}/${this.id}/${subPath}`, this.store);
  }
}

class MockQuery {
  constructor(protected path: string, protected store: any, protected filters: any[] = []) {}

  where(field: string, op: string, value: any) {
    return new MockQuery(this.path, this.store, [...this.filters, { field, op, value }]);
  }

  async get() {
    let docs = this.store.getCollection(this.path);
    for (const filter of this.filters) {
      docs = docs.filter((doc: any) => {
        const val = doc[filter.field];
        if (filter.op === '==') return val === filter.value;
        if (filter.op === 'in') return Array.isArray(filter.value) && filter.value.includes(val);
        return true;
      });
    }
    return new MockQuerySnapshot(docs.map((d: any) => new MockDocumentSnapshot(d.id || d.uid, d)));
  }
}

class MockCollectionReference extends MockQuery {
  constructor(collPath: string, collStore: any) {
    super(collPath, collStore);
  }

  doc(id?: string) {
    const docId = id || Math.random().toString(36).substring(2, 10).toUpperCase();
    return new MockDocumentReference(docId, this.path, this.store);
  }
}

class MockTransaction {
  constructor(private store: any) {}
  async get(refOrQuery: any) {
    return refOrQuery.get();
  }
  set(ref: any, data: any) {
    ref.set(data);
    return this;
  }
  update(ref: any, data: any) {
    ref.update(data);
    return this;
  }
}

class MockWriteBatch {
  constructor(private store: any) {}
  set(ref: any, data: any) {
    ref.set(data);
    return this;
  }
  update(ref: any, data: any) {
    ref.update(data);
    return this;
  }
  async commit() {
    return [];
  }
}

class InMemoryMockStore {
  private static data: Map<string, Map<string, any>> = new Map();

  get(path: string, id: string) {
    const coll = InMemoryMockStore.data.get(path);
    return coll ? coll.get(id) : undefined;
  }

  set(path: string, id: string, val: any) {
    if (!InMemoryMockStore.data.has(path)) {
      InMemoryMockStore.data.set(path, new Map());
    }
    InMemoryMockStore.data.get(path)!.set(id, val);
  }

  getCollection(path: string) {
    const coll = InMemoryMockStore.data.get(path);
    return coll ? Array.from(coll.values()) : [];
  }
}

@Injectable()
export class FirestoreService implements OnModuleInit {
  private db: any;
  private isMockMode = false;
  private mockStore = new InMemoryMockStore();

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const production = isProductionRuntime();
    const demo = isDemoMode();
    const fs = require('fs');
    const path = require('path');
    const saPath = path.join(process.cwd(), 'firebase-service-account.json');

    const normalizePrivateKey = (raw: string) =>
      raw
        .trim()
        .replace(/^["']|["']$/g, '')
        .replace(/\\n/g, '\n')
        .replace(/\r/g, '');

    const assertPrivateKeyUsable = (privateKey: string) => {
      const crypto = require('crypto');
      try {
        crypto.createPrivateKey(privateKey);
      } catch (err: any) {
        throw new Error(
          'FIREBASE_PRIVATE_KEY is invalid or truncated (OpenSSL cannot decode it). ' +
            'Regenerate a service-account JSON key in Firebase Console → Project settings → Service accounts, ' +
            'then set FIREBASE_PRIVATE_KEY to the full private_key value (with \\n newlines). ' +
            `Detail: ${String(err?.message || 'decode failed').slice(0, 120)}`,
        );
      }
    };

    let saCreds: any = null;
    if (!production && fs.existsSync(saPath)) {
      try {
        saCreds = JSON.parse(fs.readFileSync(saPath, 'utf8'));
      } catch {
        console.warn('[FirestoreService] Failed to parse firebase-service-account.json');
      }
    }

    if (saCreds && saCreds.private_key) {
      saCreds.private_key = normalizePrivateKey(saCreds.private_key);
    }

    if (admin.apps.length === 0) {
      try {
        if (saCreds) {
          admin.initializeApp({
            credential: admin.credential.cert(saCreds),
          });
        } else {
          const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID')?.trim();
          const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL')?.trim();
          let privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');

          if (projectId && clientEmail && privateKey) {
            privateKey = normalizePrivateKey(privateKey);
            assertPrivateKeyUsable(privateKey);
            admin.initializeApp({
              credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey,
              }),
            });
          } else if (production && !demo) {
            throw new Error(
              'Firestore credentials missing. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.',
            );
          } else {
            admin.initializeApp({
              projectId: projectId || 'demo-pharma-store',
            });
          }
        }
      } catch (error: any) {
        if (production && !demo) {
          throw new Error(
            `Firebase Admin SDK failed to initialize: ${error?.message ?? 'unknown error'}`,
          );
        }
        console.warn(
          '[FirestoreService] Firebase SDK init failed; using in-memory mock store.',
          error?.message ? String(error.message).slice(0, 160) : '',
        );
        this.isMockMode = true;
      }
    }

    if (!this.isMockMode) {
      try {
        this.db = admin.firestore();
        try {
          this.db.settings({ ignoreUndefinedProperties: true });
        } catch (settingsErr: any) {
          const msg = String(settingsErr?.message || '');
          if (!/already been initialized|settings\(\) can only be called once/i.test(msg)) {
            throw settingsErr;
          }
        }
        await this.db.collection('settings').doc('systemConfiguration').get();
        this.isMockMode = false;
      } catch (e: any) {
        const detail = e?.message ? String(e.message).slice(0, 300) : 'unknown error';
        if (production && !demo) {
          console.error('[FirestoreService] Firestore connection failed:', detail);
          throw new Error(
            `Unable to reach Firestore over TLS (${detail}). Check FIREBASE_* credentials — mock fallback is disabled in production.`,
          );
        }
        console.warn('[FirestoreService] Firestore unreachable; using in-memory mock store.');
        this.isMockMode = true;
      }
    }

    if (production && this.isMockMode && !demo) {
      throw new Error('In-memory mock Firestore is not allowed in production.');
    }
  }

  collection(path: string): any {
    if (this.isMockMode) {
      return new MockCollectionReference(path, this.mockStore);
    }
    return this.db.collection(path);
  }

  async runTransaction<T>(updateFunction: (transaction: any) => Promise<T>): Promise<T> {
    if (this.isMockMode) {
      const tx = new MockTransaction(this.mockStore);
      return updateFunction(tx);
    }
    return this.db.runTransaction(updateFunction);
  }

  batch(): any {
    if (this.isMockMode) {
      return new MockWriteBatch(this.mockStore);
    }
    return this.db.batch();
  }
}
