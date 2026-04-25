import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface IrpInvoicePayload {
  invoiceNumber: string;
  invoiceDate: string;          // DD/MM/YYYY
  supplyType: 'B2B' | 'B2C';
  sellerGstin: string;
  buyerGstin?: string;
  buyerName: string;
  buyerState: string;
  placeOfSupply: string;        // 2-digit state code
  baseAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalAmount: number;
  packName: string;
  credits: number;
  sacCode: string;
}

export interface IrpEInvoiceResult {
  irn: string;
  ackNo: string;
  ackDate: string;
  signedQrCode: string;
  status: 'GENERATED' | 'DUPLICATE';
}

const IRP_SANDBOX_URL = 'https://einv-apisandbox.nic.in';
const TOKEN_CACHE_TTL_MS = 3_300_000; // 55 min — IRP tokens last 1 hour

@Injectable()
export class IrpClientService {
  private readonly logger = new Logger(IrpClientService.name);
  private readonly baseUrl: string;
  private readonly gstin: string;
  private readonly username: string;
  private readonly password: string;
  private readonly appKey: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private readonly config: ConfigService) {
    this.baseUrl      = config.get<string>('GSTN_IRP_URL') ?? IRP_SANDBOX_URL;
    this.gstin        = config.get<string>('PLATFORM_GSTIN') ?? '';
    this.username     = config.get<string>('GSTN_IRP_USERNAME') ?? '';
    this.password     = config.get<string>('GSTN_IRP_PASSWORD') ?? '';
    this.appKey       = config.get<string>('GSTN_IRP_APP_KEY') ?? '';
    this.clientId     = config.get<string>('GSTN_SANDBOX_KEY') ?? '';
    this.clientSecret = config.get<string>('GSTN_IRP_CLIENT_SECRET') ?? '';
  }

  get isConfigured(): boolean {
    return !!(this.gstin && this.username && this.password && this.clientId);
  }

  async generateEInvoice(payload: IrpInvoicePayload): Promise<IrpEInvoiceResult> {
    const token = await this.getAccessToken();
    const body  = this.buildIrpPayload(payload);

    const res = await axios.post(
      `${this.baseUrl}/eivital/dev/eco/v3.03/Invoice`,
      body,
      {
        headers: {
          'Content-Type': 'application/json',
          'user_name':    this.username,
          'client_id':    this.clientId,
          'client_secret': this.clientSecret,
          'Gstin':         this.gstin,
          'AuthToken':     token,
        },
        timeout: 15_000,
      },
    );

    const { data } = res;
    if (data?.Status !== 1) {
      const errMsg = data?.ErrorDetails?.[0]?.ErrorMessage ?? JSON.stringify(data);
      throw new Error(`IRP e-invoice generation failed: ${errMsg}`);
    }

    const result = data.Data;
    this.logger.log(`IRP e-invoice generated: IRN=${result.Irn}, AckNo=${result.AckNo}`);

    return {
      irn:          result.Irn,
      ackNo:        String(result.AckNo),
      ackDate:      result.AckDt,
      signedQrCode: result.SignedQRCode,
      status:       'GENERATED',
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.tokenExpiresAt) {
      return this.cachedToken;
    }

    const res = await axios.post(
      `${this.baseUrl}/eivital/dev/eco/v3.03/auth`,
      {
        UserName:  this.username,
        Password:  this.password,
        AppKey:    this.appKey,
        ForceRefreshAccessToken: false,
      },
      {
        headers: {
          'client_id':     this.clientId,
          'client_secret': this.clientSecret,
          'Gstin':         this.gstin,
        },
        timeout: 10_000,
      },
    );

    if (res.data?.Status !== 1) {
      throw new Error(`IRP auth failed: ${JSON.stringify(res.data)}`);
    }

    this.cachedToken    = res.data.Data.AuthToken;
    this.tokenExpiresAt = Date.now() + TOKEN_CACHE_TTL_MS;
    return this.cachedToken!;
  }

  private buildIrpPayload(p: IrpInvoicePayload): object {
    const now = new Date();
    return {
      Version: '1.1',
      TranDtls: {
        TaxSch:  'GST',
        SupTyp:  p.supplyType,
        RegRev:  'N',
        EcmGstin: null,
        IgstOnIntra: 'N',
      },
      DocDtls: {
        Typ:  'INV',
        No:   p.invoiceNumber,
        Dt:   p.invoiceDate,
      },
      SellerDtls: {
        Gstin: this.gstin,
        LglNm: 'B2B Marketplace Pvt Ltd',
        Addr1: '123 Tech Park',
        Loc:   'Bengaluru',
        Pin:   560001,
        Stcd:  '29',
      },
      BuyerDtls: {
        Gstin: p.buyerGstin ?? 'URP',
        LglNm: p.buyerName,
        Pos:   p.placeOfSupply,
        Addr1: p.buyerState,
        Loc:   p.buyerState,
        Pin:   999999,
        Stcd:  p.placeOfSupply,
      },
      ItemList: [
        {
          SlNo:       '1',
          PrdDesc:    `Lead Credit Pack — ${p.packName} (${p.credits} credits)`,
          IsServc:    'Y',
          HsnCd:      p.sacCode,
          Qty:        p.credits,
          Unit:       'NOS',
          UnitPrice:  +(p.baseAmount / p.credits).toFixed(2),
          TotAmt:     p.baseAmount,
          Discount:   0,
          AssAmt:     p.baseAmount,
          GstRt:      18,
          IgstAmt:    p.igst,
          CgstAmt:    p.cgst,
          SgstAmt:    p.sgst,
          CesRt:      0,
          CesAmt:     0,
          CesNonAdvlAmt: 0,
          StateCesRt: 0,
          StateCesAmt: 0,
          StateCesNonAdvlAmt: 0,
          OthChrg:    0,
          TotItemVal: p.totalAmount,
        },
      ],
      ValDtls: {
        AssVal:   p.baseAmount,
        CgstVal:  p.cgst,
        SgstVal:  p.sgst,
        IgstVal:  p.igst,
        CesVal:   0,
        StCesVal: 0,
        Discount: 0,
        OthChrg:  0,
        RndOffAmt: 0,
        TotInvVal: p.totalAmount,
      },
    };
  }
}
