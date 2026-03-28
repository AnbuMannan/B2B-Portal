interface SellerHeaderProps {
  seller: {
    companyName: string;
    companyType: string;
    city: string | null;
    state: string | null;
    companyInitials: string;
    badges: string[];
    yearsInBusiness: number;
    productCount: number;
  };
}

const COMPANY_TYPE_LABELS: Record<string, string> = {
  PROPRIETORSHIP: 'Proprietorship',
  PRIVATE_LIMITED: 'Private Limited Company',
  LLP: 'Limited Liability Partnership',
};

const BADGE_CONFIG: Record<string, { label: string; classes: string }> = {
  VERIFIED_SELLER: {
    label: '✓ Verified Seller',
    classes: 'bg-green-100 text-green-800',
  },
  GST_VERIFIED: {
    label: '✓ GST Verified',
    classes: 'bg-green-100 text-green-800',
  },
  IEC_GLOBAL: {
    label: '✓ IEC Global',
    classes: 'bg-blue-100 text-blue-800',
  },
};

export default function SellerHeader({ seller }: SellerHeaderProps) {
  const estYear =
    new Date().getFullYear() - seller.yearsInBusiness;

  const location = seller.city && seller.state
    ? `${seller.city}, ${seller.state}`
    : seller.state ?? seller.city ?? null;

  return (
    <div className="space-y-4">
      {/* Row 1: Avatar + name */}
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0 w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold"
          style={{ fontSize: 28 }}>
          {seller.companyInitials}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{seller.companyName}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {COMPANY_TYPE_LABELS[seller.companyType] ?? seller.companyType}
          </p>
        </div>
      </div>

      {/* Row 2: Location + established */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
        {location && <span>📍 {location}</span>}
        <span>Est. {estYear}</span>
      </div>

      {/* Row 3: Trust badges */}
      {seller.badges.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {seller.badges.map((badge) => {
            const config = BADGE_CONFIG[badge];
            if (!config) return null;
            return (
              <span
                key={badge}
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${config.classes}`}
              >
                {config.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Row 4: Stats */}
      <p className="text-sm text-gray-600">
        {seller.productCount} Products Listed &nbsp;|&nbsp; {seller.yearsInBusiness}+ Years in Business
      </p>
    </div>
  );
}
