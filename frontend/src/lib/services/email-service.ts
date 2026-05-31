import { query } from '@/lib/db/client';
import { PricingEstimate } from '@/types/pricing';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  type: 'estimate_sent' | 'estimate_approved' | 'estimate_rejected';
  estimateId?: string;
}

export class EmailService {
  private static apiKey = process.env.RESEND_API_KEY;
  private static fromEmail = process.env.FROM_EMAIL || 'noreply@iitdeveloper.com';
  private static fromName = process.env.FROM_NAME || 'IITDeveloper';

  // Send email using Resend API
  static async sendEmail(options: EmailOptions): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    try {
      // If Resend API key is not configured, log email and return success
      if (!this.apiKey) {
        console.log('📧 Email would be sent:', {
          to: options.to,
          subject: options.subject,
          type: options.type,
        });
        
        // Still log to database
        if (options.estimateId) {
          await this.logEmail({
            estimateId: options.estimateId,
            recipient: options.to,
            subject: options.subject,
            type: options.type,
            status: 'sent',
            externalId: 'dev-mode-' + Date.now(),
          });
        }
        
        return { success: true, messageId: 'dev-mode-' + Date.now() };
      }

      // Send email via Resend
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${this.fromName} <${this.fromEmail}>`,
          to: options.to,
          subject: options.subject,
          html: options.html,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send email');
      }

      // Log successful email
      if (options.estimateId) {
        await this.logEmail({
          estimateId: options.estimateId,
          recipient: options.to,
          subject: options.subject,
          type: options.type,
          status: 'sent',
          externalId: data.id,
        });
      }

      return { success: true, messageId: data.id };
    } catch (error) {
      console.error('Error sending email:', error);

      // Log failed email
      if (options.estimateId) {
        await this.logEmail({
          estimateId: options.estimateId,
          recipient: options.to,
          subject: options.subject,
          type: options.type,
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Send estimate email to customer
  static async sendEstimate(
    estimate: PricingEstimate,
    customerEmail: string,
    customerName: string,
    message?: string
  ): Promise<{ success: boolean; error?: string }> {
    const html = this.generateEstimateEmailHTML(estimate, customerName, message);

    const result = await this.sendEmail({
      to: customerEmail,
      subject: `Your Project Estimate - ${estimate.id.substring(0, 8)}`,
      html,
      type: 'estimate_sent',
      estimateId: estimate.id,
    });

    return result;
  }

  // Generate HTML email for estimate
  private static generateEstimateEmailHTML(
    estimate: PricingEstimate,
    customerName: string,
    message?: string
  ): string {
    const validUntil = estimate.validUntil
      ? new Date(estimate.validUntil).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : 'N/A';

    const lineItemsHTML = estimate.lineItems
      .map(
        (item) => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 16px 8px;">
            <div style="font-weight: 600; color: #111827;">${item.serviceName}</div>
            <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">
              Qty: ${item.quantity} × ${item.unit}
            </div>
          </td>
          <td style="padding: 16px 8px; text-align: right; font-weight: 600; color: #111827;">
            $${item.totalPrice.toLocaleString()}
          </td>
        </tr>
      `
      )
      .join('');

    const discountHTML = estimate.discount
      ? `
        <tr>
          <td style="padding: 12px 8px; color: #6b7280;">
            Discount (${estimate.discount.value}${
            estimate.discount.type === 'percentage' ? '%' : ''
          })
          </td>
          <td style="padding: 12px 8px; text-align: right; color: #10b981;">
            -$${((estimate.subtotal * estimate.discount.value) / 100).toLocaleString()}
          </td>
        </tr>
      `
      : '';

    const taxHTML = estimate.tax
      ? `
        <tr>
          <td style="padding: 12px 8px; color: #6b7280;">
            Tax (${estimate.tax.rate}%)
          </td>
          <td style="padding: 12px 8px; text-align: right; color: #6b7280;">
            $${estimate.tax.amount.toLocaleString()}
          </td>
        </tr>
      `
      : '';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Project Estimate</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 40px;">
      <h1 style="margin: 0; font-size: 32px; font-weight: 700; background: linear-gradient(135deg, #00539C 0%, #FFD662 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
        IITDeveloper
      </h1>
    </div>

