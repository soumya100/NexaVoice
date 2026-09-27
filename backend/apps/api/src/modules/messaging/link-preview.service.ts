import { BadRequestException, Injectable } from '@nestjs/common';
import * as dns from 'dns';
import * as http from 'http';
import * as https from 'https';
import * as url from 'url';
import { StructuredLogger } from '../../infrastructure/observability/structured-logger.service';
import { LinkPreviewResultGql } from './messaging.types';

@Injectable()
export class LinkPreviewService {
  private readonly logger = new StructuredLogger('LinkPreviewService');

  /**
   * SSRF Protection: Checks if IP is internal, private, loopback, or link-local.
   */
  private isPrivateOrInternalIp(ip: string): boolean {
    if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') return true;
    if (ip.startsWith('10.')) return true;
    if (ip.startsWith('192.168.')) return true;
    if (ip.startsWith('169.254.')) return true; // Link-local / AWS metadata 169.254.169.254
    if (ip.startsWith('172.')) {
      const parts = ip.split('.');
      const second = parseInt(parts[1], 10);
      if (second >= 16 && second <= 31) return true;
    }
    if (ip.startsWith('fc') || ip.startsWith('fe80')) return true; // IPv6 local
    return false;
  }

  /**
   * Generates a link preview with SSRF defense.
   */
  async getLinkPreview(targetUrl: string): Promise<LinkPreviewResultGql> {
    let parsed: url.UrlWithStringQuery;
    try {
      parsed = url.parse(targetUrl);
    } catch {
      throw new BadRequestException('Invalid URL format');
    }

    if (!parsed.protocol || !['http:', 'https:'].includes(parsed.protocol)) {
      throw new BadRequestException('Only HTTP/HTTPS URLs are supported');
    }

    const hostname = parsed.hostname;
    if (!hostname) {
      throw new BadRequestException('Missing URL host');
    }

    // SSRF Check: resolve IP before requesting
    return new Promise((resolve) => {
      dns.lookup(hostname, (err, address) => {
        if (err || !address || this.isPrivateOrInternalIp(address)) {
          this.logger.warn({
            event: 'ssrf_blocked',
            url: targetUrl,
            resolvedIp: address,
          });
          return resolve({
            url: targetUrl,
            title: hostname,
          });
        }

        // Fetch headers/initial body safely with size cap (max 64KB)
        const client = parsed.protocol === 'https:' ? https : http;
        const req = client.get(
          targetUrl,
          { timeout: 3000, headers: { 'User-Agent': 'NexaVoiceLinkPreviewBot/1.0' } },
          (res) => {
            let data = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
              data += chunk;
              if (data.length > 65536) {
                req.destroy(); // Cap size
              }
            });
            res.on('end', () => {
              const titleMatch = data.match(/<title[^>]*>([^<]+)<\/title>/i);
              const metaDescMatch = data.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
              const ogImageMatch = data.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);

              resolve({
                url: targetUrl,
                title: titleMatch ? titleMatch[1].trim() : hostname,
                description: metaDescMatch ? metaDescMatch[1].trim() : undefined,
                image: ogImageMatch ? ogImageMatch[1].trim() : undefined,
              });
            });
          },
        );

        req.on('error', () => {
          resolve({ url: targetUrl, title: hostname });
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({ url: targetUrl, title: hostname });
        });
      });
    });
  }
}
