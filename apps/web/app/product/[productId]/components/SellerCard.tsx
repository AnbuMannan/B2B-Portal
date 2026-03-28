import Link from 'next/link';

interface Props {
  sellerId: string;
  companyName: string;
  sellerType: string;
  isVerified: boolean;
  verificationBadges: string[];
}

const BADGE_STYLES: Record<string, string> = {
  'Verified Seller': 'bg-blue-100 text-blue-700',
  'GST Verified': 'bg-green-100 text-green-700',
  'IEC Global': 'bg-purple-100 text-purple-700',
  'MSME Registered': 'bg-yellow-100 text-yellow-700',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export default function SellerCard({
  sellerId,
  companyName,
  sellerType,
  verificationBadges,
}: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-start gap-3">
        {/* Initials avatar */}
        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-sm font-bold">
          {getInitials(companyName)}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{companyName}</p>
          <p className="text-xs text-gray-500 mt-0.5">{sellerType}</p>

          {/* Verification badges */}
          {verificationBadges.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {verificationBadges.map((badge) => (
                <span
                  key={badge}
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    BADGE_STYLES[badge] ?? 'bg-gray-100 text-gray-600'
                  }`}
                >
                  ✓ {badge}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <Link
        href={`/seller/${sellerId}`}
        className="mt-3 flex w-full items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        View Seller Profile →
      </Link>
    </div>
  );
}
