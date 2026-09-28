import { Injectable } from '@nestjs/common';

export interface NormalizedPhoneNumber {
  e164: string;
  display: string;
  countryCode: string;
  callingCode: string;
  nationalNumber: string;
  isValid: boolean;
  isEmergency: boolean;
  isTollFree: boolean;
  isHighRiskPremium: boolean;
}

// Comprehensive country calling code map for ITU-T E.164
const CALLING_CODE_TO_COUNTRY: Record<string, { country: string; minLen: number; maxLen: number }> = {
  '1': { country: 'US', minLen: 10, maxLen: 10 },
  '44': { country: 'GB', minLen: 9, maxLen: 10 },
  '91': { country: 'IN', minLen: 10, maxLen: 10 },
  '61': { country: 'AU', minLen: 9, maxLen: 9 },
  '49': { country: 'DE', minLen: 10, maxLen: 11 },
  '33': { country: 'FR', minLen: 9, maxLen: 9 },
  '81': { country: 'JP', minLen: 10, maxLen: 10 },
  '86': { country: 'CN', minLen: 11, maxLen: 11 },
  '41': { country: 'CH', minLen: 9, maxLen: 9 },
  '34': { country: 'ES', minLen: 9, maxLen: 9 },
  '39': { country: 'IT', minLen: 9, maxLen: 10 },
  '31': { country: 'NL', minLen: 9, maxLen: 9 },
  '46': { country: 'SE', minLen: 7, maxLen: 9 },
  '47': { country: 'NO', minLen: 8, maxLen: 8 },
  '45': { country: 'DK', minLen: 8, maxLen: 8 },
  '358': { country: 'FI', minLen: 5, maxLen: 10 },
  '351': { country: 'PT', minLen: 9, maxLen: 9 },
  '353': { country: 'IE', minLen: 9, maxLen: 9 },
  '64': { country: 'NZ', minLen: 8, maxLen: 9 },
  '65': { country: 'SG', minLen: 8, maxLen: 8 },
  '852': { country: 'HK', minLen: 8, maxLen: 8 },
  '971': { country: 'AE', minLen: 9, maxLen: 9 },
  '966': { country: 'SA', minLen: 9, maxLen: 9 },
  '55': { country: 'BR', minLen: 10, maxLen: 11 },
  '52': { country: 'MX', minLen: 10, maxLen: 10 },
  '870': { country: 'SATELLITE', minLen: 9, maxLen: 12 },
  '881': { country: 'SATELLITE', minLen: 9, maxLen: 12 },
  '882': { country: 'INTERNATIONAL_NETWORKS', minLen: 7, maxLen: 12 },
  '883': { country: 'INTERNATIONAL_NETWORKS', minLen: 7, maxLen: 12 },
};

const EMERGENCY_NUMBERS = new Set(['911', '112', '999', '000', '100', '101', '102', '108']);

