import { Injectable } from '@nestjs/common';

export interface SendMessageInput {
  hospitalId: string;
  to: string;
  channels: 'sms' | 'whatsapp' | 'both';
  message: string;
  mediaBase64?: string;
  saleId?: string;
}

export interface SendMessageResult {
  provider: string;
  status: 'queued_mock';
  channels: string[];
  to: string;
  hospitalId: string;
  saleId?: string;
}

/** Swap per-hospital config for Twilio / WhatsApp Business later. */
export abstract class MessagingProvider {
  abstract send(input: SendMessageInput): Promise<SendMessageResult>;
}

@Injectable()
export class StubMessagingProvider extends MessagingProvider {
  async send(input: SendMessageInput): Promise<SendMessageResult> {
    const channels =
      input.channels === 'both' ? ['sms', 'whatsapp'] : [input.channels];
    return {
      provider: 'stub',
      status: 'queued_mock',
      channels,
      to: input.to,
      hospitalId: input.hospitalId,
      saleId: input.saleId,
    };
  }
}
