/**
 * Polyfills for React Native / Hermes
 */

if (typeof global.DOMException === 'undefined') {
  (global as any).DOMException = class DOMException extends Error {
    constructor(message: string, name: string) {
      super(message);
      this.name = name || 'Error';
    }
  };
}
