export class UpgradeTierError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UpgradeTierError';
    Object.setPrototypeOf(this, UpgradeTierError.prototype);
  }
}
