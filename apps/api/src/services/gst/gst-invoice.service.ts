import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../database/database.service';
import { IrpClientService } from './irp-client.service';

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

export interface GenerateInvoiceResult {
  /** Relative path to the PDF/HTML invoice file */
  invoicePath: string;
  /** GSTN IRP Invoice Reference Number (null when IRP not configured) */
  irn?: string;
  ackNo?: string;
  irpQrCode?: string;
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
    private readonly irpClient: IrpClientService,
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

  // ── Generate invoice — IRP when credentials present, PDF mock otherwise ──

  async generateInvoice(data: InvoiceData): Promise<GenerateInvoiceResult> {
    // Attempt IRP registration whenever credentials are configured (sandbox or prod)
    if (this.irpClient.isConfigured) {
      try {
        const stateCodeMap: Record<string, string> = {
          'andhra pradesh': '37', 'arunachal pradesh': '12', 'assam': '18',
          'bihar': '10', 'chhattisgarh': '22', 'goa': '30', 'gujarat': '24',
          'haryana': '06', 'himachal pradesh': '02', 'jharkhand': '20',
          'karnataka': '29', 'kerala': '32', 'madhya pradesh': '23',
          'maharashtra': '27', 'manipur': '14', 'meghalaya': '17',
          'mizoram': '15', 'nagaland': '13', 'odisha': '21', 'punjab': '03',
          'rajasthan': '08', 'sikkim': '11', 'tamil nadu': '33',
          'telangana': '36', 'tripura': '16', 'uttar pradesh': '09',
          'uttarakhand': '05', 'west bengal': '19', 'delhi': '07',
        };
        const pos = stateCodeMap[(data.buyerState ?? '').toLowerCase()] ?? '29';
        const eInv = await this.irpClient.generateEInvoice({
          invoiceNumber: data.invoiceNumber,
          invoiceDate:   data.date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          supplyType:    data.buyerGstin ? 'B2B' : 'B2C',
          sellerGstin:   this.platformGstin,
          buyerGstin:    data.buyerGstin,
          buyerName:     data.buyerName,
          buyerState:    data.buyerState ?? '',
          placeOfSupply: pos,
          baseAmount:    data.baseAmount,
          cgst:          data.cgst,
          sgst:          data.sgst,
          igst:          data.igst,
          totalAmount:   data.totalAmount,
          packName:      data.packName,
          credits:       data.credits,
          sacCode:       '998313',
        });

        // Generate PDF with QR embedded
        const invoicePath = await this.generatePdf({ ...data, irpQrCode: eInv.signedQrCode } as any);
        return { invoicePath, irn: eInv.irn, ackNo: eInv.ackNo, irpQrCode: eInv.signedQrCode };
      } catch (err: any) {
        this.logger.error(`IRP e-invoice failed, falling back to local PDF: ${err.message}`);
      }
    }

    const invoicePath = await this.generateMockInvoice(data);
    return { invoicePath };
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

  // ── PDF generation ────────────────────────────────────────────────────────

  /**
   * Generates a GST-compliant PDF invoice using PDFKit.
   * Returns the file path relative to invoiceBaseDir.
   */
  async generatePdf(data: InvoiceData): Promise<string> {
    const year  = data.date.getFullYear();
    const month = String(data.date.getMonth() + 1).padStart(2, '0');
    const dir   = path.join(this.invoiceBaseDir, String(year), month);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const fileName     = `${data.invoiceNumber}.pdf`;
    const relativePath = path.join(String(year), month, fileName);
    const fullPath     = path.join(dir, fileName);

    await this._writePdf(data, fullPath);
    this.logger.log(`PDF invoice generated: ${relativePath}`);
    return relativePath;
  }

  private _writePdf(data: InvoiceData, filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      const fmt = (n: number) =>
        `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
      const dateStr = data.date.toLocaleDateString('en-IN', {
        day: '2-digit', month: 'long', year: 'numeric',
      });

      // ── Header ──────────────────────────────────────────────────────────────
      doc.fontSize(20).font('Helvetica-Bold').text('TAX INVOICE', { align: 'center' });
      doc.fontSize(10).font('Helvetica').fillColor('#555')
        .text('Original for Recipient | PAID', { align: 'center' });
      doc.moveDown(0.5);

      // ── Blue rule ───────────────────────────────────────────────────────────
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#1e40af').lineWidth(2).stroke();
      doc.moveDown(0.5);

      // ── Supplier / Recipient ────────────────────────────────────────────────
      const boxY = doc.y;
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#1e40af').text('Billed By (Supplier)', 50, boxY);
      doc.font('Helvetica').fontSize(9).fillColor('#222')
        .text(data.platformName, 50)
        .text(`GSTIN: ${data.platformGstin}`)
        .text(data.platformAddress);

      doc.font('Helvetica-Bold').fontSize(10).fillColor('#1e40af').text('Billed To (Recipient)', 300, boxY);
      doc.font('Helvetica').fontSize(9).fillColor('#222')
        .text(data.buyerName, 300)
        .text(data.buyerGstin ? `GSTIN: ${data.buyerGstin}` : '')
        .text(data.buyerAddress ?? '');

      doc.moveDown(1);

      // ── Invoice meta table ─────────────────────────────────────────────────
      const headers = ['Invoice No.', 'Invoice Date', 'Payment ID', 'SAC Code'];
      const values  = [data.invoiceNumber, dateStr, data.razorpayPaymentId ?? '—', '998313'];
      const colW = 123;
      const tableX = 50;
      let colX = tableX;
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#fff');
      headers.forEach((h, i) => {
        doc.rect(colX, doc.y, colW, 18).fillAndStroke('#1e40af', '#1e40af');
        doc.fillColor('#fff').text(h, colX + 4, doc.y - 14, { width: colW - 8 });
        colX += colW;
      });
      doc.moveDown(0.15);
      colX = tableX;
      doc.font('Helvetica').fontSize(9).fillColor('#222');
      values.forEach((v, i) => {
        doc.text(v, colX + 4, doc.y, { width: colW - 8 });
        colX += colW;
      });
      doc.moveDown(1);

      // ── Line item ─────────────────────────────────────────────────────────
      const lineHeaders = ['Description', 'Credits', 'Rate', 'Base Amount'];
      const lineWidths  = [240, 60, 100, 100];
      colX = tableX;
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#fff');
      lineHeaders.forEach((h, i) => {
        doc.rect(colX, doc.y, lineWidths[i], 18).fillAndStroke('#1e40af', '#1e40af');
        doc.fillColor('#fff').text(h, colX + 4, doc.y - 14, { width: lineWidths[i] - 8 });
        colX += lineWidths[i];
      });
      doc.moveDown(0.15);
      colX = tableX;
      doc.font('Helvetica').fontSize(9).fillColor('#222');
      const lineValues = [
        `Lead Credit Pack — ${data.packName}`,
        String(data.credits),
        fmt(data.baseAmount / data.credits) + '/cr',
        fmt(data.baseAmount),
      ];
      lineValues.forEach((v, i) => {
        doc.text(v, colX + 4, doc.y, { width: lineWidths[i] - 8 });
        colX += lineWidths[i];
      });
      doc.moveDown(1);

      // ── Tax summary ────────────────────────────────────────────────────────
      const taxRows: Array<[string, string]> = [];
      if (data.cgst > 0) {
        taxRows.push(['CGST (9%)', fmt(data.cgst)], ['SGST (9%)', fmt(data.sgst)]);
      } else {
        taxRows.push(['IGST (18%)', fmt(data.igst)]);
      }
      taxRows.push(['Total Amount', fmt(data.totalAmount)]);

      taxRows.forEach(([label, value], i) => {
        const isTotal = i === taxRows.length - 1;
        if (isTotal) {
          doc.rect(50, doc.y, 495, 18).fillAndStroke('#e0f2fe', '#e0f2fe');
          doc.font('Helvetica-Bold');
        } else {
          doc.font('Helvetica');
        }
        doc.fontSize(9).fillColor('#222')
          .text(label, 54, doc.y - 14, { width: 380 })
          .text(value, 450, doc.y - 9, { width: 90, align: 'right' });
        doc.moveDown(0.15);
      });

      doc.moveDown(0.5);
      doc.font('Helvetica').fontSize(8).fillColor('#555')
        .text(`Amount in Words: ${this.amountToWords(data.totalAmount)}`);

      // ── Footer ─────────────────────────────────────────────────────────────
      doc.moveTo(50, doc.y + 10).lineTo(545, doc.y + 10).strokeColor('#ccc').lineWidth(1).stroke();
      doc.moveDown(1);
      doc.font('Helvetica').fontSize(8).fillColor('#888')
        .text('This is a computer-generated invoice. No physical signature required.')
        .text(`For support: support@b2bmarketplace.in | Generated: ${new Date().toISOString()}`);

      doc.end();
      stream.on('finish', resolve);
      stream.on('error', reject);
    });
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
