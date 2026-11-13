import { useRef, useState } from 'react';
import { Eye, FileText, Image as ImageIcon, Paperclip, Trash2, Upload } from 'lucide-react';
import { Attachment } from '../types';
import { formatFileSize } from '../utils/format';

interface AttachmentFieldProps {
  value?: Attachment;
  onChange: (attachment?: Attachment) => void;
  onPreview?: (attachment: Attachment) => void;
  label?: string;
}

const MAX_PDF_BYTES = 650 * 1024; // ~650 KB PDF (~870 KB base64 < 1 MiB Firestore limit)
const MAX_IMAGE_RAW_BYTES = 10 * 1024 * 1024; // Accept up to 10 MB photo and auto-compress

async function compressImageToDataUrl(file: File): Promise<{ dataUrl: string; size: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format gambar tidak dapat diproses.'));
      img.onload = () => {
        const maxDim = 1280;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Gagal memproses kompresi gambar.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.78;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > 850_000 && quality > 0.35) {
          quality -= 0.12;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        const approxBytes = Math.round((dataUrl.length * 3) / 4);
        resolve({ dataUrl, size: approxBytes });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function AttachmentField({
  value,
  onChange,
  onPreview,
  label = 'Lampiran Bukti (Foto / PDF)',
}: AttachmentFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>('');
  const [processing, setProcessing] = useState<boolean>(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isImage && !isPdf) {
      setError('Format file harus berupa Foto (JPG, PNG, WebP) atau PDF.');
      return;
    }

    if (isPdf) {
      if (file.size > MAX_PDF_BYTES) {
        setError('Ukuran file PDF maksimal 650 KB agar kompatibel dengan penyimpanan cloud.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = typeof reader.result === 'string' ? reader.result : '';
        if (!dataUrl) {
          setError('Gagal membaca berkas PDF.');
          return;
        }
        onChange({
          id: `att-${Date.now()}`,
          name: file.name,
          mimeType: 'application/pdf',
          size: file.size,
          dataUrl,
        });
      };
      reader.onerror = () => setError('Gagal membaca berkas PDF.');
      reader.readAsDataURL(file);
      return;
    }

    if (file.size > MAX_IMAGE_RAW_BYTES) {
      setError('Ukuran foto mentah maksimal 10 MB.');
      return;
    }

    setProcessing(true);
    try {
      const compressed = await compressImageToDataUrl(file);
      onChange({
        id: `att-${Date.now()}`,
        name: file.name,
        mimeType: 'image/jpeg',
        size: compressed.size,
        dataUrl: compressed.dataUrl,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memproses gambar.');
    } finally {
      setProcessing(false);
    }
  };

  const isPdf = value?.mimeType === 'application/pdf';

  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
        {label}{' '}
        <span className="font-normal text-[#6C7E73]">
          (Opsional · Foto otomatis dikompresi / PDF maks 650 KB)
        </span>
      </label>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf,.pdf"
        onChange={(e) => void handleFileChange(e)}
        className="hidden"
      />

      {!value ? (
        <button
          type="button"
          disabled={processing}
          onClick={() => inputRef.current?.click()}
          className="flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-lg border border-dashed border-[#B7C7BD] bg-[#F8FAF8] px-4 py-3 text-sm font-medium text-[#2A3B31] transition-colors hover:border-[#0D4A2E] hover:bg-[#EFF5F1] disabled:opacity-60"
        >
          <Upload className="h-4 w-4 text-[#0D4A2E]" />
          <span>
            {processing
              ? 'Mengompresi gambar...'
              : 'Pilih Foto Kuitansi / Bukti Transfer / Dokumen PDF'}
          </span>
        </button>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-[#DCE4DE] bg-[#F8FAF8] p-2.5">
          <div className="flex min-w-0 items-center gap-3">
            {isPdf ? (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-700 border border-red-200">
                <FileText className="h-5 w-5" />
              </div>
            ) : (
              <img
                src={value.dataUrl}
                alt={value.name}
                className="h-11 w-11 shrink-0 rounded-md border border-[#DCE4DE] object-cover"
              />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[#0F1F17]">{value.name}</p>
              <p className="text-xs text-[#5C6E63] flex items-center gap-1.5">
                {isPdf ? <Paperclip className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                <span>{isPdf ? 'Dokumen PDF' : 'Foto'}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{formatFileSize(value.size)}</span>
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {onPreview && (
              <button
                type="button"
                onClick={() => onPreview(value)}
                className="flex h-9 items-center gap-1 rounded-md border border-[#DCE4DE] bg-white px-2.5 text-xs font-medium text-[#0D4A2E] hover:bg-[#EFF5F1]"
                title="Lihat Lampiran"
              >
                <Eye className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Lihat</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex h-9 items-center rounded-md border border-[#DCE4DE] bg-white px-2.5 text-xs font-medium text-[#2A3B31] hover:bg-[#F1F5F2]"
            >
              Ganti
            </button>
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-red-200 bg-white text-red-700 hover:bg-red-50"
              title="Hapus Lampiran"
              aria-label="Hapus Lampiran"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-1.5 text-xs font-medium text-red-700">{error}</p>}
    </div>
  );
}
