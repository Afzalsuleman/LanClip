// Clipboard monitoring module
import clipboardy from 'clipboardy';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

export class ClipboardMonitor extends EventEmitter {
  private intervalId: NodeJS.Timeout | null = null;
  private lastContent: string = '';
  private pollInterval: number = 500; // 500ms
  private deviceId: string;

  constructor(deviceId: string) {
    super();
    this.deviceId = deviceId;
  }

  start() {
    logger.info('Starting clipboard monitor...');
    this.intervalId = setInterval(() => {
      this.checkClipboard();
    }, this.pollInterval);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Clipboard monitor stopped');
    }
  }

  private async checkClipboard() {
    try {
      const currentContent = await clipboardy.read();

      // Only emit if content changed and is not empty
      if (currentContent !== this.lastContent && currentContent.length > 0) {
        this.lastContent = currentContent;
        this.emit('change', currentContent);
      }
    } catch (error) {
      logger.error('Error reading clipboard:', error);
    }
  }

  async setClipboard(text: string) {
    try {
      // Update lastContent first to prevent triggering own change event
      this.lastContent = text;
      await clipboardy.write(text);
      logger.debug('Clipboard updated successfully');
    } catch (error) {
      logger.error('Error writing to clipboard:', error);
    }
  }
}
