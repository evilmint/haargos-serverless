import { TransactWriteItemsCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import axios from 'axios';
import _ from 'lodash';
import { performance } from 'perf_hooks';
import { dynamoDbClient } from '../../lib/dynamodb.js';
import { isLocalDomain } from '../../lib/local-domain.js';
import MetricAnalyzer from '../../lib/metrics/metric-analyzer.js';
import MetricCollector, { InstallationPing } from '../../lib/metrics/metric-collector.js';
import MetricStore from '../../lib/metrics/metric-store.js';
import { fetchUserAlarmConfigurations } from '../../services/alarm-service.js';
import { getAllInstallations } from '../../services/installation-service.js';

type InstallationItem = {
  id?: string;
  userId?: string;
  urls: {
    instance?: { url: string; is_verified: boolean };
  };
  health_statuses: any[];
};

export async function performInstallationHealthCheck() {
  const publicInstallations: InstallationItem[] = ((await getAllInstallations()).Items ?? [])
    .map(item => {
      try {
        return item as InstallationItem;
      } catch {
        console.error(`Failed to decode ${JSON.stringify(item)}`);
        throw new Error(`Failed to decode ${JSON.stringify(item)}`);
      }
    })
    .filter(i => {
      // Filter out private instances or instances without url
      if (!i.urls.instance?.url) {
        return false;
      }

      const url = new URL(i.urls.instance.url);

      // Instance's public address must be verified and must not be a local domain
      return i.urls.instance?.is_verified == true && !isLocalDomain(url);
    });

  const metricCollector = new MetricCollector(
    new MetricStore(
      process.env.TIMESTREAM_METRIC_REGION as string,
      process.env.TIMESTREAM_METRIC_DATABASE as string,
      process.env.TIMESTREAM_METRIC_TABLE as string,
    ),
  );

  const chunks = _.chunk(publicInstallations, 10);

  for (const chunk of chunks) {
    const promises = chunk.map(instance => queryInstanceHealth(instance));
    const results = await Promise.all(promises);

    const transactItems = results.map(({ item: installation, healthy, time }) =>
      buildInstallationHealthStatusesUpdate(
        installation.id ?? '',
        installation.userId ?? '',
        healthy,
        time ?? 0,
        installation.health_statuses,
      ),
    );

    const transactParams = {
      TransactItems: transactItems,
    };

    await dynamoDbClient.send(new TransactWriteItemsCommand(transactParams));

    const installationPings: InstallationPing[] = results
      .filter(i => i.item.id)
      .map(({ item: installation, hasHomeAssistantContent, healthy, startDate, time }) => {
        return {
          hasHomeAssistantContent: hasHomeAssistantContent,
          isHealthy: healthy.value,
          startDate: startDate,
          responseTimeInMilliseconds: time,
          installationId: installation.id!,
          userId: installation.userId,
        };
      });

    try {
      await metricCollector.analyzePingAndStoreMetrics(installationPings);

      // Do only once per user. Make a set of user ids based on the installation pings
      for (const installationPing of installationPings) {
        if (!installationPing.userId) {
          continue;
        }

        const alarmConfigurations = await fetchUserAlarmConfigurations(installationPing.userId);

        const metricAnalyzer = new MetricAnalyzer(
          alarmConfigurations,
          process.env.TIMESTREAM_METRIC_REGION as string,
          process.env.TIMESTREAM_METRIC_DATABASE as string,
          process.env.TIMESTREAM_METRIC_TABLE as string,
        );
        await metricAnalyzer.analyzePingMetricsAndCreateTriggers(installationPings);
      }
    } catch (error) {
      throw new Error('Failed with timestream' + error);
    }
  }
}

type CheckInstanceHealthOutput = {
  item: InstallationItem;
  healthy: { value: boolean; last_updated: string };
  hasHomeAssistantContent: boolean;
  startDate: Date | null;
  time: number;
  error?: any;
};

async function queryInstanceHealth(item: InstallationItem): Promise<CheckInstanceHealthOutput> {
  const instanceUrl = item.urls.instance?.url ?? '';

  if (instanceUrl === '') {
    return {
      item,
      hasHomeAssistantContent: false,
      startDate: null,
      time: 0,
      healthy: { value: false, last_updated: new Date().toISOString() },
      error: null,
    };
  }

  let time = performance.now();
  let startDate = new Date();
  let isHealthy = false;
  let hasHomeAssistantContent: boolean = false;

  try {
    const { data } = await axios.get(instanceUrl, {
      responseType: 'document',
    });
    hasHomeAssistantContent = isHomeAssistantWebsiteContent(data);
    isHealthy = true;
  } catch (error) {
    /* No action needed */
  }

  return {
    item,
    startDate: startDate,
    time: performance.now() - time,
    hasHomeAssistantContent: hasHomeAssistantContent,
    healthy: { value: isHealthy, last_updated: new Date().toISOString() },
    error: null,
  };
}

function isHomeAssistantWebsiteContent(data: string): boolean {
  return (
    data.indexOf('<home-assistant></home-assistant>') !== -1 ||
    data.indexOf('<ha-authorize></ha-authorize>') !== -1
  );
}

const buildInstallationHealthStatusesUpdate = (
  id: string,
  userId: string,
  healthy: { value: boolean; last_updated: string },
  timeTaken: number,
  currentStatuses: any[] = [],
) => {
  const healthStatus = {
    is_up: healthy.value,
    time: timeTaken.toFixed(3).toString(),
    timestamp: healthy.last_updated,
  };

  // Append the new health status to the current list
  currentStatuses.push(healthStatus);

  // Ensure there are only up to 10 records, remove the oldest if necessary
  while (currentStatuses.length > 10) {
    currentStatuses.shift();
  }

  return {
    Update: {
      TableName: process.env.INSTALLATION_TABLE,
      Key: marshall({
        id: id,
        userId: userId,
      }),
      UpdateExpression: 'SET health_statuses = :new_statuses',
      ExpressionAttributeValues: marshall({
        ':new_statuses': currentStatuses,
      }),
    },
  };
};
