import { JobData } from '../../types';
import { logger } from '../../utils/logger';

interface EmailTaskPayload {
  type: 'single' | 'bulk' | 'template';
  recipients: string | string[];
  subject: string;
  content: string;
  templateId?: string;
  templateData?: Record<string, any>;
  attachments?: Array<{
    filename: string;
    path: string;
    contentType?: string;
  }>;
  options?: {
    priority?: 'high' | 'normal' | 'low';
    delay?: number;
    retryOnFailure?: boolean;
  };
}

export async function processEmailTaskJob(
  data: JobData,
  updateProgress: (progress: number, message?: string) => Promise<void>
): Promise<any> {
  const payload = data.payload as EmailTaskPayload;
  
  logger.info(`Processing email task`, {
    jobId: data.id,
    type: payload.type,
    recipientCount: Array.isArray(payload.recipients) ? payload.recipients.length : 1
  });

  try {
    await updateProgress(10, 'Validating email configuration');
    
    // Validate email payload
    await validateEmailPayload(payload);
    
    await updateProgress(30, 'Preparing email content');
    
    let emailContent = payload.content;
    let processedRecipients: string[] = [];
    
    // Handle different email types
    switch (payload.type) {
      case 'single':
        processedRecipients = [payload.recipients as string];
        break;
      case 'bulk':
        processedRecipients = payload.recipients as string[];
        break;
      case 'template':
        emailContent = await processTemplate(payload.templateId!, payload.templateData);
        processedRecipients = Array.isArray(payload.recipients) 
          ? payload.recipients 
          : [payload.recipients as string];
        break;
    }

    await updateProgress(50, 'Sending emails');
    
    const results = await sendEmails(processedRecipients, {
      subject: payload.subject,
      content: emailContent,
      attachments: payload.attachments
    }, updateProgress);

    await updateProgress(90, 'Processing results');

    const finalResult = {
      type: payload.type,
      totalRecipients: processedRecipients.length,
      successful: results.successful.length,
      failed: results.failed.length,
      results: results,
      sentAt: new Date()
    };

    await updateProgress(100, 'Email processing completed');
    
    logger.info(`Email task completed`, {
      jobId: data.id,
      successful: results.successful.length,
      failed: results.failed.length
    });

    return finalResult;

  } catch (error) {
    logger.error(`Email task failed:`, error);
    throw error;
  }
}

async function validateEmailPayload(payload: EmailTaskPayload): Promise<void> {
  if (!payload.recipients || (Array.isArray(payload.recipients) && payload.recipients.length === 0)) {
    throw new Error('No recipients specified');
  }

  if (!payload.subject || !payload.content) {
    if (payload.type !== 'template') {
      throw new Error('Subject and content are required');
    }
  }

  if (payload.type === 'template' && !payload.templateId) {
    throw new Error('Template ID is required for template emails');
  }

  // Validate email addresses
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const recipients = Array.isArray(payload.recipients) ? payload.recipients : [payload.recipients];
  
  for (const email of recipients) {
    if (!emailRegex.test(email)) {
      throw new Error(`Invalid email address: ${email}`);
    }
  }
}

async function processTemplate(templateId: string, templateData?: Record<string, any>): Promise<string> {
  // Simulate template processing
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Mock template system
  const templates: Record<string, string> = {
    'welcome': 'Welcome {{name}}! Your account has been created successfully.',
    'notification': 'Hello {{name}}, you have {{count}} new notifications.',
    'report': 'Your {{reportType}} report is ready. Generated on {{date}}.',
    'reminder': 'Don\'t forget: {{task}} is due on {{dueDate}}.'
  };

  let template = templates[templateId];
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  // Simple template variable replacement
  if (templateData) {
    Object.entries(templateData).forEach(([key, value]) => {
      template = template.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    });
  }

  return template;
}

async function sendEmails(
  recipients: string[], 
  emailData: { subject: string; content: string; attachments?: any[] },
  updateProgress: (progress: number, message?: string) => Promise<void>
): Promise<{ successful: string[]; failed: Array<{ email: string; error: string }> }> {
  const successful: string[] = [];
  const failed: Array<{ email: string; error: string }> = [];
  
  const totalRecipients = recipients.length;
  
  for (let i = 0; i < totalRecipients; i++) {
    const email = recipients[i];
    const progress = 50 + (i / totalRecipients) * 30; // Progress from 50% to 80%
    
    await updateProgress(progress, `Sending email to ${email}`);
    
    try {
      await sendSingleEmail(email, emailData);
      successful.push(email);
      
      logger.info(`Email sent successfully to ${email}`);
      
      // Simulate email sending delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      failed.push({ email, error: errorMessage });
      
      logger.warn(`Failed to send email to ${email}: ${errorMessage}`);
    }
  }
  
  return { successful, failed };
}

async function sendSingleEmail(
  recipient: string, 
  emailData: { subject: string; content: string; attachments?: any[] }
): Promise<void> {
  // Simulate email sending with random failure rate
  await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100));
  
  // Simulate 5% failure rate
  if (Math.random() < 0.05) {
    throw new Error('SMTP connection failed');
  }
  
  // Mock email sending success
  logger.debug(`Mock email sent to ${recipient}`, {
    subject: emailData.subject,
    contentLength: emailData.content.length,
    attachments: emailData.attachments?.length || 0
  });
}