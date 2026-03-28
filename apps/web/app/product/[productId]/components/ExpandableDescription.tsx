'use client';

import { useState } from 'react';

const TRUNCATE_AT = 300;

export default function ExpandableDescription({ description }: { description: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = description.length > TRUNCATE_AT;
  const displayed = isLong && !expanded ? description.slice(0, TRUNCATE_AT) + '…' : description;

  return (
    <div>
      <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{displayed}</p>
      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}
