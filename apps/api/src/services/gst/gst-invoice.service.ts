import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../database/database.service';

export interface InvoiceData {
  transactionId: string;
  invoiceNumber: string;
  date: Date;
  // Seller (buyer of the service)
  buyerName: string;
  buyerGstin?: string;
  buyerAddress?: string;
  buyerState?: string;
  // Platform (seller of the service)
  platformName: string;
  platformGstin: string;
  platformAddress: string;
  // Line item
  packName: string;
  credits: number;
  baseAmount: number;
  gstRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  gstAmount: number;
  totalAmount: number;
  // Payment
  razorpayPaymentId?: string;
}

@Injectable()
export class GstInvoiceService {
  private readonly logger = new Logger(GstInvoiceService.name);

  // Platform GST details (set via env in production)
  private readonly platformGstin: string;
  private readonly platformName  = 'B2B Marketplace Pvt Ltd';
  private readonly platformAddr  = '123 Tech Park, Bangalore, Karnataka 560001';
  private readonly platformState = 'Karnataka';

  private readonly invoiceBaseDir: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.platformGstin = this.config.get<string>('PLATFORM_GSTIN') ?? '29AABCU9603R1ZX';
    this.invoiceBaseDir = path.resolve(
      process.cwd(),
      this.config.get<string>('INVOICE_DIR') ?? 'invoices',
    );
  }

  // ── Invoice number generation ─────────────────────────────────────────────

  async generateInvoiceNumber(date: Date): Promise<string> {
    const year  = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const prefix = `B2B-${year}-${month}-`;

    // Find the highest existing sequence for this year-month from the DB
    const last = await this.prisma.leadCreditTransaction.findFirst({
      where: {
        invoiceNumber: { startsWith: prefix },
      },
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    });

    let seq = 1;
    if (last?.invoiceNumber) {
      const suffix = last.invoiceNumber.slice(prefix.length);
      const parsed = parseInt(suffix, 10);
      if (!isNaN(parsed)) seq = parsed + 1;
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  // ── GST tax breakdown ─────────────────────────────────────────────────────

  computeTax(
    baseAmount: number,
    sellerState: string | undefined,
  ): { cgst: number; sgst: number; igst: number; gstAmount: number } {
    const GST_RATE = 0.18;
    const gstAmount = Math.round(baseAmount * GST_RATE * 100) / 100;

    // Intra-state: CGST 9% + SGST 9%; Inter-state: IGST 18%
    const isIntraState =
      sellerState && sellerState.toLowerCase() === this.platformState.toLowerCase();

    if (isIntraState) {
      const half = Math.round((gstAmount / 2) * 100) / 100;
      return { cgst: half, sgst: gstAmount - half, igst: 0, gstAmount };
    }
    return { cgst: 0, sgst: 0, igst: gstAmount, gstAmount };
  }

  // ── Generate invoice (sandbox: HTML file; production: GSTN IRP PDF) ──────

  async generateInvoice(data: InvoiceData): Promise<string> {
    const env = this.config.get<string>('NODE_ENV') ?? 'development';

    if (env === 'production') {
      // TODO: Integrate with GSTN Invoice Registration Portal (IRP) API
      // const eInvoice = await this.gstnIrpClient.generateEInvoice(data);
      // return this.savePdf(data, eInvoice.signedQrCode);
      this.logger.warn('Production GST IRP not configured — falling back to mock invoice');
    }

    return this.generateMockInvoice(data);
  }

  // ── Serve invoice file ────────────────────────────────────────────────────

  getInvoicePath(relativePath: string): string {
    return path.join(this.invoiceBaseDir, relativePath);
  }

  invoiceExists(relativePath: string): boolean {
    return fs.existsSync(this.getInvoicePath(relativePath));
  }

  readInvoice(relativePath: string): Buffer {
    return fs.readFileSync(this.getInvoicePath(relativePath));
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async generateMockInvoice(data: InvoiceData): Promise<string> {
    const year  = data.date.getFullYear();
    const month = String(data.date.getMonth() + 1).padStart(2, '0');
    const dir   = path.join(this.invoiceBaseDir, String(year), month);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const fileName     = `${data.invoiceNumber}.html`;
    const relativePath = path.join(String(year), month, fileName);
    const fullPath     = path.join(dir, fileName);

    const html = this.renderInvoiceHtml(data);
    fs.writeFileSync(fullPath, html, 'utf8');

    this.logger.log(`Invoice generated: ${relativePath}`);
    return relativePath;
  }

  private renderInvoiceHtml(d: InvoiceData): string {
    const fmt   = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    const dateStr = d.date.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'long', year: 'numeric',
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>GST Tax Invoice — ${d.invoiceNumber}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; margin: 40px; color: #222; }
  h1   { font-size: 20px; text-align: center; margin-bottom: 4px; }
  .sub { text-align: center; color: #555; margin-bottom: 20px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
  .box  { border: 1px solid #ccc; padding: 12px; border-radius: 4px; }
  .box h3 { margin: 0 0 8px; font-size: 13px; color: #444; border-bottom: 1px solid #eee; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th    { background: #1e40af; color: white; padding: 8px; text-align: left; font-size: 11px; }
  td    { border-bottom: 1px solid #eee; padding: 7px 8px; }
  .right { text-align: right; }
  .total-row td { font-weight: bold; background: #f0f4ff; }
  .footer { margin-top: 30px; font-size: 10px; color: #888; border-top: 1px solid #eee; padding-top: 10px; }
  .badge { display: inline-block; background: #16a34a; color: white; padding: 2px 8px; border-radius: 12px; font-size: 10px; }
</style>
</head>
<body>
<h1>TAX INVOICE</h1>
<p class="sub">Original for Recipient &nbsp;|&nbsp; <span class="badge">PAID</span></p>

<div class="grid">
  <div class="box">
    <h3>Billed By (Supplier)</h3>
    <strong>${d.platformName}</strong><br/>
    GSTIN: ${d.platformGstin}<br/>
    ${d.platformAddress}
  </div>
  <div class="box">
    <h3>Billed To (Recipient)</h3>
    <strong>${d.buyerName}</strong><br/>
    ${d.buyerGstin ? `GSTIN: ${d.buyerGstin}<br/>` : ''}
    ${d.buyerAddress ?? ''}
  </div>
</div>

<table>
  <tr>
    <th>Invoice No.</th><th>Invoice Date</th>
    <th>Payment ID</th><th>SAC Code</th>
  </tr>
  <tr>
    <td>${d.invoiceNumber}</td>
    <td>${dateStr}</td>
    <td>${d.razorpayPaymentId ?? '—'}</td>
    <td>998313</td>
  </tr>
</table>

<table>
  <tr>
    <th>Description</th><th>Credits</th>
    <th class="right">Rate (₹)</th>
    <th class="right">Base Amount</th>
  </tr>
  <tr>
    <td>Lead Credit Pack — ${d.packName}</td>
    <td>${d.credits}</td>
    <td class="right">${fmt(d.baseAmount / d.credits)}/credit</td>
    <td class="right">${fmt(d.baseAmount)}</td>
  </tr>
</table>

<table>
  <tr>
    <th colspan="2">Tax Breakdown</th>
    <th class="right">Rate</th>
    <th class="right">Amount</th>
  </tr>
  ${d.cgst > 0 ? `
  <tr><td colspan="2">CGST</td><td class="right">9%</td><td class="right">${fmt(d.cgst)}</td></tr>
  <tr><td colspan="2">SGST</td><td class="right">9%</td><td class="right">${fmt(d.sgst)}</td></tr>` : `
  <tr><td colspan="2">IGST</td><td class="right">18%</td><td class="right">${fmt(d.igst)}</td></tr>`}
  <tr class="total-row">
    <td colspan="2"><strong>Total Amount Payable</strong></td>
    <td class="right"></td>
    <td class="right"><strong>${fmt(d.totalAmount)}</strong></td>
  </tr>
</table>

<p style="font-size:11px;color:#555;">
  Amount in words: <strong>${this.amountToWords(d.totalAmount)}</strong>
</p>

<div class="footer">
  This is a computer-generated invoice and does not require a physical signature.<br/>
  For queries: support@b2bmarketplace.in &nbsp;|&nbsp; GST Invoice generated on ${new Date().toISOString()}
</div>
</body>
</html>`;
  }

  private amountToWords(amount: number): string {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
      'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const toWords = (n: number): string => {
      if (n === 0) return '';
      if (n < 20) return ones[n];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
      if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + toWords(n % 100) : '');
      if (n < 100000) return toWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + toWords(n % 1000) : '');
      return toWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + toWords(n % 100000) : '');
    };

    const rupees = Math.floor(amount);
    const paise  = Math.round((amount - rupees) * 100);
    let result   = toWords(rupees) + ' Rupees';
    if (paise > 0) result += ' and ' + toWords(paise) + ' Paise';
    return result + ' Only';
  }
}
