import {
  Controller,
  Post,
  Param,
  Headers,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { TelephonyService } from '../services/telephony.service';
import { StructuredLogger } from '../../../infrastructure/observability/structured-logger.service';

@Controller('telephony/webhooks')
export class TelephonyWebhookController {
  private readonly logger = new StructuredLogger('TelephonyWebhookController');

  constructor(private readonly telephonyService: TelephonyService) {}

  @Post(':provider')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Param('provider') provider: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const rawBody = (req as any).rawBody || JSON.stringify(req.body) || '';
    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

    this.logger.log({
      event: 'telephony_webhook_received',
      provider,
      contentType: req.headers['content-type'],
    });

    const result = await this.telephonyService.processProviderEvent(
      provider,
      headers,
      rawBody,
      fullUrl,
    );

    // Return carrier-compatible acknowledgment
    if (provider === 'twilio') {
      res.setHeader('Content-Type', 'text/xml');
      return res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    }

    return res.json({ success: true, eventId: result.eventId });
  }
}
