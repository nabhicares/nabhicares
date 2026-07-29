import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { isProductionRuntime, isDemoMode } from '../../../common/config/env.validation';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authorization header is missing or malformed');
    }

    const token = authHeader.split('Bearer ')[1];

    try {
      // Mock tokens when ALLOW_MOCK_AUTH/ALLOW_DEMO_MODE is on (incl. Vercel demo),
      // or local when Firebase key is missing/mock.
      const allowMockAuth =
        isDemoMode() ||
        (!isProductionRuntime() &&
          (!process.env.FIREBASE_PRIVATE_KEY ||
            process.env.FIREBASE_PRIVATE_KEY.includes('MOCK_KEY')));

      const isMockMode = allowMockAuth && token.startsWith('mock-');

      if (isMockMode) {
        const knownRoles = [
          'super_admin',
          'hospital_admin',
          'pharmacist',
          'receptionist',
          'doctor',
          'patient',
        ] as const;
        let role: (typeof knownRoles)[number] = 'patient';
        for (const r of knownRoles) {
          if (token === `mock-${r}` || token.startsWith(`mock-${r}-`)) {
            role = r;
            break;
          }
        }

        request.user = {
          uid: `mock-${role}`,
          email: null,
          role,
          name: `Demo ${role.replace(/_/g, ' ')}`,
        };
        return true;
      }

      const decodedToken = await admin.auth().verifyIdToken(token);
      request.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        role: decodedToken.role || 'patient',
        name: decodedToken.name,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Failed to verify authorization token.');
    }
  }
}
