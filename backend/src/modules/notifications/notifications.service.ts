import { Injectable } from '@nestjs/common';
import { FirestoreService } from '../../database/firestore.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import * as admin from 'firebase-admin';

@Injectable()
export class NotificationsService {
  constructor(private firestore: FirestoreService) {}

  async sendPushNotification(dto: CreateNotificationDto) {
    const isMock =
      !process.env.FIREBASE_PRIVATE_KEY ||
      process.env.FIREBASE_PRIVATE_KEY.includes('MOCK_KEY');

    const notificationRef = this.firestore.collection('notifications').doc();
    const notification = {
      id: notificationRef.id,
      userId: dto.userId,
      title: dto.title,
      body: dto.body,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    if (!isMock) {
      try {
        const userDoc = await this.firestore.collection('users').doc(dto.userId).get();
        const fcmToken = userDoc.exists ? userDoc.data()!.fcmToken : null;

        if (fcmToken) {
          await admin.messaging().send({
            token: fcmToken,
            notification: {
              title: dto.title,
              body: dto.body,
            },
          });
          notification.status = 'sent';
        } else {
          console.warn('[NotificationsService] No registered FCM token found for user: [REDACTED]');
          notification.status = 'no_token_registered';
        }
      } catch (err: any) {
        console.error(
          '[NotificationsService] Firebase Cloud Messaging dispatch error:',
          err?.message ? '[REDACTED]' : 'unknown',
        );
        notification.status = 'fcm_failed';
      }
    } else {
      notification.status = 'sent_mock';
    }

    await notificationRef.set(notification);
    return notification;
  }

  async getNotificationsForUser(userId: string) {
    const snapshot = await this.firestore
      .collection('notifications')
      .where('userId', '==', userId)
      .get();
    return snapshot.docs.map((doc) => doc.data());
  }
}
