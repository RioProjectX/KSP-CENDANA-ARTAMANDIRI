import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Ya, Lanjutkan',
  cancelLabel = 'Batal',
  danger = true,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-md rounded-xl border border-[#DCE4DE] bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                danger ? 'bg-red-50 text-red-700' : 'bg-[#FEF9E7] text-[#9A7412]'
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h3
              id="confirm-modal-title"
              className="font-display text-lg font-bold text-[#0F1F17]"
            >
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#5C6E63] hover:bg-[#F1F5F2] hover:text-[#0F1F17]"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-[#425449]">{message}</p>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="min-h-[42px] rounded-lg border border-[#DCE4DE] bg-white px-4 py-2 text-sm font-medium text-[#2A3B31] transition-colors hover:bg-[#F6F8F6] whitespace-nowrap"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`min-h-[42px] rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors whitespace-nowrap disabled:opacity-60 ${
              danger
                ? 'bg-red-700 hover:bg-red-800'
                : 'bg-[#0D4A2E] hover:bg-[#083320]'
            }`}
          >
            {loading ? 'Memproses...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
