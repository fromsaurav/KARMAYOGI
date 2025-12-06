import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { logger } from '../utils/logger';

const PROTO_PATH = path.join(__dirname, '../../go-services/shared/proto/executor.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const executorProto = grpc.loadPackageDefinition(packageDefinition).executor as any;

const EXECUTOR_SERVICE_URL = process.env.EXECUTOR_SERVICE_URL || 'localhost:50052';

class ExecutorClient {
  private client: any;

  constructor() {
    this.client = new executorProto.ExecutorService(
      EXECUTOR_SERVICE_URL,
      grpc.credentials.createInsecure()
    );
    logger.info(`gRPC Executor Client connected to ${EXECUTOR_SERVICE_URL}`);
  }

  /**
   * Process file job
   */
  async processFile(request: {
    jobId: string;
    filePath: string;
    fileType: string;
    operation: string;
    config?: string;
  }): Promise<any> {
    return new Promise((resolve, reject) => {
      const grpcRequest = {
        job_id: request.jobId,
        file_path: request.filePath,
        file_type: request.fileType,
        operation: request.operation,
        config: request.config || '',
      };

      this.client.ProcessFile(grpcRequest, (error: any, response: any) => {
        if (error) {
          logger.error('gRPC ProcessFile error:', error);
          reject(error);
        } else {
          resolve({
            jobId: response.job_id,
            success: response.success,
            outputPath: response.output_path,
            recordsProcessed: response.records_processed,
            error: response.error,
            stats: response.stats || {},
          });
        }
      });
    });
  }

  /**
   * Analyze data
   */
  async analyzeData(request: {
    jobId: string;
    dataSource: string;
    query: string;
    aggregations?: string[];
    filters?: Record<string, string>;
  }): Promise<any> {
    return new Promise((resolve, reject) => {
      const grpcRequest = {
        job_id: request.jobId,
        data_source: request.dataSource,
        query: request.query,
        aggregations: request.aggregations || [],
        filters: request.filters || {},
      };

      this.client.AnalyzeData(grpcRequest, (error: any, response: any) => {
        if (error) {
          logger.error('gRPC AnalyzeData error:', error);
          reject(error);
        } else {
          resolve({
            jobId: response.job_id,
            success: response.success,
            results: response.results ? JSON.parse(response.results) : null,
            rowsAnalyzed: response.rows_analyzed,
            error: response.error,
          });
        }
      });
    });
  }

  /**
   * Send email
   */
  async sendEmail(request: {
    jobId: string;
    recipients: string[];
    subject: string;
    body: string;
    htmlBody?: string;
    attachments?: string[];
    fromAddress?: string;
  }): Promise<any> {
    return new Promise((resolve, reject) => {
      const grpcRequest = {
        job_id: request.jobId,
        recipients: request.recipients,
        subject: request.subject,
        body: request.body,
        html_body: request.htmlBody || '',
        attachments: request.attachments || [],
        from_address: request.fromAddress || 'noreply@karmayogi.com',
      };

      this.client.SendEmail(grpcRequest, (error: any, response: any) => {
        if (error) {
          logger.error('gRPC SendEmail error:', error);
          reject(error);
        } else {
          resolve({
            jobId: response.job_id,
            success: response.success,
            emailsSent: response.emails_sent,
            emailsFailed: response.emails_failed,
            error: response.error,
            failedRecipients: response.failed_recipients || [],
          });
        }
      });
    });
  }

  /**
   * Call external API
   */
  async callAPI(request: {
    jobId: string;
    url: string;
    method: string;
    headers?: Record<string, string>;
    body?: string;
    timeout?: number;
    retries?: number;
  }): Promise<any> {
    return new Promise((resolve, reject) => {
      const grpcRequest = {
        job_id: request.jobId,
        url: request.url,
        method: request.method,
        headers: request.headers || {},
        body: request.body || '',
        timeout: request.timeout || 30,
        retries: request.retries || 3,
      };

      this.client.CallAPI(grpcRequest, (error: any, response: any) => {
        if (error) {
          logger.error('gRPC CallAPI error:', error);
          reject(error);
        } else {
          resolve({
            jobId: response.job_id,
            success: response.success,
            statusCode: response.status_code,
            responseBody: response.response_body,
            responseHeaders: response.response_headers || {},
            error: response.error,
            durationMs: response.duration_ms,
          });
        }
      });
    });
  }

  /**
   * Run custom script
   */
  async runScript(request: {
    jobId: string;
    scriptType: string;
    scriptContent: string;
    args?: string[];
    env?: Record<string, string>;
    timeout?: number;
  }): Promise<any> {
    return new Promise((resolve, reject) => {
      const grpcRequest = {
        job_id: request.jobId,
        script_type: request.scriptType,
        script_content: request.scriptContent,
        args: request.args || [],
        env: request.env || {},
        timeout: request.timeout || 300,
      };

      this.client.RunScript(grpcRequest, (error: any, response: any) => {
        if (error) {
          logger.error('gRPC RunScript error:', error);
          reject(error);
        } else {
          resolve({
            jobId: response.job_id,
            success: response.success,
            stdout: response.stdout,
            stderr: response.stderr,
            exitCode: response.exit_code,
            error: response.error,
          });
        }
      });
    });
  }

  close() {
    grpc.closeClient(this.client);
    logger.info('gRPC Executor Client closed');
  }
}

export const executorClient = new ExecutorClient();