@Injectable()
export class PhoneNumberNormalizerService {
  /**
   * Normalizes an arbitrary raw phone string into canonical E.164 and human-friendly display representations.
   */
  normalize(rawInput: string, defaultCountry = 'US'): NormalizedPhoneNumber {
    if (!rawInput || typeof rawInput !== 'string') {
      return this.createInvalidResult(rawInput || '');
    }

    const trimmed = rawInput.trim();

    // Check emergency numbers first
    const sanitizedDigits = trimmed.replace(/\D/g, '');
    if (EMERGENCY_NUMBERS.has(sanitizedDigits)) {
      return {
        e164: sanitizedDigits,
        display: `Emergency (${sanitizedDigits})`,
        countryCode: defaultCountry,
        callingCode: '',
        nationalNumber: sanitizedDigits,
        isValid: true,
        isEmergency: true,
        isTollFree: false,
        isHighRiskPremium: false,
      };
    }

    let digitsOnly = sanitizedDigits;
    let callingCode = '';
    let countryCode = defaultCountry;

    if (trimmed.startsWith('+')) {
      // Find matching international calling code (check 3, 2, then 1 digit prefixes)
      for (const prefixLen of [3, 2, 1]) {
        const potentialPrefix = digitsOnly.slice(0, prefixLen);
        if (CALLING_CODE_TO_COUNTRY[potentialPrefix]) {
          callingCode = potentialPrefix;
          countryCode = CALLING_CODE_TO_COUNTRY[potentialPrefix].country;
          break;
        }
      }

      if (!callingCode) {
        // Unknown or custom country code; accept as international if between 7 and 15 digits
        if (digitsOnly.length >= 7 && digitsOnly.length <= 15) {
          return {
            e164: `+${digitsOnly}`,
            display: `+${digitsOnly}`,
            countryCode: 'UNKNOWN',
            callingCode: digitsOnly.slice(0, 3),
            nationalNumber: digitsOnly.slice(3),
            isValid: true,
            isEmergency: false,
            isTollFree: false,
            isHighRiskPremium: false,
          };
        }
        return this.createInvalidResult(rawInput);
      }
    } else {
      // No '+' prefix, assume default country
      if (defaultCountry === 'US' || defaultCountry === 'CA') {
        callingCode = '1';
        countryCode = defaultCountry;
        if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
          // Already has leading 1
        } else if (digitsOnly.length === 10) {
          digitsOnly = `1${digitsOnly}`;
        }
      } else if (defaultCountry === 'GB' && digitsOnly.startsWith('0')) {
        callingCode = '44';
        countryCode = 'GB';
        digitsOnly = `44${digitsOnly.slice(1)}`;
      } else if (defaultCountry === 'IN' && digitsOnly.length === 10) {
        callingCode = '91';
        countryCode = 'IN';
        digitsOnly = `91${digitsOnly}`;
      } else {
        return this.createInvalidResult(rawInput);
      }
    }

    const nationalNumber = digitsOnly.slice(callingCode.length);
    const countryRules = CALLING_CODE_TO_COUNTRY[callingCode];

    const isValidLength =
      countryRules &&
      nationalNumber.length >= countryRules.minLen &&
      nationalNumber.length <= countryRules.maxLen;

    const e164 = `+${digitsOnly}`;
    const display = this.formatDisplay(callingCode, nationalNumber);

    const isTollFree = this.checkTollFree(callingCode, nationalNumber);
    const isHighRiskPremium = this.checkHighRiskPremium(callingCode, nationalNumber);

    return {
      e164,
      display,
      countryCode,
      callingCode,
      nationalNumber,
      isValid: Boolean(isValidLength),
      isEmergency: false,
      isTollFree,
      isHighRiskPremium,
    };
  }

  /**
   * Formats numbers into human-readable representation according to country standards.
   */
  formatDisplay(callingCode: string, national: string): string {
    if (callingCode === '1' && national.length === 10) {
      // US/CA: +1 (NPA) NXX-XXXX
      return `+1 (${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
    }
    if (callingCode === '44' && national.length === 10) {
      // UK: +44 XXXX XXXXXX
      return `+44 ${national.slice(0, 4)} ${national.slice(4)}`;
    }
    if (callingCode === '91' && national.length === 10) {
      // India: +91 XXXXX XXXXX
      return `+91 ${national.slice(0, 5)} ${national.slice(5)}`;
    }
    return `+${callingCode} ${national}`;
  }

  private checkTollFree(callingCode: string, national: string): boolean {
    if (callingCode === '1') {
      const npa = national.slice(0, 3);
      return ['800', '888', '877', '866', '855', '844', '833'].includes(npa);
    }
    if (callingCode === '44') {
      return national.startsWith('800') || national.startsWith('808');
    }
    if (callingCode === '91') {
      return national.startsWith('1800');
    }
    return false;
  }

  private checkHighRiskPremium(callingCode: string, national: string): boolean {
    // US 900 premium
    if (callingCode === '1' && national.startsWith('900')) return true;
    // UK 090 premium
    if (callingCode === '44' && national.startsWith('9')) return true;
    // Satellite codes (+870 Inmarsat, +881 Iridium, +882/883 International Networks)
    if (['870', '881', '882', '883'].includes(callingCode)) return true;
    return false;
  }

  private createInvalidResult(rawInput: string): NormalizedPhoneNumber {
    return {
      e164: rawInput,
      display: rawInput,
      countryCode: 'UNKNOWN',
      callingCode: '',
      nationalNumber: rawInput,
      isValid: false,
      isEmergency: false,
      isTollFree: false,
      isHighRiskPremium: false,
    };
  }
}
