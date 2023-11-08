enum Tier {
  Expired = 'Expired',
  Explorer = 'Explorer',
  Navigator = 'Navigator',
  Pro = 'Pro',
  Enterprise = 'Enterprise',
}

class TierResolver {
  private static observationsLimitMap = new Map<Tier, number>([
    [Tier.Expired, 10],
    [Tier.Explorer, 10],
    [Tier.Navigator, 20],
    [Tier.Pro, 40],
    [Tier.Enterprise, 100],
  ]);

  static getObservationsLimit(tier: Tier): number {
    return this.observationsLimitMap.get(tier) || 0;
  }

  static numberOfInstallations(tier: Tier): number {
    switch (tier) {
      case Tier.Explorer:
        return 1;
      case Tier.Navigator:
        return 3;
      case Tier.Pro:
      case Tier.Enterprise:
        return 100; // Safe limit, in case someone needs an extension they should reach out to support
      default:
        return 0;
    }
  }

  static isSupportAvailable(tier: Tier): boolean {
    return tier !== Tier.Explorer;
  }

  static dataHistoryDayCount(tier: Tier): number {
    switch (tier) {
      case Tier.Expired:
        return 1;
      case Tier.Explorer:
        return 1;
      case Tier.Navigator:
        return 3;
      case Tier.Pro:
        return 7;
      case Tier.Enterprise:
        return -1;
      default:
        return 0;
    }
  }

  static frequencyOfDataPointsHours(tier: Tier): number[] {
    switch (tier) {
      case Tier.Expired:
        return [24];
      case Tier.Explorer:
        return [8];
      case Tier.Navigator:
        return [8, 4];
      case Tier.Pro:
        return [8, 4, 1];
      case Tier.Enterprise:
        return []; // Represents 'User-defined', empty array could be a placeholder
      default:
        return [];
    }
  }

  static isInstantHAVersionNotificationAvailable(tier: Tier): boolean {
    return tier === Tier.Enterprise;
  }
}

export { Tier, TierResolver };
