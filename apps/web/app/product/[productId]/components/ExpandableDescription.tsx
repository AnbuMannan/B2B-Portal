'use client';

import { useState, useEffect, useRef } from 'react';

const TRUNCATE_AT_CHARS = 500;

/**
 * Renders product description safely. Supports HTML (from Tiptap) and plain text.
 * - If content contains HTML tags → renders via sanitized innerHTML
 * - Otherwise → renders as plain text (whitespace-pre-line)
 * DOMPurify sanitization is applied client-side to prevent XSS.
 */
export default function ExpandableDescription({ description }: { description: string }) {
  const [expanded, setExpanded] = useState(false);
  const [sanitized, setSanitized] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const isHtml = /<[a-z][\s\S]*>/i.test(description);

  useEffect(() => {
    if (!isHtml) {
      setSanitized(description);
      return;
    }
    // Dynamic import of DOMPurify (client-only)
    import('dompurify').then(({ default: DOMPurify }) => {
      const clean = DOMPurify.sanitize(description, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h2', 'h3', 'a'],
        ALLOWED_ATTR: ['href', 'target', 'rel'],
      });
      setSanitized(clean);
    });
  }, [description, isHtml]);

  if (!description) return null;

  // For plain text — truncate and expand
  if (!isHtml) {
    const isLong = description.length > TRUNCATE_AT_CHARS;
    const displayed = isLong && !expanded ? description.slice(0, TRUNCATE_AT_CHARS) + '…' : description;
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

  // For HTML content
  return (
    <div>
      <div
        ref={containerRef}
        className={`text-sm text-gray-600 leading-relaxed prose prose-sm max-w-none
          [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5
          [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold
          ${!expanded ? 'max-h-40 overflow-hidden relative' : ''}
        `}
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
      {!expanded && (
        <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white to-transparent pointer-events-none" />
      )}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
      >
        {expanded ? 'Show less' : 'Show full description'}
      </button>
    </div>
  );
}
