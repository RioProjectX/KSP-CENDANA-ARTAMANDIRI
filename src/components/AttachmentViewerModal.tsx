import { Download, FileText, X } from 'lucide-react';
import { Attachment } from '../types';
import { formatFileSize } from '../utils/format';

interface AttachmentViewerModalProps {
  attachment: Attachment | null;
  onClose: () => void;
}

export function AttachmentViewerModal({ attachment, onClose }: AttachmentViewerModalProps) {
  if (!attachment) return null;

  const isPdf = attachment.mimeType === 'application/pdf';

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = attachment.dataUrl;
    link.download = attachment.name || 'lampiran';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 sm:p-6 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[#DCE4DE] bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-[#DCE4DE] bg-[#F8FAF8] px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h3 className="truncate font-display text-base font-bold text-[#0F1F17]">
              {attachment.name}
            </h3>
            <p className="text-xs text-[#5C6E63]">
              {isPdf ? 'Dokumen PDF' : 'Gambar / Foto'} · {formatFileSize(attachment.size)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#0D4A2E] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#083320] whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Unduh</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#DCE4DE] bg-white text-[#2A3B31] hover:bg-[#F1F5F2]"
              aria-label="Tutup Pratinjau"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-[#0F1F17]/5 p-4 flex items-center justify-center">
          {isPdf ? (
            <div className="w-full">
              <iframe
                src={attachment.dataUrl}
                title={attachment.name}
                className="h-[65vh] w-full rounded-lg border border-[#DCE4DE] bg-white"
              />
              <div className="mt-3 flex items-center justify-center gap-2 text-xs text-[#5C6E63]">
                <FileText className="h-4 w-4" />
                <span>Jika PDF tidak tampil di browser ponsel, silakan tekan tombol Unduh di atas.</span>
              </div>
            </div>
          ) : (
            <img
              src={attachment.dataUrl}
              alt={attachment.name}
              className="max-h-[70vh] w-auto rounded-lg border border-[#DCE4DE] object-contain shadow-sm"
            />
          )}
        </div>
      </div>
    </div>
  );
}
