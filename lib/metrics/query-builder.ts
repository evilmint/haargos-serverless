import { QueryCommand } from '@aws-sdk/client-timestream-query';

export class TimestreamQueryBuilder {
  private parts: string[] = [];
  private conditions: string[] = [];
  private order: string | null = null;
  private _limit: string | null = null;

  constructor() {}

  selectFrom(databaseName: string, tableName: string, select: string): this {
    this.parts.push(`SELECT ${select}`);
    this.parts.push(`FROM "${databaseName}"."${tableName}"`);
    return this;
  }

  whereInstallationId(installationId: string): this {
    this.conditions.push(`installation_id = '${installationId}'`);
    return this;
  }

  constrainToAddons(addons: { slug: string }[]): this {
    if (addons.length === 0) {
      return this;
    }
    const joinedSlugs = addons.map(a => a.slug).join("', '");
    this.conditions.push(`addon_slug IN ('${joinedSlugs}')`);

    return this;
  }

  constrainToZigbeeDevices(devices: { ieee: string }[]): this {
    if (devices.length === 0) {
      return this;
    }
    const joinedIEEE = devices.map(d => d.ieee).join("', '");
    this.conditions.push(`ieee IN ('${joinedIEEE}')`);

    return this;
  }

  constrainToScripts(scripts: { unique_id: string }[]): this {
    if (scripts.length === 0) {
      return this;
    }
    const joinedAliases = scripts.map(s => s.unique_id).join("', '");
    this.conditions.push(`id IN ('${joinedAliases}')`);

    return this;
  }

  constrainToScenes(scenes: { id: string }[]): this {
    if (scenes.length === 0) {
      return this;
    }
    const joinedIds = scenes.map(s => s.id).join("', '");
    this.conditions.push(`id IN ('${joinedIds}')`);

    return this;
  }

  constrainToStorages(storages: { name: string }[]): this {
    if (storages.length === 0) {
      return this;
    }
    const joinedNames = storages.map(s => s.name).join("', '");
    this.conditions.push(`name IN ('${joinedNames}')`);

    return this;
  }

  constrainToLogTypesOfConfiguration(configurationId: string): this {
    this.conditions.push(`id = '${configurationId}' AND measure_name LIKE 'logs%'`);

    return this;
  }

  constrainToAutomations(automations: { id: string }[]): this {
    if (automations.length === 0) {
      return this;
    }
    const joinedIds = automations.map(a => a.id).join("', '");
    this.conditions.push(`id IN ('${joinedIds}')`);

    return this;
  }

  whereMetricName(metricName: string): this {
    this.conditions.push(`measure_name = '${metricName}'`);
    return this;
  }

  andCondition(condition: string): this {
    this.conditions.push(condition);
    return this;
  }

  betweenTime(maxMetricAge: string): this {
    this.conditions.push(`time > ago(${maxMetricAge})`);
    return this;
  }

  orderByTimeDesc(): this {
    this.order = 'ORDER BY time DESC';
    return this;
  }

  limit(datapointCount: number): this {
    this._limit = `LIMIT ${datapointCount}`;
    return this;
  }

  build(): QueryCommand {
    if (this.conditions.length > 0) {
      this.parts.push('WHERE ' + this.conditions.join(' AND '));
    }
    const query = this.parts.join(' ') + ` ${this.order ?? ''}` + ` ${this._limit ?? ''}`;

    return new QueryCommand({ QueryString: query });
  }
}
