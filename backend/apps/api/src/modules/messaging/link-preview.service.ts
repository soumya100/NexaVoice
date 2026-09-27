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
   * SSRF Protection: Checks if IP or hostname is internal, private, loopback, or link-local.
   */
  public isPrivateOrInternalIp(ip: string): boolean {
    const normalized = ip.toLowerCase().trim();
    if (
      normalized === '127.0.0.1' ||
      normalized === 'localhost' ||
      normalized === '0.0.0.0' ||
      normalized === '::1' ||
      normalized === '::'
    ) {
      return true;
    }

    // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1)
    if (normalized.startsWith('::ffff:')) {
      return this.isPrivateOrInternalIp(normalized.substring(7));
    }

    // RFC 1918 Class A: 10.0.0.0/8
    if (normalized.startsWith('10.')) return true;

    // RFC 1918 Class C: 192.168.0.0/16
    if (normalized.startsWith('192.168.')) return true;

    // RFC 3927 Link-local / Cloud metadata: 169.254.0.0/16 (169.254.169.254)
    if (normalized.startsWith('169.254.')) return true;

    // RFC 1918 Class B: 172.16.0.0/12
    if (normalized.startsWith('172.')) {
      const parts = normalized.split('.');
      if (parts.length >= 2) {
        const second = parseInt(parts[1], 10);
        if (second >= 16 && second <= 31) return true;
      }
    }

    // RFC 4193 Unique Local IPv6 (fc00::/7) or RFC 4291 Link-Local IPv6 (fe80::/10)
    if (
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb')
    ) {
      return true;
    }

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
