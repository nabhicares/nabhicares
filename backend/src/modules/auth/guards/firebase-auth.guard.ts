import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as admin from 'firebase-admin';

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
      const isMockAllowed = process.env.NODE_ENV !== 'production' && (
        !process.env.FIREBASE_PRIVATE_KEY || 
        process.env.FIREBASE_PRIVATE_KEY.includes('MOCK_KEY')
      );

      const isMockMode = isMockAllowed && token.startsWith('mock-');
      
      if (isMockMode) {
        // Parse custom mock roles directly from token for developer testing
        let role = 'patient';
        if (token.includes('doctor')) role = 'doctor';
        else if (token.includes('admin')) role = 'hospital_admin';
        else if (token.includes('pharmacist')) role = 'pharmacist';
        else if (token.includes('receptionist')) role = 'receptionist';

        request.user = {
          uid: token,
          email: `${token}@example.com`,
          role: role,
          name: `Mock ${role.replace('_', ' ').toUpperCase()}`,
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
    } catch (error) {
      throw new UnauthorizedException(`Failed to verify authorization token: ${error.message}`);
    }
  }
}
