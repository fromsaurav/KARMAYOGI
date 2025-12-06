import { JobData } from '../../types';
import { logger } from '../../utils/logger';
import { VM } from 'vm2';
import fs from 'fs/promises';

interface CustomScriptPayload {
  scriptType: 'inline' | 'file' | 'function';
  script?: string;
  filePath?: string;
  functionName?: string;
  parameters?: Record<string, any>;
  timeout?: number;
  sandbox?: Record<string, any>;
  allowedModules?: string[];
  resourceLimits?: {
    maxMemory?: number;
    maxExecutionTime?: number;
  };
}

export async function processCustomScriptJob(
  data: JobData,
  updateProgress: (progress: number, message?: string) => Promise<void>
): Promise<any> {
  const payload = data.payload as CustomScriptPayload;
  
  logger.info(`Processing custom script`, {
    jobId: data.id,
    scriptType: payload.scriptType,
    timeout: payload.timeout
  });

  try {
    await updateProgress(10, 'Validating script configuration');
    
    // Validate payload
    await validateScriptPayload(payload);
    
    await updateProgress(30, 'Preparing script execution environment');
    
    // Get script content
    let scriptContent: string;
    switch (payload.scriptType) {
      case 'inline':
        scriptContent = payload.script!;
        break;
      case 'file':
        scriptContent = await loadScriptFromFile(payload.filePath!);
        break;
      case 'function':
        scriptContent = await loadFunctionScript(payload.functionName!);
        break;
      default:
        throw new Error(`Unknown script type: ${payload.scriptType}`);
    }

    await updateProgress(50, 'Executing custom script');
    
    // Execute script in sandboxed environment
    const result = await executeScript(
      scriptContent, 
      payload.parameters,
      payload.sandbox,
      payload.timeout,
      payload.resourceLimits,
      updateProgress
    );

    await updateProgress(90, 'Processing script results');

    const finalResult = {
      scriptType: payload.scriptType,
      executedAt: new Date(),
      executionTime: result.executionTime,
      result: result.output,
      logs: result.logs,
      memoryUsed: result.memoryUsed
    };

    await updateProgress(100, 'Custom script execution completed');
    
    logger.info(`Custom script executed successfully`, {
      jobId: data.id,
      executionTime: result.executionTime,
      memoryUsed: result.memoryUsed
    });

    return finalResult;

  } catch (error) {
    logger.error(`Custom script execution failed:`, error);
    throw error;
  }
}

async function validateScriptPayload(payload: CustomScriptPayload): Promise<void> {
  switch (payload.scriptType) {
    case 'inline':
      if (!payload.script || payload.script.trim().length === 0) {
        throw new Error('Script content is required for inline scripts');
      }
      break;
    case 'file':
      if (!payload.filePath) {
        throw new Error('File path is required for file-based scripts');
      }
      break;
    case 'function':
      if (!payload.functionName) {
        throw new Error('Function name is required for function-based scripts');
      }
      break;
    default:
      throw new Error(`Invalid script type: ${payload.scriptType}`);
  }

  // Validate timeout
  if (payload.timeout && (payload.timeout <= 0 || payload.timeout > 300000)) {
    throw new Error('Timeout must be between 1ms and 5 minutes');
  }

  // Validate resource limits
  if (payload.resourceLimits?.maxMemory && payload.resourceLimits.maxMemory > 512 * 1024 * 1024) {
    throw new Error('Maximum memory limit is 512MB');
  }
}

async function loadScriptFromFile(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    throw new Error(`Failed to load script file: ${(error as Error).message}`);
  }
}

async function loadFunctionScript(functionName: string): Promise<string> {
  // Mock function library
  const functions: Record<string, string> = {
    'calculateSum': `
      function calculateSum(numbers) {
        return numbers.reduce((sum, num) => sum + num, 0);
      }
      return calculateSum(parameters.numbers || []);
    `,
    'processText': `
      function processText(text, operation) {
        switch (operation) {
          case 'uppercase': return text.toUpperCase();
          case 'lowercase': return text.toLowerCase();
          case 'reverse': return text.split('').reverse().join('');
          case 'wordCount': return text.split(/\\s+/).length;
          default: return text;
        }
      }
      return processText(parameters.text || '', parameters.operation || 'uppercase');
    `,
    'generateReport': `
      function generateReport(data) {
        const report = {
          summary: {
            totalItems: data.length,
            generatedAt: new Date().toISOString()
          },
          data: data.map((item, index) => ({ ...item, index }))
        };
        return report;
      }
      return generateReport(parameters.data || []);
    `
  };

  const script = functions[functionName];
  if (!script) {
    throw new Error(`Function '${functionName}' not found in library`);
  }

  return script;
}

async function executeScript(
  scriptContent: string,
  parameters?: Record<string, any>,
  customSandbox?: Record<string, any>,
  timeout?: number,
  resourceLimits?: CustomScriptPayload['resourceLimits'],
  updateProgress?: (progress: number, message?: string) => Promise<void>
): Promise<{ output: any; executionTime: number; logs: string[]; memoryUsed: number }> {
  const logs: string[] = [];
  const startTime = Date.now();
  const startMemory = process.memoryUsage().heapUsed;

  try {
    // Create sandbox environment
    const sandbox = {
      parameters: parameters || {},
      console: {
        log: (...args: any[]) => {
          logs.push(`LOG: ${args.map(arg => String(arg)).join(' ')}`);
        },
        error: (...args: any[]) => {
          logs.push(`ERROR: ${args.map(arg => String(arg)).join(' ')}`);
        },
        warn: (...args: any[]) => {
          logs.push(`WARN: ${args.map(arg => String(arg)).join(' ')}`);
        }
      },
      Math,
      Date,
      JSON,
      setTimeout: (fn: () => void, delay: number) => {
        if (delay > 5000) throw new Error('setTimeout delay cannot exceed 5 seconds');
        return setTimeout(fn, delay);
      },
      ...customSandbox
    };

    await updateProgress?.(60, 'Creating secure execution environment');

    // Create VM with security restrictions
    const vm = new VM({
      timeout: timeout || 30000,
      sandbox,
      allowAsync: true,
      eval: false,
      wasm: false,
      fixAsync: true
    });

    await updateProgress?.(70, 'Running script');

    // Execute the script
    const result = await vm.run(`
      (async function() {
        ${scriptContent}
      })();
    `);

    const executionTime = Date.now() - startTime;
    const endMemory = process.memoryUsage().heapUsed;
    const memoryUsed = endMemory - startMemory;

    await updateProgress?.(85, 'Script execution completed');

    return {
      output: result,
      executionTime,
      logs,
      memoryUsed
    };

  } catch (error) {
    const executionTime = Date.now() - startTime;
    const endMemory = process.memoryUsage().heapUsed;
    const memoryUsed = endMemory - startMemory;

    logs.push(`EXECUTION_ERROR: ${(error as Error).message}`);

    // Return error information
    return {
      output: null,
      executionTime,
      logs,
      memoryUsed
    };
  }
}

// Additional utility functions that can be used in scripts
const scriptUtilities = {
  delay: (ms: number) => new Promise(resolve => setTimeout(resolve, Math.min(ms, 5000))),
  
  formatDate: (date: Date | string) => {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  },
  
  randomId: () => Math.random().toString(36).substr(2, 9),
  
  validateEmail: (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
  
  clamp: (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
};