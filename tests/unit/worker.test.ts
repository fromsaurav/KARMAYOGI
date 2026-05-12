// Tests for data analytics processor computation logic
// Exercises real functions: summary aggregation, groupBy aggregation, Pearson correlation
// Uses fake timers to bypass internal setTimeout delays without running real external services

jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import { processDataAnalyticsJob } from '../../src/workers/processors/dataAnalyticsProcessor';
import { JobData } from '../../src/types';

// The CSV mock dataset hardcoded inside dataAnalyticsProcessor.ts:
// { id:1, name:'John',  age:25, salary:50000, department:'Engineering' }
// { id:2, name:'Jane',  age:30, salary:60000, department:'Marketing'   }
// { id:3, name:'Bob',   age:35, salary:75000, department:'Engineering' }
// { id:4, name:'Alice', age:28, salary:55000, department:'Sales'       }

const baseJob: JobData = {
  id: 'job-analytics-1',
  jobId: 'job-analytics-1',
  userId: 'user-1',
  type: 'DATA_ANALYTICS' as any,
  payload: {},
  priority: 'MEDIUM' as any,
  maxRetries: 3,
  currentRetry: 0,
};

const mockProgress = jest.fn().mockResolvedValue(undefined);

describe('Data analytics processor — summary analysis', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('computes correct min salary across the mock CSV dataset', async () => {
    const job = { ...baseJob, payload: { dataSource: 'csv', analysis: 'summary' } };
    const promise = processDataAnalyticsJob(job, mockProgress);
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result.result.numericSummary.salary.min).toBe(50000);
  });

  it('computes correct max salary across the mock CSV dataset', async () => {
    const job = { ...baseJob, payload: { dataSource: 'csv', analysis: 'summary' } };
    const promise = processDataAnalyticsJob(job, mockProgress);
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result.result.numericSummary.salary.max).toBe(75000);
  });

  it('computes correct average salary across the mock CSV dataset', async () => {
    const job = { ...baseJob, payload: { dataSource: 'csv', analysis: 'summary' } };
    const promise = processDataAnalyticsJob(job, mockProgress);
    await jest.runAllTimersAsync();
    const result = await promise;

    // (50000 + 60000 + 75000 + 55000) / 4 = 60000
    expect(result.result.numericSummary.salary.avg).toBe(60000);
  });

  it('reports the correct total record count for CSV data', async () => {
    const job = { ...baseJob, payload: { dataSource: 'csv', analysis: 'summary' } };
    const promise = processDataAnalyticsJob(job, mockProgress);
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result.recordCount).toBe(4);
    expect(result.result.totalRecords).toBe(4);
  });
});

describe('Data analytics processor — aggregation analysis', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('groups rows by department and calculates salary average per group', async () => {
    const job = {
      ...baseJob,
      payload: {
        dataSource: 'csv',
        analysis: 'aggregation',
        options: { groupBy: ['department'], metrics: ['salary'] },
      },
    };
    const promise = processDataAnalyticsJob(job, mockProgress);
    await jest.runAllTimersAsync();
    const result = await promise;

    const groups: any[] = result.result.aggregated;
    const engineering = groups.find((g: any) => g.department === 'Engineering');
    // Engineering: John (50000) + Bob (75000), avg = 62500
    expect(engineering).toBeDefined();
    expect(engineering.salary_avg).toBe(62500);
  });

  it('counts correct row count per group', async () => {
    const job = {
      ...baseJob,
      payload: {
        dataSource: 'csv',
        analysis: 'aggregation',
        options: { groupBy: ['department'], metrics: ['salary'] },
      },
    };
    const promise = processDataAnalyticsJob(job, mockProgress);
    await jest.runAllTimersAsync();
    const result = await promise;

    const groups: any[] = result.result.aggregated;
    const engineering = groups.find((g: any) => g.department === 'Engineering');
    const marketing = groups.find((g: any) => g.department === 'Marketing');
    expect(engineering.count).toBe(2);
    expect(marketing.count).toBe(1);
  });
});

describe('Data analytics processor — correlation analysis', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns a positive Pearson correlation between age and salary', async () => {
    const job = { ...baseJob, payload: { dataSource: 'csv', analysis: 'correlation' } };
    const promise = processDataAnalyticsJob(job, mockProgress);
    await jest.runAllTimersAsync();
    const result = await promise;

    // age and salary both increase together in the mock data → positive correlation
    expect(result.result.correlations.age_salary).toBeGreaterThan(0);
  });

  it('returns a correlation coefficient within the valid [-1, 1] range', async () => {
    const job = { ...baseJob, payload: { dataSource: 'csv', analysis: 'correlation' } };
    const promise = processDataAnalyticsJob(job, mockProgress);
    await jest.runAllTimersAsync();
    const result = await promise;

    const correlation = result.result.correlations.age_salary;
    expect(correlation).toBeGreaterThanOrEqual(-1);
    expect(correlation).toBeLessThanOrEqual(1);
  });
});

describe('Data analytics processor — error handling', () => {
  // Attach rejection handler before advancing timers to avoid unhandled rejection warnings.
  // processDataAnalyticsJob rejects early (before timers fire in the error path), so we
  // must ensure the .catch chain is registered on the promise before runAllTimersAsync runs.

  it('throws for an unsupported data source type', async () => {
    jest.useFakeTimers();
    const job = { ...baseJob, payload: { dataSource: 'xml', analysis: 'summary' } };
    const promise = processDataAnalyticsJob(job, mockProgress);
    const rejectCheck = expect(promise).rejects.toThrow('Unsupported data source: xml');
    await jest.runAllTimersAsync();
    await rejectCheck;
    jest.useRealTimers();
  });

  it('throws for an unknown analysis type', async () => {
    jest.useFakeTimers();
    const job = { ...baseJob, payload: { dataSource: 'csv', analysis: 'histogram' } };
    const promise = processDataAnalyticsJob(job, mockProgress);
    const rejectCheck = expect(promise).rejects.toThrow('Unknown analysis type: histogram');
    await jest.runAllTimersAsync();
    await rejectCheck;
    jest.useRealTimers();
  });
});
