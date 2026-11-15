import { useEffect, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';
import { formatDateID } from '../utils/format';

interface DateInputIDProps {
  value: string; // ISO YYYY-MM-DD
  onChange: (isoDate: string) => void;
  required?: boolean;
  className?: string;
}

function parseDisplayDateToISO(display: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function maskDDMMYYYY(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function DateInputID({
  value,
  onChange,
  required = false,
  className = '',
}: DateInputIDProps) {
  const [text, setText] = useState<string>(() => (value ? formatDateID(value) : ''));
  const nativeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const formatted = value ? formatDateID(value) : '';
    if (formatted !== '-' && formatted !== text) {
      const currentIso = parseDisplayDateToISO(text);
      if (currentIso !== value) {
        setText(formatted);
      }
    }
  }, [value]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskDDMMYYYY(e.target.value);
    setText(masked);
    const parsedIso = parseDisplayDateToISO(masked);
    if (parsedIso) {
      onChange(parsedIso);
    }
  };

  const handleBlur = () => {
    const parsedIso = parseDisplayDateToISO(text);
    if (!parsedIso && value) {
      setText(formatDateID(value));
    }
  };

  const openPicker = () => {
    const el = nativeRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker();
        return;
      } catch {
        // Fallback for browsers where showPicker is restricted
      }
    }
    el.focus();
    el.click();
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      <input
        type="text"
        inputMode="numeric"
        value={text}
        onChange={handleTextChange}
        onBlur={handleBlur}
        placeholder="tgl/bln/tahun"
        maxLength={10}
        required={required}
        className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] bg-white pl-3 pr-10 font-mono text-sm text-[#0F1F17] tabular-nums focus:border-[#0D4A2E] focus:outline-none"
      />
      <input
        ref={nativeRef}
        type="date"
        value={value}
        onChange={(e) => {
          if (e.target.value) {
            setText(formatDateID(e.target.value));
            onChange(e.target.value);
          }
        }}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute right-2 h-8 w-8 opacity-0"
      />
      <button
        type="button"
        onClick={openPicker}
        title="Pilih Tanggal dari Kalender"
        aria-label="Pilih Tanggal dari Kalender"
        className="absolute right-1.5 flex h-8 w-8 items-center justify-center rounded-md text-[#5C6E63] transition-colors hover:bg-[#EFF5F1] hover:text-[#0D4A2E]"
      >
        <Calendar className="h-4 w-4" />
      </button>
    </div>
  );
}
