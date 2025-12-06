import { JobData } from '../../types';
import { logger } from '../../utils/logger';

interface ApiIntegrationPayload {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retryPolicy?: {
    maxRetries: number;
    backoffMultiplier: number;
    initialDelay: number;
  };
  authentication?: {
    type: 'bearer' | 'basic' | 'api-key';
    token?: string;
    username?: string;
    password?: string;
    apiKey?: string;
    apiKeyHeader?: string;
  };
  validation?: {
    expectedStatus?: number[];
    requiredFields?: string[];
  };
}

export async function processApiIntegrationJob(
  data: JobData,
  updateProgress: (progress: number, message?: string) => Promise<void>
): Promise<any> {
  const payload = data.payload as ApiIntegrationPayload;
  
  logger.info(`Processing API integration`, {
    jobId: data.id,
    method: payload.method,
    url: payload.url
  });

  try {
    await updateProgress(10, 'Preparing API request');
    
    // Prepare request configuration
    const requestConfig = await prepareRequest(payload);
    
    await updateProgress(30, 'Validating request parameters');
    
    // Validate request
    await validateRequest(payload);
    
    await updateProgress(50, 'Executing API request');
    
    // Execute API request with retries
    const response = await executeRequestWithRetry(requestConfig, payload.retryPolicy, updateProgress);
    
    await updateProgress(80, 'Processing response');
    
    // Validate response
    await validateResponse(response, payload.validation);
    
    const result = {
      success: true,
      statusCode: response.status,
      headers: response.headers,
      data: response.data,
      executedAt: new Date(),
      responseTime: response.responseTime,
      url: payload.url,
      method: payload.method
    };

    await updateProgress(100, 'API integration completed');
    
    logger.info(`API integration completed successfully`, {
      jobId: data.id,
      statusCode: response.status,
      responseTime: response.responseTime
    });

    return result;

  } catch (error) {
    logger.error(`API integration failed:`, error);
    throw error;
  }
}

async function prepareRequest(payload: ApiIntegrationPayload): Promise<any> {
  const config: any = {
    method: payload.method,
    url: payload.url,
    headers: payload.headers || {},
    timeout: payload.timeout || 30000
  };

  // Add authentication
  if (payload.authentication) {
    switch (payload.authentication.type) {
      case 'bearer':
        config.headers.Authorization = `Bearer ${payload.authentication.token}`;
        break;
      case 'basic':
        const credentials = Buffer.from(
          `${payload.authentication.username}:${payload.authentication.password}`
        ).toString('base64');
        config.headers.Authorization = `Basic ${credentials}`;
        break;
      case 'api-key':
        const headerName = payload.authentication.apiKeyHeader || 'X-API-Key';
        config.headers[headerName] = payload.authentication.apiKey;
        break;
    }
  }

  // Add body for non-GET requests
  if (payload.body && !['GET', 'DELETE'].includes(payload.method)) {
    config.data = payload.body;
    if (!config.headers['Content-Type']) {
      config.headers['Content-Type'] = 'application/json';
    }
  }

  return config;
}

async function validateRequest(payload: ApiIntegrationPayload): Promise<void> {
  // Validate URL
  try {
    new URL(payload.url);
  } catch {
    throw new Error(`Invalid URL: ${payload.url}`);
  }

  // Validate method
  const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
  if (!validMethods.includes(payload.method)) {
    throw new Error(`Invalid HTTP method: ${payload.method}`);
  }

  // Validate authentication
  if (payload.authentication) {
    const auth = payload.authentication;
    switch (auth.type) {
      case 'bearer':
        if (!auth.token) throw new Error('Bearer token is required');
        break;
      case 'basic':
        if (!auth.username || !auth.password) {
          throw new Error('Username and password are required for basic auth');
        }
        break;
      case 'api-key':
        if (!auth.apiKey) throw new Error('API key is required');
        break;
    }
  }
}

async function executeRequestWithRetry(
  config: any,
  retryPolicy?: ApiIntegrationPayload['retryPolicy'],
  updateProgress?: (progress: number, message?: string) => Promise<void>
): Promise<any> {
  const policy = retryPolicy || {
    maxRetries: 3,
    backoffMultiplier: 2,
    initialDelay: 1000
  };

  let lastError: Error;
  
  for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = policy.initialDelay * Math.pow(policy.backoffMultiplier, attempt - 1);
        await updateProgress?.(50, `Retrying API request (attempt ${attempt + 1}) after ${delay}ms delay`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const startTime = Date.now();
      const response = await executeRequest(config);
      const responseTime = Date.now() - startTime;

      return {
        ...response,
        responseTime,
        attempt: attempt + 1
      };

    } catch (error) {
      lastError = error as Error;
      logger.warn(`API request attempt ${attempt + 1} failed: ${(error as Error).message}`);
      
      if (attempt === policy.maxRetries) {
        throw new Error(`API request failed after ${policy.maxRetries + 1} attempts: ${lastError.message}`);
      }
    }
  }

  throw lastError!;
}

async function executeRequest(config: any): Promise<any> {
  // Simulate HTTP request
  await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));
  
  // Simulate random failures (10% chance)
  if (Math.random() < 0.1) {
    throw new Error('Network timeout');
  }

  // Mock response based on method
  let mockResponse: any = {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'x-request-id': generateRequestId()
    }
  };

  switch (config.method) {
    case 'GET':
      mockResponse.data = {
        id: 1,
        name: 'Sample Data',
        timestamp: new Date().toISOString(),
        items: [
          { id: 1, value: 'item1' },
          { id: 2, value: 'item2' }
        ]
      };
      break;
    
    case 'POST':
      mockResponse.status = 201;
      mockResponse.data = {
        id: Math.floor(Math.random() * 1000),
        ...config.data,
        createdAt: new Date().toISOString()
      };
      break;
    
    case 'PUT':
    case 'PATCH':
      mockResponse.data = {
        id: Math.floor(Math.random() * 1000),
        ...config.data,
        updatedAt: new Date().toISOString()
      };
      break;
    
    case 'DELETE':
      mockResponse.status = 204;
      mockResponse.data = null;
      break;
  }

  return mockResponse;
}

async function validateResponse(response: any, validation?: ApiIntegrationPayload['validation']): Promise<void> {
  if (!validation) return;

  // Check expected status codes
  if (validation.expectedStatus && validation.expectedStatus.length > 0) {
    if (!validation.expectedStatus.includes(response.status)) {
      throw new Error(`Unexpected status code: ${response.status}. Expected one of: ${validation.expectedStatus.join(', ')}`);
    }
  }

  // Check required fields in response
  if (validation.requiredFields && validation.requiredFields.length > 0 && response.data) {
    for (const field of validation.requiredFields) {
      if (!(field in response.data)) {
        throw new Error(`Required field '${field}' missing from response`);
      }
    }
  }
}

function generateRequestId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}