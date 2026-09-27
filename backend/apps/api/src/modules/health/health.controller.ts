import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  getLiveness(@Res() res: Response) {
    const liveness = this.healthService.isLivenessOk();
    return res.status(HttpStatus.OK).json(liveness);
  }

  @Get('ready')
  async getReadiness(@Res() res: Response) {
    const health = await this.healthService.checkHealth();
    const httpStatus = health.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
    return res.status(httpStatus).json(health);
  }
}