    <!-- Main Card -->
    <div style="background: white; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); overflow: hidden;">
      
      <!-- Greeting -->
      <div style="padding: 32px; border-bottom: 1px solid #e5e7eb;">
        <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 700; color: #111827;">
          Hi ${customerName},
        </h2>
        <p style="margin: 0; font-size: 16px; line-height: 1.5; color: #6b7280;">
          Thank you for your interest! Here's your personalized project estimate.
        </p>
        ${
          message
            ? `
          <div style="margin-top: 16px; padding: 16px; background-color: #f3f4f6; border-radius: 8px; border-left: 4px solid #FFD662;">
            <p style="margin: 0; font-size: 14px; color: #374151;">
              ${message}
            </p>
          </div>
        `
            : ''
        }
      </div>

      <!-- Estimate Details -->
      <div style="padding: 32px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 24px;">
          <div>
            <p style="margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280;">
              Estimate ID
            </p>
            <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 600; font-family: 'Courier New', monospace; color: #111827;">
              ${estimate.id.substring(0, 8)}
            </p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280;">
              Valid Until
            </p>
            <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 600; color: #111827;">
              ${validUntil}
            </p>
          </div>
        </div>

        <!-- Line Items -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <thead>
            <tr style="border-bottom: 2px solid #e5e7eb;">
              <th style="padding: 12px 8px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; font-weight: 600;">
                Service
              </th>
              <th style="padding: 12px 8px; text-align: right; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; font-weight: 600;">
                Price
              </th>
            </tr>
          </thead>
          <tbody>
            ${lineItemsHTML}
          </tbody>
        </table>

        <!-- Totals -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tbody>
            <tr>
              <td style="padding: 12px 8px; color: #6b7280;">
                Subtotal
              </td>
              <td style="padding: 12px 8px; text-align: right; font-weight: 600; color: #111827;">
                $${estimate.subtotal.toLocaleString()}
              </td>
            </tr>
            ${discountHTML}
            ${taxHTML}
            <tr style="border-top: 2px solid #e5e7eb;">
              <td style="padding: 16px 8px; font-size: 18px; font-weight: 700; color: #111827;">
                Total
              </td>
              <td style="padding: 16px 8px; text-align: right; font-size: 24px; font-weight: 700; color: #FFD662;">
                $${estimate.total.toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>

        <!-- CTA Button -->
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://iitdeveloper.com'}/estimate/${
      estimate.id
    }" 
           style="display: block; width: 100%; padding: 16px; text-align: center; background: linear-gradient(135deg, #FFD662 0%, #00539C 100%); color: #000; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; margin-bottom: 16px;">
          View Full Estimate
        </a>

        <p style="margin: 0; font-size: 14px; text-align: center; color: #6b7280;">
          Have questions? Just reply to this email.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; margin-top: 40px; padding: 0 20px;">
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">
        IITDeveloper - We don't just deploy code, we deploy stress relief.
      </p>
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">
        © ${new Date().getFullYear()} IITDeveloper. All rights reserved.
      </p>
    </div>

  </div>
</body>
</html>
    `;
  }

  // Log email to database
  private static async logEmail(data: {
    estimateId: string;
    recipient: string;
    subject: string;
    type: string;
    status: 'pending' | 'sent' | 'failed' | 'bounced';
    externalId?: string;
    errorMessage?: string;
  }): Promise<void> {
    try {
      await query(
        `INSERT INTO email_logs (estimate_id, recipient_email, subject, email_type, status, external_id, error_message, sent_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          data.estimateId,
          data.recipient,
          data.subject,
          data.type,
          data.status,
          data.externalId || null,
          data.errorMessage || null,
          data.status === 'sent' ? new Date() : null,
        ]
      );
    } catch (error) {
      console.error('Error logging email:', error);
      // Don't throw - email logging failure shouldn't break the flow
    }
  }
}
