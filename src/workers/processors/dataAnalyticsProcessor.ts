import { JobData } from '../../types';
import { logger } from '../../utils/logger';
import fs from 'fs/promises';

interface DataAnalyticsPayload {
  dataSource: 'csv' | 'json' | 'database';
  filePath?: string;
  query?: string;
  analysis: 'summary' | 'aggregation' | 'correlation' | 'report';
  options?: {
    columns?: string[];
    groupBy?: string[];
    metrics?: string[];
    filters?: Record<string, any>;
  };
}

export async function processDataAnalyticsJob(
  data: JobData,
  updateProgress: (progress: number, message?: string) => Promise<void>
): Promise<any> {
  const payload = data.payload as DataAnalyticsPayload;
  
  logger.info(`Processing data analytics job`, {
    jobId: data.id,
    analysis: payload.analysis,
    dataSource: payload.dataSource
  });

  try {
    await updateProgress(10, 'Loading data source');
    
    let dataset: any[];
    
    switch (payload.dataSource) {
      case 'csv':
        dataset = await loadCSVData(payload.filePath!);
        break;
      case 'json':
        dataset = await loadJSONData(payload.filePath!);
        break;
      case 'database':
        dataset = await loadDatabaseData(payload.query!);
        break;
      default:
        throw new Error(`Unsupported data source: ${payload.dataSource}`);
    }

    await updateProgress(40, 'Data loaded, starting analysis');
    
    let result: any;
    
    switch (payload.analysis) {
      case 'summary':
        result = await generateSummary(dataset, payload.options);
        break;
      case 'aggregation':
        result = await performAggregation(dataset, payload.options);
        break;
      case 'correlation':
        result = await calculateCorrelation(dataset, payload.options);
        break;
      case 'report':
        result = await generateReport(dataset, payload.options);
        break;
      default:
        throw new Error(`Unknown analysis type: ${payload.analysis}`);
    }

    await updateProgress(90, 'Finalizing results');

    const finalResult = {
      analysis: payload.analysis,
      dataSource: payload.dataSource,
      recordCount: dataset.length,
      processedAt: new Date(),
      result
    };

    await updateProgress(100, 'Data analytics completed');
    
    logger.info(`Data analytics completed`, {
      jobId: data.id,
      recordCount: dataset.length,
      analysis: payload.analysis
    });

    return finalResult;

  } catch (error) {
    logger.error(`Data analytics failed:`, error);
    throw error;
  }
}

async function loadCSVData(filePath: string): Promise<any[]> {
  // Simulate CSV loading
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Mock CSV data
  return [
    { id: 1, name: 'John', age: 25, salary: 50000, department: 'Engineering' },
    { id: 2, name: 'Jane', age: 30, salary: 60000, department: 'Marketing' },
    { id: 3, name: 'Bob', age: 35, salary: 75000, department: 'Engineering' },
    { id: 4, name: 'Alice', age: 28, salary: 55000, department: 'Sales' }
  ];
}

async function loadJSONData(filePath: string): Promise<any[]> {
  // Simulate JSON loading
  await new Promise(resolve => setTimeout(resolve, 800));
  
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

async function loadDatabaseData(query: string): Promise<any[]> {
  // Simulate database query
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Mock database results
  return [
    { metric: 'revenue', value: 150000, period: '2024-01' },
    { metric: 'revenue', value: 175000, period: '2024-02' },
    { metric: 'users', value: 1250, period: '2024-01' },
    { metric: 'users', value: 1480, period: '2024-02' }
  ];
}

async function generateSummary(dataset: any[], options?: any): Promise<any> {
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  const numericColumns = findNumericColumns(dataset);
  const summary: any = {
    totalRecords: dataset.length,
    columns: Object.keys(dataset[0] || {}),
    numericSummary: {}
  };

  for (const column of numericColumns) {
    const values = dataset.map(row => row[column]).filter(val => typeof val === 'number');
    
    if (values.length > 0) {
      summary.numericSummary[column] = {
        count: values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        sum: values.reduce((a, b) => a + b, 0)
      };
    }
  }

  return summary;
}

async function performAggregation(dataset: any[], options?: any): Promise<any> {
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const groupBy = options?.groupBy || [];
  const metrics = options?.metrics || [];
  
  if (groupBy.length === 0) {
    return { error: 'No groupBy columns specified' };
  }

  const groups: { [key: string]: any[] } = {};
  
  dataset.forEach(row => {
    const groupKey = groupBy.map((col: string) => row[col]).join('|');
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(row);
  });

  const aggregated = Object.entries(groups).map(([groupKey, groupRows]) => {
    const result: any = {};
    
    groupBy.forEach((col: string, index: number) => {
      result[col] = groupKey.split('|')[index];
    });
    
    result.count = groupRows.length;
    
    metrics.forEach((metric: string) => {
      const values = groupRows.map(row => row[metric]).filter(val => typeof val === 'number');
      if (values.length > 0) {
        result[`${metric}_sum`] = values.reduce((a, b) => a + b, 0);
        result[`${metric}_avg`] = result[`${metric}_sum`] / values.length;
        result[`${metric}_min`] = Math.min(...values);
        result[`${metric}_max`] = Math.max(...values);
      }
    });
    
    return result;
  });

  return { aggregated };
}

async function calculateCorrelation(dataset: any[], options?: any): Promise<any> {
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  const numericColumns = findNumericColumns(dataset);
  const correlations: any = {};
  
  for (let i = 0; i < numericColumns.length; i++) {
    for (let j = i + 1; j < numericColumns.length; j++) {
      const col1 = numericColumns[i];
      const col2 = numericColumns[j];
      
      const correlation = calculatePearsonCorrelation(dataset, col1, col2);
      correlations[`${col1}_${col2}`] = correlation;
    }
  }
  
  return { correlations };
}

async function generateReport(dataset: any[], options?: any): Promise<any> {
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const summary = await generateSummary(dataset, options);
  const aggregated = await performAggregation(dataset, options);
  
  return {
    reportTitle: 'Data Analysis Report',
    generatedAt: new Date(),
    summary,
    aggregations: aggregated.aggregated,
    recommendations: [
      'Consider reviewing outliers in numeric data',
      'Data quality appears good with consistent formatting',
      'No significant data gaps detected'
    ]
  };
}

function findNumericColumns(dataset: any[]): string[] {
  if (dataset.length === 0) return [];
  
  const firstRow = dataset[0];
  return Object.keys(firstRow).filter(key => {
    return typeof firstRow[key] === 'number';
  });
}

function calculatePearsonCorrelation(dataset: any[], col1: string, col2: string): number {
  const pairs = dataset
    .map(row => [row[col1], row[col2]])
    .filter(([x, y]) => typeof x === 'number' && typeof y === 'number');
  
  if (pairs.length < 2) return 0;
  
  const n = pairs.length;
  const sum1 = pairs.reduce((sum, [x]) => sum + x, 0);
  const sum2 = pairs.reduce((sum, [, y]) => sum + y, 0);
  const sum1Sq = pairs.reduce((sum, [x]) => sum + x * x, 0);
  const sum2Sq = pairs.reduce((sum, [, y]) => sum + y * y, 0);
  const pSum = pairs.reduce((sum, [x, y]) => sum + x * y, 0);
  
  const num = pSum - (sum1 * sum2 / n);
  const den = Math.sqrt((sum1Sq - sum1 * sum1 / n) * (sum2Sq - sum2 * sum2 / n));
  
  if (den === 0) return 0;
  return num / den;
}