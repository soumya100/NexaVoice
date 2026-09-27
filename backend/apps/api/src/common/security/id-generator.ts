import { randomInt } from 'node:crypto';

export class IdGenerator {
  /**
   * Generates a canonical, immutable NexaVoice public ID.
   * Format: NV-XXXX-XXXX (e.g. NV-8492-1940)
   */
  static generateNexaVoiceId(): string {
    const part1 = randomInt(1000, 9999).toString();
    const part2 = randomInt(1000, 9999).toString();
    return `NV-${part1}-${part2}`;
  }
}
