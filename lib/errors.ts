export class UpgradeTierError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UpgradeTierError';
    Object.setPrototypeOf(this, UpgradeTierError.prototype);
  }
}

export class FailedToSubmitObservationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FailedToSubmitObservationError';
    Object.setPrototypeOf(this, FailedToSubmitObservationError.prototype);
  }
}

export class InstallationLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InstallationLimitError';
    Object.setPrototypeOf(this, InstallationLimitError.prototype);
  }
}
