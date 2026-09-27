import { Test, TestingModule } from '@nestjs/testing';
import * as dns from 'dns';
import { BadRequestException } from '@nestjs/common';
import { LinkPreviewService } from './link-preview.service';

jest.mock('dns');

describe('LinkPreviewService - SSRF Defense Matrix', () => {
  let service: LinkPreviewService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LinkPreviewService],
    }).compile();

    service = module.get<LinkPreviewService>(LinkPreviewService);
    jest.clearAllMocks();
  });

  describe('isPrivateOrInternalIp unit evaluations', () => {
    const testCases: [string, boolean][] = [
      ['127.0.0.1', true],
      ['localhost', true],
      ['0.0.0.0', true],
      ['10.0.0.1', true],
      ['10.255.255.255', true],
      ['192.168.1.1', true],
      ['192.168.0.254', true],
      ['172.16.0.1', true],
      ['172.24.10.5', true],
      ['172.31.255.255', true],
      ['169.254.169.254', true], // AWS / Cloud metadata
      ['169.254.1.1', true],
      ['::1', true],
      ['fe80::1', true],
      ['fc00::1', true],
      ['fd12:3456:789a::1', true],
      ['::ffff:127.0.0.1', true],
      ['::ffff:192.168.1.1', true],
      ['8.8.8.8', false],
      ['1.1.1.1', false],
      ['142.250.190.46', false], // Google IP
      ['172.15.255.255', false], // Below 172.16
      ['172.32.0.1', false], // Above 172.31
    ];

    testCases.forEach(([ip, expected]) => {
      it(`should identify ${ip} as private/internal: ${expected}`, () => {
        expect(service.isPrivateOrInternalIp(ip)).toBe(expected);
      });
    });
  });

  describe('getLinkPreview SSRF Protection', () => {
    it('1. should block request to 127.0.0.1 loopback', async () => {
      (dns.lookup as unknown as jest.Mock).mockImplementation((_host, cb) => {
        cb(null, '127.0.0.1');
      });

      const res = await service.getLinkPreview('http://127.0.0.1/admin');
      // Should not make network request to internal address, should return safe fallback
      expect(res.url).toBe('http://127.0.0.1/admin');
      expect(res.description).toBeUndefined();
    });

    it('2. should block cloud metadata endpoint 169.254.169.254', async () => {
      (dns.lookup as unknown as jest.Mock).mockImplementation((_host, cb) => {
        cb(null, '169.254.169.254');
      });

      const res = await service.getLinkPreview('http://169.254.169.254/latest/meta-data/');
      expect(res.url).toBe('http://169.254.169.254/latest/meta-data/');
      expect(res.description).toBeUndefined();
    });

    it('3. should block DNS resolving to internal 10.0.0.1 network', async () => {
      (dns.lookup as unknown as jest.Mock).mockImplementation((_host, cb) => {
        cb(null, '10.0.0.1');
      });

      const res = await service.getLinkPreview('https://internal.corp.local/dashboard');
      expect(res.url).toBe('https://internal.corp.local/dashboard');
      expect(res.description).toBeUndefined();
    });

    it('4. should reject unsupported schemes such as file:// and ftp://', async () => {
      await expect(service.getLinkPreview('file:///etc/passwd')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getLinkPreview('ftp://private-ftp.local')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('5. should reject malformed or missing hostname URLs', async () => {
      await expect(service.getLinkPreview('http://')).rejects.toThrow(BadRequestException);
    });
  });
});
