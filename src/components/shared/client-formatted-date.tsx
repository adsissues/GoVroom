
"use client";

import { useState, useEffect, type CSSProperties } from 'react';

interface ClientFormattedDateProps {
  date: Date | string;
  style?: CSSProperties;
  className?: string;
}

export default function ClientFormattedDate({ date, style, className }: ClientFormattedDateProps) {
  const [formattedDate, setFormattedDate] = useState<string | null>(null);

  useEffect(() => {
    // Ensure date is a valid Date object before formatting
    const dateObj = date instanceof Date ? date : new Date(date);
    if (!isNaN(dateObj.getTime())) {
      setFormattedDate(dateObj.toLocaleDateString());
    } else {
      setFormattedDate("Invalid Date");
    }
  }, [date]);

  if (formattedDate === null) {
    // Render a placeholder or an empty span to match server render initially
    // The width can be adjusted or a more sophisticated skeleton can be used
    return <span style={{ display: 'inline-block', minWidth: '80px', ...style }} className={className}>...</span>;
  }

  return <span style={style} className={className}>{formattedDate}</span>;
}
