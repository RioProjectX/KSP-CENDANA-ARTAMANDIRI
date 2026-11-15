import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Briefcase,
  Calculator,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Edit2,
  HandCoins,
  MapPin,
  Paperclip,
  Phone,
  Plus,
  Printer,
  Search,
  Trash2,
  User,
  X,
  XCircle,
} from 'lucide-react';
import {
  Attachment,
  Loan,
  LoanApplication,
  LoanApplicationStatus,
} from '../types';
import {
  formatDateID,
  formatNumericDots,
  formatRupiah,
  generateTxNumber,
  parseNumericDots,
  todayISO,
} from '../utils/format';
import { AttachmentField } from './AttachmentField';
import { ConfirmModal } from './ConfirmModal';
import { DateInputID } from './DateInputID';

interface LoanApplicationsViewProps {
  applications: LoanApplication[];
  existingLoanNumbers: string[];
  currentCashBalance: number;
  currentUserName: string;
  onCreateApplication: (
    data: Omit<LoanApplication, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onUpdateApplication: (
    existing: LoanApplication,
    data: Omit<LoanApplication, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onDeleteApplication: (id: string) => Promise<void>;
  onDisburseApplication: (
    application: LoanApplication,
    loanPayload: Omit<Loan, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onPreviewAttachment: (att: Attachment) => void;
  onGoToLoans: () => void;
}

const STATUS_META: Record<
  LoanApplicationStatus,
  { label: string; shortLabel: string; badgeClass: string; priority: number }
> = {
  MENUNGGU_VISIT: {
    label: 'Perlu Visit Lapangan',
    shortLabel: 'Perlu Visit',
    badgeClass: 'bg-amber-50 text-amber-800 border border-amber-300',
    priority: 1,
  },
  MENUNGGU_FINALISASI: {
    label: 'Menunggu Finalisasi',
    shortLabel: 'Tunggu Finalisasi',
    badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200',
    priority: 2,
  },
  LOLOS: {
    label: 'Lolos / Disetujui',
    shortLabel: 'Lolos',
    badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    priority: 3,
  },
  TIDAK_LOLOS: {
    label: 'Tidak Lolos',
    shortLabel: 'Tidak Lolos',
    badgeClass: 'bg-red-50 text-red-700 border border-red-200',
    priority: 4,
  },
};

function defaultDueDate(fromISO: string): string {
  const dt = new Date(`${fromISO}T00:00:00`);
  dt.setDate(dt.getDate() + 30);
  return dt.toISOString().slice(0, 10);
}

export function LoanApplicationsView({
  applications,
  existingLoanNumbers,
  currentCashBalance,
  currentUserName,
  onCreateApplication,
  onUpdateApplication,
  onDeleteApplication,
  onDisburseApplication,
  onPreviewAttachment,
  onGoToLoans,
}: LoanApplicationsViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | LoanApplicationStatus>('all');

  // Detail modal
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedApp = useMemo(
    () => applications.find((a) => a.id === selectedId) || null,
    [applications, selectedId]
  );

  // Add / Edit modal
  const [formOpen, setFormOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<LoanApplication | null>(null);
  const [applicationNumber, setApplicationNumber] = useState('');
  const [applicantName, setApplicantName] = useState('');
  const [nik, setNik] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [occupation, setOccupation] = useState('');
  const [requestDate, setRequestDate] = useState(todayISO());
  const [visitDate, setVisitDate] = useState('');
  const [requestedAmountText, setRequestedAmountText] = useState('');
  const [collateralNotes, setCollateralNotes] = useState('');
  const [visitSurveyNotes, setVisitSurveyNotes] = useState('');
  const [surveyorName, setSurveyorName] = useState('');
  const [visitChecked, setVisitChecked] = useState(false);
  const [status, setStatus] = useState<LoanApplicationStatus>('MENUNGGU_VISIT');
  const [attachment, setAttachment] = useState<Attachment | undefined>(undefined);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Visit / Finalisasi modal
  const [reviewTarget, setReviewTarget] = useState<LoanApplication | null>(null);
  const [reviewVisitDate, setReviewVisitDate] = useState(todayISO());
  const [reviewSurveyor, setReviewSurveyor] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewVisitChecked, setReviewVisitChecked] = useState(true);
  const [reviewStatus, setReviewStatus] = useState<LoanApplicationStatus>('MENUNGGU_FINALISASI');
  const [reviewAttachment, setReviewAttachment] = useState<Attachment | undefined>(undefined);
  const [reviewError, setReviewError] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);

  // Disburse to Loan modal
  const [disburseTarget, setDisburseTarget] = useState<LoanApplication | null>(null);
  const [loanTxNumber, setLoanTxNumber] = useState('');
  const [loanDate, setLoanDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState('');
  const [principalText, setPrincipalText] = useState('');
  const [adminFeeText, setAdminFeeText] = useState('25.000');
  const [interestText, setInterestText] = useState('0');
  const [interestManual, setInterestManual] = useState(false);
  const [loanDescription, setLoanDescription] = useState('');
  const [disburseError, setDisburseError] = useState('');
  const [disbursing, setDisbursing] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<LoanApplication | null>(null);
  const [deleting, setDeleting] = useState(false);

  const counts = useMemo(() => {
    const perluVisit = applications.filter((a) => a.status === 'MENUNGGU_VISIT');
    const menungguFinalisasi = applications.filter((a) => a.status === 'MENUNGGU_FINALISASI');
    const lolos = applications.filter((a) => a.status === 'LOLOS');
    const tidakLolos = applications.filter((a) => a.status === 'TIDAK_LOLOS');
    const nominalMenunggu = [...perluVisit, ...menungguFinalisasi].reduce(
      (sum, a) => sum + a.requestedAmount,
      0
    );
    const siapCairCount = lolos.filter((a) => !a.disbursedLoanId).length;
    return {
      perluVisit: perluVisit.length,
      menungguFinalisasi: menungguFinalisasi.length,
      lolos: lolos.length,
      tidakLolos: tidakLolos.length,
      siapCairCount,
      nominalMenunggu,
    };
  }, [applications]);

  const sortedApplications = useMemo(() => {
    return [...applications].sort((a, b) => {
      const pa = STATUS_META[a.status].priority;
      const pb = STATUS_META[b.status].priority;
      if (pa !== pb) return pa - pb;
      return b.requestDate.localeCompare(a.requestDate) || b.createdAt.localeCompare(a.createdAt);
    });
  }, [applications]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortedApplications.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (q) {
        const hay = `${a.applicationNumber} ${a.applicantName} ${a.nik} ${a.phone} ${a.address} ${a.occupation} ${a.collateralNotes} ${a.visitSurveyNotes}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sortedApplications, statusFilter, search]);

  const printQueue = useMemo(() => {
    if (statusFilter !== 'all') return filtered;
    const visitFirst = filtered.filter(
      (a) => a.status === 'MENUNGGU_VISIT' || a.status === 'MENUNGGU_FINALISASI'
    );
    return visitFirst.length > 0 ? visitFirst : filtered;
  }, [filtered, statusFilter]);

  const openAddModal = () => {
    const today = todayISO();
    const nums = applications.map((a) => a.applicationNumber);
    setEditingApp(null);
    setApplicationNumber(generateTxNumber('PGJ', today, nums));
    setApplicantName('');
    setNik('');
    setPhone('');
    setAddress('');
    setOccupation('');
    setRequestDate(today);
    setVisitDate(today);
    setRequestedAmountText('');
    setCollateralNotes('');
    setVisitSurveyNotes('');
    setSurveyorName(currentUserName);
    setVisitChecked(false);
    setStatus('MENUNGGU_VISIT');
    setAttachment(undefined);
    setFormError('');
    setFormOpen(true);
  };

  const openEditModal = (app: LoanApplication) => {
    setEditingApp(app);
    setApplicationNumber(app.applicationNumber);
    setApplicantName(app.applicantName);
    setNik(app.nik || '');
    setPhone(app.phone || '');
    setAddress(app.address);
    setOccupation(app.occupation || '');
    setRequestDate(app.requestDate);
    setVisitDate(app.visitDate || '');
    setRequestedAmountText(formatNumericDots(app.requestedAmount));
    setCollateralNotes(app.collateralNotes || '');
    setVisitSurveyNotes(app.visitSurveyNotes || '');
    setSurveyorName(app.surveyorName || currentUserName);
    setVisitChecked(app.visitChecked);
    setStatus(app.status);
    setAttachment(app.attachment);
    setFormError('');
    setFormOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const amount = parseNumericDots(requestedAmountText);
    if (!applicantName.trim()) {
      setFormError('Nama calon nasabah wajib diisi.');
      return;
    }
    if (!address.trim()) {
      setFormError('Alamat lengkap / lokasi visit lapangan wajib diisi agar petugas dapat melakukan pengecekan.');
      return;
    }
    if (!requestDate) {
      setFormError('Tanggal pengajuan wajib diisi.');
      return;
    }
    if (!(amount > 0)) {
      setFormError('Nominal pengajuan pinjaman harus lebih dari Rp 0.');
      return;
    }

    const nextVisitChecked =
      status === 'MENUNGGU_VISIT' ? visitChecked : true;

    setSaving(true);
    try {
      const payload: Omit<LoanApplication, 'id' | 'createdAt' | 'updatedAt'> = {
        applicationNumber: applicationNumber.trim(),
        applicantName: applicantName.trim(),
        nik: nik.trim(),
        phone: phone.trim(),
        address: address.trim(),
        occupation: occupation.trim(),
        requestDate,
        visitDate: visitDate.trim(),
        requestedAmount: amount,
        collateralNotes: collateralNotes.trim(),
        visitSurveyNotes: visitSurveyNotes.trim(),
        visitChecked: nextVisitChecked,
        status,
        surveyorName: surveyorName.trim(),
        disbursedLoanId: editingApp?.disbursedLoanId,
        attachment,
        createdBy: editingApp ? editingApp.createdBy : currentUserName,
      };
      if (editingApp) {
        await onUpdateApplication(editingApp, payload);
      } else {
        await onCreateApplication(payload);
      }
      setFormOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan data calon nasabah.');
    } finally {
      setSaving(false);
    }
  };

  const openReviewModal = (app: LoanApplication) => {
    setReviewTarget(app);
    setReviewVisitDate(app.visitDate || todayISO());
    setReviewSurveyor(app.surveyorName || currentUserName);
    setReviewNotes(app.visitSurveyNotes || '');
    setReviewVisitChecked(true);
    setReviewStatus(
      app.status === 'MENUNGGU_VISIT' ? 'MENUNGGU_FINALISASI' : app.status
    );
    setReviewAttachment(app.attachment);
    setReviewError('');
  };

  const handleSaveReview = async (targetStatus: LoanApplicationStatus) => {
    if (!reviewTarget) return;
    setReviewError('');
    if (targetStatus === 'TIDAK_LOLOS' && !reviewNotes.trim()) {
      setReviewError('Tuliskan catatan/alasan hasil visit mengapa pengajuan tidak lolos.');
      return;
    }

    setReviewSaving(true);
    try {
      await onUpdateApplication(reviewTarget, {
        applicationNumber: reviewTarget.applicationNumber,
        applicantName: reviewTarget.applicantName,
        nik: reviewTarget.nik,
        phone: reviewTarget.phone,
        address: reviewTarget.address,
        occupation: reviewTarget.occupation,
        requestDate: reviewTarget.requestDate,
        visitDate: reviewVisitDate || todayISO(),
        requestedAmount: reviewTarget.requestedAmount,
        collateralNotes: reviewTarget.collateralNotes,
        visitSurveyNotes: reviewNotes.trim(),
        visitChecked: targetStatus === 'MENUNGGU_VISIT' ? reviewVisitChecked : true,
        status: targetStatus,
        surveyorName: reviewSurveyor.trim() || currentUserName,
        disbursedLoanId: reviewTarget.disbursedLoanId,
        attachment: reviewAttachment,
        createdBy: reviewTarget.createdBy,
      });
      setReviewTarget(null);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Gagal menyimpan hasil visit & finalisasi.');
    } finally {
      setReviewSaving(false);
    }
  };

  const openDisburseModal = (app: LoanApplication) => {
    const today = todayISO();
    const principal = app.requestedAmount;
    const autoInterest = Math.round(principal * 0.2);
    setDisburseTarget(app);
    setLoanTxNumber(generateTxNumber('PJ', today, existingLoanNumbers));
    setLoanDate(today);
    setDueDate(defaultDueDate(today));
    setPrincipalText(formatNumericDots(principal));
    setAdminFeeText('25.000');
    setInterestText(formatNumericDots(autoInterest) || '0');
    setInterestManual(false);
    setLoanDescription(
      [
        `Pencairan pengajuan ${app.applicationNumber}`,
        app.collateralNotes ? `Jaminan: ${app.collateralNotes}` : '',
        app.visitSurveyNotes ? `Survei: ${app.visitSurveyNotes}` : '',
      ]
        .filter(Boolean)
        .join(' · ')
    );
    setDisburseError('');
  };

  const disbursePrincipal = parseNumericDots(principalText);
  const disburseAdminFee = parseNumericDots(adminFeeText);
  const disburseInterest = parseNumericDots(interestText);
  const disburseTotal = disbursePrincipal + disburseInterest;
  const disburseNet = Math.max(0, disbursePrincipal - disburseAdminFee);

  const handleDisburseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disburseTarget) return;
    setDisburseError('');
    if (!(disbursePrincipal > 0)) {
      setDisburseError('Pokok pinjaman harus lebih dari Rp 0.');
      return;
    }
    if (disburseAdminFee > disbursePrincipal) {
      setDisburseError('Uang administrasi tidak boleh melebihi pokok pinjaman.');
      return;
    }
    if (!loanDate || !dueDate) {
      setDisburseError('Tanggal pinjam dan jatuh tempo wajib diisi.');
      return;
    }
    if (dueDate < loanDate) {
      setDisburseError('Tanggal jatuh tempo tidak boleh lebih awal dari tanggal pinjam.');
      return;
    }

    setDisbursing(true);
    try {
      await onDisburseApplication(disburseTarget, {
        txNumber: loanTxNumber.trim(),
        borrowerName: disburseTarget.applicantName,
        memberId: disburseTarget.nik || disburseTarget.applicationNumber,
        phone: disburseTarget.phone,
        loanDate,
        dueDate,
        principalAmount: disbursePrincipal,
        adminFee: disburseAdminFee,
        interestAmount: disburseInterest,
        totalAmount: disburseTotal,
        description: loanDescription.trim(),
        attachment: disburseTarget.attachment,
        createdBy: currentUserName,
      });
      setDisburseTarget(null);
      onGoToLoans();
    } catch (err) {
      setDisburseError(
        err instanceof Error ? err.message : 'Gagal mencairkan pengajuan ke pinjaman.'
      );
    } finally {
      setDisbursing(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await onDeleteApplication(deleteTarget.id);
      if (selectedId === deleteTarget.id) setSelectedId(null);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const formRequestedAmount = parseNumericDots(requestedAmountText);
  const formEstInterest = Math.round(formRequestedAmount * 0.2);
  const formEstAdmin = 25000;
  const formEstNet = Math.max(0, formRequestedAmount - formEstAdmin);

  return (
    <div className="space-y-6">
      {/* Print-Only Visit Sheet */}
      <div className="print-only hidden border-b-2 border-[#083320] pb-4 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold tracking-wider text-[#0D4A2E] uppercase">
              Koperasi Simpan Pinjam Cendana Artha Mandiri
            </p>
            <h1 className="font-display text-xl font-bold text-[#0F1F17]">
              Daftar Antrean Visit Lapangan &amp; Finalisasi Calon Nasabah
            </h1>
            <p className="mt-1 text-xs text-[#425449]">
              Dicetak tanggal {formatDateID(todayISO())} oleh {currentUserName} · Total{' '}
              {printQueue.length} calon nasabah
            </p>
          </div>
        </div>

        <table className="mt-4 w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-y border-[#083320] bg-[#F6F8F6]">
              <th className="py-2 px-2 font-semibold">No</th>
              <th className="py-2 px-2 font-semibold">Calon Nasabah</th>
              <th className="py-2 px-2 font-semibold">Alamat / Lokasi Visit</th>
              <th className="py-2 px-2 font-semibold">No. HP</th>
              <th className="py-2 px-2 font-semibold text-right">Pengajuan</th>
              <th className="py-2 px-2 font-semibold">Status &amp; Jadwal</th>
              <th className="py-2 px-2 font-semibold">Catatan Visit &amp; Paraf</th>
            </tr>
          </thead>
          <tbody>
            {printQueue.map((item, idx) => (
              <tr key={item.id} className="border-b border-[#DCE4DE] align-top">
                <td className="py-2 px-2 font-mono">{idx + 1}</td>
                <td className="py-2 px-2">
                  <p className="font-bold text-[#0F1F17]">{item.applicantName}</p>
                  <p className="font-mono text-[10px] text-[#5C6E63]">
                    {item.applicationNumber}
                    {item.nik ? ` · ${item.nik}` : ''}
                  </p>
                  {item.occupation && (
                    <p className="text-[10px] text-[#5C6E63]">Usaha: {item.occupation}</p>
                  )}
                </td>
                <td className="py-2 px-2">{item.address}</td>
                <td className="py-2 px-2 font-mono">{item.phone || '-'}</td>
                <td className="py-2 px-2 text-right font-mono font-semibold">
                  {formatRupiah(item.requestedAmount)}
                </td>
                <td className="py-2 px-2">
                  <p className="font-semibold">{STATUS_META[item.status].shortLabel}</p>
                  {item.visitDate && (
                    <p className="text-[10px] text-[#5C6E63]">
                      Visit: {formatDateID(item.visitDate)}
                    </p>
                  )}
                </td>
                <td className="py-2 px-2 min-w-[140px]">
                  {item.visitSurveyNotes ? (
                    <p className="text-[11px]">{item.visitSurveyNotes}</p>
                  ) : (
                    <p className="text-[10px] text-[#6C7E73] italic">
                      [ ] Layak / [ ] Tidak · Paraf: _______
                    </p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Screen Header */}
      <div className="no-print flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0F1F17]">
            Calon Nasabah &amp; Visit Lapangan
          </h1>
          <p className="mt-1 text-sm text-[#5C6E63]">
            Catat calon peminjam yang menunggu survei visit lapangan dan finalisasi status Lolos atau Tidak Lolos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            disabled={printQueue.length === 0}
            className="flex min-h-[42px] items-center justify-center gap-2 rounded-xl border border-[#DCE4DE] bg-white px-4 py-2 text-sm font-semibold text-[#0F1F17] transition-colors hover:bg-[#F1F5F2] disabled:opacity-50 whitespace-nowrap"
          >
            <Printer className="h-4 w-4 text-[#0D4A2E]" />
            <span>Cetak Daftar Visit</span>
          </button>
          <button
            type="button"
            onClick={openAddModal}
            className="flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-[#0D4A2E] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#083320] whitespace-nowrap"
          >
            <Plus className="h-4 w-4 text-[#DFB848]" />
            <span>Input Calon Nasabah</span>
          </button>
        </div>
      </div>

      {/* 4 Pipeline Summary Cards */}
      <div className="no-print grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          onClick={() =>
            setStatusFilter(statusFilter === 'MENUNGGU_VISIT' ? 'all' : 'MENUNGGU_VISIT')
          }
          className={`rounded-xl border p-4 text-left transition-colors ${
            statusFilter === 'MENUNGGU_VISIT'
              ? 'border-amber-400 bg-amber-50/70'
              : 'border-[#DCE4DE] bg-white hover:bg-[#FAFBF9]'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-amber-800">Perlu Visit Lapangan</p>
            <MapPin className="h-4 w-4 text-amber-700" />
          </div>
          <p className="mt-1.5 font-mono text-2xl font-bold text-[#0F1F17] tabular-nums">
            {counts.perluVisit} Nasabah
          </p>
          <p className="mt-1 text-xs text-[#5C6E63]">
            Belum dicek lapangan · klik untuk filter
          </p>
        </button>

        <button
          type="button"
          onClick={() =>
            setStatusFilter(
              statusFilter === 'MENUNGGU_FINALISASI' ? 'all' : 'MENUNGGU_FINALISASI'
            )
          }
          className={`rounded-xl border p-4 text-left transition-colors ${
            statusFilter === 'MENUNGGU_FINALISASI'
              ? 'border-blue-400 bg-blue-50/70'
              : 'border-[#DCE4DE] bg-white hover:bg-[#FAFBF9]'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-blue-800">Menunggu Finalisasi</p>
            <ClipboardCheck className="h-4 w-4 text-blue-700" />
          </div>
          <p className="mt-1.5 font-mono text-2xl font-bold text-[#0F1F17] tabular-nums">
            {counts.menungguFinalisasi} Nasabah
          </p>
          <p className="mt-1 text-xs text-[#5C6E63]">
            Sudah visit · tentukan Lolos / Tidak
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'LOLOS' ? 'all' : 'LOLOS')}
          className={`rounded-xl border p-4 text-left transition-colors ${
            statusFilter === 'LOLOS'
              ? 'border-emerald-400 bg-emerald-50/70'
              : 'border-[#DCE4DE] bg-white hover:bg-[#FAFBF9]'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-emerald-800">Lolos / Disetujui</p>
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
          </div>
          <p className="mt-1.5 font-mono text-2xl font-bold text-[#0D4A2E] tabular-nums">
            {counts.lolos} Nasabah
          </p>
          <p className="mt-1 text-xs text-[#5C6E63]">
            {counts.siapCairCount > 0
              ? `${counts.siapCairCount} pengajuan siap dicairkan`
              : 'Semua pengajuan lolos telah diproses'}
          </p>
        </button>

        <div className="rounded-xl border border-[#0D4A2E] bg-[#083320] p-4 text-white">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[#DFB848]">
              Estimasi Pengajuan Antrean
            </p>
            <HandCoins className="h-4 w-4 text-[#DFB848]" />
          </div>
          <p className="mt-1.5 font-mono text-xl font-bold text-white tabular-nums">
            {formatRupiah(counts.nominalMenunggu)}
          </p>
          <p className="mt-1 text-xs text-emerald-100/75">
            Saldo kas saat ini: {formatRupiah(currentCashBalance)}
          </p>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="no-print flex flex-col gap-3 rounded-xl border border-[#DCE4DE] bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { key: 'all', label: `Semua (${applications.length})` },
              { key: 'MENUNGGU_VISIT', label: `Perlu Visit (${counts.perluVisit})` },
              {
                key: 'MENUNGGU_FINALISASI',
                label: `Tunggu Finalisasi (${counts.menungguFinalisasi})`,
              },
              { key: 'LOLOS', label: `Lolos (${counts.lolos})` },
              { key: 'TIDAK_LOLOS', label: `Tidak Lolos (${counts.tidakLolos})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                statusFilter === tab.key
                  ? 'bg-[#083320] text-white'
                  : 'border border-[#DCE4DE] bg-[#F8FAF8] text-[#425449] hover:bg-[#EFF5F1]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6C7E73]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama calon nasabah, alamat visit, no. HP, NIK, atau nomor pengajuan..."
            className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] bg-[#F8FAF8] pl-9 pr-3 text-sm text-[#0F1F17] focus:border-[#0D4A2E] focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      {/* Applications List */}
      {filtered.length === 0 ? (
        <div className="no-print rounded-xl border border-dashed border-[#DCE4DE] bg-white px-6 py-12 text-center">
          <MapPin className="mx-auto h-9 w-9 text-[#9AAEA2]" />
          <p className="mt-3 font-display text-base font-bold text-[#0F1F17]">
            {applications.length === 0
              ? 'Belum Ada Data Calon Nasabah'
              : 'Tidak Ada Data yang Cocok'}
          </p>
          <p className="mt-1 text-sm text-[#5C6E63]">
            {applications.length === 0
              ? 'Tambahkan calon nasabah yang ingin meminjam agar petugas tahu siapa saja yang harus dicek visit lapangan.'
              : 'Coba ubah filter status atau kata kunci pencarian Anda.'}
          </p>
          {applications.length === 0 && (
            <button
              type="button"
              onClick={openAddModal}
              className="mt-4 inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[#0D4A2E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#083320]"
            >
              <Plus className="h-4 w-4 text-[#DFB848]" />
              <span>Input Calon Nasabah Pertama</span>
            </button>
          )}
        </div>
      ) : (
        <div className="no-print grid grid-cols-1 gap-4">
          {filtered.map((app) => {
            const meta = STATUS_META[app.status];
            const estInterest = Math.round(app.requestedAmount * 0.2);
            const estNet = Math.max(0, app.requestedAmount - 25000);

            return (
              <div
                key={app.id}
                className="rounded-xl border border-[#DCE4DE] bg-white p-4 sm:p-5 transition-colors hover:border-[#B6C7BC]"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  {/* Left: Identity & Visit Address */}
                  <div className="min-w-0 flex-1 space-y-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-[#0D4A2E]">
                        {app.applicationNumber}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-[11px] font-semibold ${meta.badgeClass}`}
                      >
                        {meta.label}
                      </span>
                      {app.visitChecked && app.status !== 'MENUNGGU_VISIT' && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-[#DCE4DE] bg-[#F8FAF8] px-2 py-0.5 text-[11px] font-medium text-[#425449]">
                          <ClipboardCheck className="h-3 w-3 text-[#0D4A2E]" />
                          <span>Sudah Visit</span>
                        </span>
                      )}
                      {app.disbursedLoanId && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-[#083320]">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Sudah Dicairkan</span>
                        </span>
                      )}
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => setSelectedId(app.id)}
                        className="text-left font-display text-lg font-bold text-[#0F1F17] hover:text-[#0D4A2E] hover:underline"
                      >
                        {app.applicantName}
                      </button>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#5C6E63]">
                        {app.nik && (
                          <span className="inline-flex items-center gap-1">
                            <User className="h-3.5 w-3.5" />
                            <span>NIK/ID: {app.nik}</span>
                          </span>
                        )}
                        {app.phone && (
                          <span className="inline-flex items-center gap-1 font-mono">
                            <Phone className="h-3.5 w-3.5" />
                            <span>{app.phone}</span>
                          </span>
                        )}
                        {app.occupation && (
                          <span className="inline-flex items-center gap-1">
                            <Briefcase className="h-3.5 w-3.5" />
                            <span>{app.occupation}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Alamat Visit Lapangan Box */}
                    <div className="flex items-start gap-2 rounded-lg border border-[#DCE4DE] bg-[#F8FAF8] px-3 py-2 text-xs text-[#2A3B31]">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#0D4A2E]" />
                      <div className="min-w-0">
                        <span className="font-semibold text-[#0F1F17]">
                          Lokasi Visit Lapangan:{' '}
                        </span>
                        <span>{app.address}</span>
                      </div>
                    </div>

                    {(app.collateralNotes || app.visitSurveyNotes) && (
                      <div className="space-y-1 text-xs text-[#425449]">
                        {app.collateralNotes && (
                          <p>
                            <span className="font-semibold text-[#0F1F17]">
                              Jaminan / Keterangan:
                            </span>{' '}
                            {app.collateralNotes}
                          </p>
                        )}
                        {app.visitSurveyNotes && (
                          <p>
                            <span className="font-semibold text-[#0D4A2E]">
                              Hasil Visit ({app.surveyorName || 'Petugas'}):
                            </span>{' '}
                            {app.visitSurveyNotes}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right: Nominal, Dates & Actions */}
                  <div className="flex flex-col gap-3 border-t border-[#EBF0EC] pt-3 lg:w-[320px] lg:shrink-0 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-medium text-[#5C6E63]">
                          Nominal Pengajuan
                        </p>
                        <p className="font-mono text-lg font-bold text-[#0F1F17] tabular-nums">
                          {formatRupiah(app.requestedAmount)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#5C6E63] tabular-nums">
                          Est. cair {formatRupiah(estNet)} · Bunga 20% {formatRupiah(estInterest)}
                        </p>
                      </div>
                      <div className="text-right text-[11px] text-[#5C6E63]">
                        <p>Ajuan: {formatDateID(app.requestDate)}</p>
                        <p className="mt-0.5 font-semibold text-[#0D4A2E]">
                          {app.visitDate
                            ? `Visit: ${formatDateID(app.visitDate)}`
                            : 'Jadwal visit belum diatur'}
                        </p>
                      </div>
                    </div>

                    {/* Primary Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                      {(app.status === 'MENUNGGU_VISIT' ||
                        app.status === 'MENUNGGU_FINALISASI') && (
                        <button
                          type="button"
                          onClick={() => openReviewModal(app)}
                          className="flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#0D4A2E] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#083320] whitespace-nowrap"
                        >
                          <ClipboardCheck className="h-3.5 w-3.5 text-[#DFB848]" />
                          <span>
                            {app.status === 'MENUNGGU_VISIT'
                              ? 'Catat Visit & Finalisasi'
                              : 'Finalisasi: Lolos / Tidak'}
                          </span>
                        </button>
                      )}

                      {app.status === 'LOLOS' && !app.disbursedLoanId && (
                        <button
                          type="button"
                          onClick={() => openDisburseModal(app)}
                          className="flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#C59B27] bg-[#FEF9E7] px-3 py-1.5 text-xs font-semibold text-[#7D5D0F] hover:bg-[#FDF3CC] whitespace-nowrap"
                        >
                          <HandCoins className="h-3.5 w-3.5" />
                          <span>Cairkan ke Pinjaman</span>
                        </button>
                      )}

                      {app.attachment && (
                        <button
                          type="button"
                          onClick={() => onPreviewAttachment(app.attachment!)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#DCE4DE] text-[#0D4A2E] hover:bg-[#EFF5F1]"
                          title="Lihat Lampiran"
                          aria-label="Lihat Lampiran"
                        >
                          <Paperclip className="h-4 w-4" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => openEditModal(app)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#DCE4DE] text-[#425449] hover:bg-[#F1F5F2]"
                        title="Ubah Data"
                        aria-label="Ubah Data"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteTarget(app)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                        title="Hapus Pengajuan"
                        aria-label="Hapus Pengajuan"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selectedApp && (
        <div
          className="no-print fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-[#DCE4DE] bg-white p-5 sm:p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-[#EBF0EC] pb-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-[#0D4A2E]">
                    {selectedApp.applicationNumber}
                  </span>
                  <span
                    className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${STATUS_META[selectedApp.status].badgeClass}`}
                  >
                    {STATUS_META[selectedApp.status].label}
                  </span>
                </div>
                <h2 className="mt-1 font-display text-xl font-bold text-[#0F1F17]">
                  {selectedApp.applicantName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#5C6E63] hover:bg-[#F1F5F2]"
                aria-label="Tutup Detail"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-sm">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 rounded-xl border border-[#DCE4DE] bg-[#F8FAF8] p-4">
                <div>
                  <p className="text-xs text-[#5C6E63]">Nominal Pengajuan</p>
                  <p className="font-mono text-lg font-bold text-[#0F1F17] tabular-nums">
                    {formatRupiah(selectedApp.requestedAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#5C6E63]">Tanggal Ajuan / Jadwal Visit</p>
                  <p className="font-mono text-xs font-semibold text-[#0F1F17]">
                    Ajuan: {formatDateID(selectedApp.requestDate)}
                  </p>
                  <p className="font-mono text-xs font-semibold text-[#0D4A2E]">
                    Visit: {selectedApp.visitDate ? formatDateID(selectedApp.visitDate) : '-'}
                  </p>
                </div>
              </div>

              <div className="space-y-2.5 rounded-xl border border-[#DCE4DE] p-4">
                <div>
                  <p className="text-xs text-[#5C6E63]">Alamat / Lokasi Visit Lapangan</p>
                  <p className="mt-0.5 font-medium text-[#0F1F17]">{selectedApp.address}</p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-[#5C6E63]">NIK / No. Anggota</p>
                    <p className="font-medium text-[#0F1F17]">{selectedApp.nik || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#5C6E63]">No. HP / WhatsApp</p>
                    <p className="font-mono font-medium text-[#0F1F17]">
                      {selectedApp.phone || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#5C6E63]">Pekerjaan / Usaha</p>
                    <p className="font-medium text-[#0F1F17]">
                      {selectedApp.occupation || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#5C6E63]">Petugas Visit</p>
                    <p className="font-medium text-[#0F1F17]">
                      {selectedApp.surveyorName || '-'}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-[#5C6E63]">Jaminan / Keterangan Awal</p>
                  <p className="mt-0.5 text-[#2A3B31]">
                    {selectedApp.collateralNotes || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#5C6E63]">Catatan Hasil Visit &amp; Finalisasi</p>
                  <p className="mt-0.5 text-[#2A3B31]">
                    {selectedApp.visitSurveyNotes || 'Belum ada catatan hasil visit lapangan.'}
                  </p>
                </div>
                {selectedApp.attachment && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => onPreviewAttachment(selectedApp.attachment!)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#DCE4DE] bg-[#F8FAF8] px-3 py-2 text-xs font-semibold text-[#0D4A2E] hover:bg-[#EFF5F1]"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      <span>Lihat Lampiran ({selectedApp.attachment.name})</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#EBF0EC] pt-4">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(selectedApp)}
                  className="min-h-[40px] rounded-lg border border-red-200 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                >
                  Hapus
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  {(selectedApp.status === 'MENUNGGU_VISIT' ||
                    selectedApp.status === 'MENUNGGU_FINALISASI') && (
                    <button
                      type="button"
                      onClick={() => {
                        const t = selectedApp;
                        setSelectedId(null);
                        openReviewModal(t);
                      }}
                      className="min-h-[40px] rounded-lg bg-[#0D4A2E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#083320]"
                    >
                      Catat Visit / Finalisasi
                    </button>
                  )}
                  {selectedApp.status === 'LOLOS' && !selectedApp.disbursedLoanId && (
                    <button
                      type="button"
                      onClick={() => {
                        const t = selectedApp;
                        setSelectedId(null);
                        openDisburseModal(t);
                      }}
                      className="min-h-[40px] rounded-lg border border-[#C59B27] bg-[#FEF9E7] px-4 py-2 text-xs font-semibold text-[#7D5D0F] hover:bg-[#FDF3CC]"
                    >
                      Cairkan ke Pinjaman
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="min-h-[40px] rounded-lg border border-[#DCE4DE] px-4 py-2 text-xs font-semibold text-[#2A3B31] hover:bg-[#F6F8F6]"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {formOpen && (
        <div
          className="no-print fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-[#DCE4DE] bg-white p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#EBF0EC] pb-3.5">
              <h2 className="font-display text-lg font-bold text-[#0F1F17]">
                {editingApp ? 'Ubah Data Calon Nasabah' : 'Input Calon Nasabah Baru'}
              </h2>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#5C6E63] hover:bg-[#F1F5F2]"
                aria-label="Tutup Form"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                    Nomor Pengajuan
                  </label>
                  <input
                    type="text"
                    value={applicationNumber}
                    onChange={(e) => setApplicationNumber(e.target.value)}
                    required
                    className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] bg-[#F8FAF8] px-3 font-mono text-sm font-semibold text-[#0D4A2E] focus:border-[#0D4A2E] focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                    Nama Lengkap Calon Nasabah
                  </label>
                  <input
                    type="text"
                    value={applicantName}
                    onChange={(e) => setApplicantName(e.target.value)}
                    placeholder="Contoh: Ibu Siti Aminah"
                    required
                    className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] bg-white px-3 text-sm text-[#0F1F17] focus:border-[#0D4A2E] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                    NIK / No. KTP <span className="font-normal text-[#6C7E73]">(Opsional)</span>
                  </label>
                  <input
                    type="text"
                    value={nik}
                    onChange={(e) => setNik(e.target.value)}
                    placeholder="3201xxxxxxxxxxxx"
                    className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] bg-white px-3 text-sm text-[#0F1F17] focus:border-[#0D4A2E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                    No. HP / WhatsApp <span className="font-normal text-[#6C7E73]">(Opsional)</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="08xxxxxxxxxx"
                    className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] bg-white px-3 text-sm text-[#0F1F17] focus:border-[#0D4A2E] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                  Alamat Lengkap / Lokasi Visit Lapangan
                </label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Jl. / RT / RW / Desa / Patokan lokasi untuk petugas visit lapangan..."
                  required
                  className="w-full rounded-lg border border-[#DCE4DE] bg-white px-3 py-2 text-sm text-[#0F1F17] focus:border-[#0D4A2E] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                    Pekerjaan / Jenis Usaha{' '}
                    <span className="font-normal text-[#6C7E73]">(Opsional)</span>
                  </label>
                  <input
                    type="text"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    placeholder="Contoh: Warung Sembako"
                    className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] bg-white px-3 text-sm text-[#0F1F17] focus:border-[#0D4A2E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                    Nominal Pengajuan Pinjaman (Rp)
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm font-semibold text-[#5C6E63]">
                      Rp
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={requestedAmountText}
                      onChange={(e) =>
                        setRequestedAmountText(formatNumericDots(e.target.value))
                      }
                      placeholder="1.000.000"
                      required
                      className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] bg-white pl-10 pr-3 font-mono text-sm font-bold text-[#0F1F17] tabular-nums focus:border-[#0D4A2E] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {formRequestedAmount > 0 && (
                <div className="rounded-lg border border-[#C59B27]/50 bg-[#FFFDF5] px-3.5 py-2.5 text-xs text-[#425449]">
                  <p className="font-semibold text-[#0F1F17]">
                    Simulasi Pencairan (Hitung Pintar):
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono tabular-nums">
                    <span>Cair Bersih (-Admin 25rb): {formatRupiah(formEstNet)}</span>
                    <span>Bunga 20%: {formatRupiah(formEstInterest)}</span>
                    <span className="font-semibold text-[#0D4A2E]">
                      Tagihan: {formatRupiah(formRequestedAmount + formEstInterest)}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                    Tanggal Pengajuan{' '}
                    <span className="font-normal text-[#5C6E63]">(Tgl/Bln/Thn)</span>
                  </label>
                  <DateInputID
                    value={requestDate}
                    onChange={(val) => {
                      setRequestDate(val);
                      if (!editingApp && val) {
                        setApplicationNumber(
                          generateTxNumber(
                            'PGJ',
                            val,
                            applications.map((a) => a.applicationNumber)
                          )
                        );
                      }
                    }}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                    Rencana Visit Lapangan{' '}
                    <span className="font-normal text-[#5C6E63]">(Tgl/Bln/Thn)</span>
                  </label>
                  <DateInputID value={visitDate} onChange={setVisitDate} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                    Status Visit &amp; Finalisasi
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as LoanApplicationStatus)}
                    className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] bg-white px-3 text-sm font-medium text-[#0F1F17] focus:border-[#0D4A2E] focus:outline-none"
                  >
                    <option value="MENUNGGU_VISIT">Perlu Visit Lapangan</option>
                    <option value="MENUNGGU_FINALISASI">Sudah Visit · Menunggu Finalisasi</option>
                    <option value="LOLOS">Lolos / Disetujui</option>
                    <option value="TIDAK_LOLOS">Tidak Lolos / Ditolak</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                    Petugas Penanggung Jawab Visit
                  </label>
                  <input
                    type="text"
                    value={surveyorName}
                    onChange={(e) => setSurveyorName(e.target.value)}
                    placeholder="Nama petugas lapangan"
                    className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] bg-white px-3 text-sm text-[#0F1F17] focus:border-[#0D4A2E] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                  Jaminan / Keperluan Pinjaman{' '}
                  <span className="font-normal text-[#6C7E73]">(Opsional)</span>
                </label>
                <textarea
                  rows={2}
                  value={collateralNotes}
                  onChange={(e) => setCollateralNotes(e.target.value)}
                  placeholder="Contoh: BPKB Motor / Modal tambah stok warung..."
                  className="w-full rounded-lg border border-[#DCE4DE] bg-white px-3 py-2 text-sm text-[#0F1F17] focus:border-[#0D4A2E] focus:outline-none"
                />
              </div>

              <AttachmentField
                value={attachment}
                onChange={setAttachment}
                onPreview={onPreviewAttachment}
                label="Lampiran Foto KTP / Lokasi Usaha / Rumah (Foto / PDF)"
              />

              {formError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {formError}
                </p>
              )}

              <div className="flex flex-col-reverse gap-2 border-t border-[#EBF0EC] pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="min-h-[42px] rounded-lg border border-[#DCE4DE] px-4 py-2 text-sm font-medium text-[#2A3B31] hover:bg-[#F6F8F6]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[42px] rounded-lg bg-[#0D4A2E] px-5 py-2 text-sm font-semibold text-white hover:bg-[#083320] disabled:opacity-60"
                >
                  {saving ? 'Menyimpan...' : editingApp ? 'Simpan Perubahan' : 'Simpan ke Antrean Visit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Visit & Finalisasi Modal */}
      {reviewTarget && (
        <div
          className="no-print fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-[#DCE4DE] bg-white p-5 sm:p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-[#EBF0EC] pb-3.5">
              <div>
                <p className="font-mono text-xs font-semibold text-[#0D4A2E]">
                  {reviewTarget.applicationNumber}
                </p>
                <h2 className="font-display text-lg font-bold text-[#0F1F17]">
                  Visit Lapangan &amp; Finalisasi: {reviewTarget.applicantName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setReviewTarget(null)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#5C6E63] hover:bg-[#F1F5F2]"
                aria-label="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-[#DCE4DE] bg-[#F8FAF8] p-3 text-xs text-[#2A3B31]">
                <p>
                  <span className="font-semibold text-[#0F1F17]">Alamat Visit:</span>{' '}
                  {reviewTarget.address}
                </p>
                <p className="mt-1">
                  <span className="font-semibold text-[#0F1F17]">Pengajuan:</span>{' '}
                  <span className="font-mono font-bold text-[#0D4A2E]">
                    {formatRupiah(reviewTarget.requestedAmount)}
                  </span>
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                    Tanggal Visit Lapangan{' '}
                    <span className="font-normal text-[#5C6E63]">(Tgl/Bln/Thn)</span>
                  </label>
                  <DateInputID value={reviewVisitDate} onChange={setReviewVisitDate} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                    Nama Petugas Visit
                  </label>
                  <input
                    type="text"
                    value={reviewSurveyor}
                    onChange={(e) => setReviewSurveyor(e.target.value)}
                    placeholder="Nama petugas"
                    className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] bg-white px-3 text-sm text-[#0F1F17] focus:border-[#0D4A2E] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                  Catatan Hasil Visit Lapangan / Keputusan Finalisasi
                </label>
                <textarea
                  rows={3}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Contoh: Rumah & usaha warung sesuai alamat, penghasilan harian lancar / Tidak sesuai alamat..."
                  className="w-full rounded-lg border border-[#DCE4DE] bg-white px-3 py-2 text-sm text-[#0F1F17] focus:border-[#0D4A2E] focus:outline-none"
                />
              </div>

              <AttachmentField
                value={reviewAttachment}
                onChange={setReviewAttachment}
                onPreview={onPreviewAttachment}
                label="Foto Bukti Visit Lapangan (Opsional)"
              />

              {reviewError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {reviewError}
                </p>
              )}

              <div className="space-y-2 border-t border-[#EBF0EC] pt-4">
                <p className="text-xs font-semibold text-[#425449]">
                  Pilih Status Hasil Pengecekan:
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    disabled={reviewSaving}
                    onClick={() => void handleSaveReview('MENUNGGU_FINALISASI')}
                    className={`flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-60 ${
                      reviewStatus === 'MENUNGGU_FINALISASI'
                        ? 'border-blue-400 bg-blue-50 text-blue-800 hover:bg-blue-100'
                        : 'border-blue-200 bg-blue-50/60 text-blue-800 hover:bg-blue-100'
                    }`}
                  >
                    <CalendarClock className="h-4 w-4" />
                    <span>Tunggu Finalisasi</span>
                  </button>

                  <button
                    type="button"
                    disabled={reviewSaving}
                    onClick={() => void handleSaveReview('LOLOS')}
                    className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg bg-[#0D4A2E] px-3 py-2 text-xs font-semibold text-white hover:bg-[#083320] disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-4 w-4 text-[#DFB848]" />
                    <span>Lolos (Disetujui)</span>
                  </button>

                  <button
                    type="button"
                    disabled={reviewSaving}
                    onClick={() => void handleSaveReview('TIDAK_LOLOS')}
                    className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                  >
                    <XCircle className="h-4 w-4" />
                    <span>Tidak Lolos</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Disburse Lolos Application to Official Loan Modal */}
      {disburseTarget && (
        <div
          className="no-print fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-[#DCE4DE] bg-white p-5 sm:p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-[#EBF0EC] pb-3.5">
              <div>
                <p className="font-mono text-xs font-semibold text-[#0D4A2E]">
                  Finalisasi Lolos · {disburseTarget.applicationNumber}
                </p>
                <h2 className="font-display text-lg font-bold text-[#0F1F17]">
                  Cairkan Pinjaman: {disburseTarget.applicantName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDisburseTarget(null)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#5C6E63] hover:bg-[#F1F5F2]"
                aria-label="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleDisburseSubmit} className="mt-4 space-y-4">
              {currentCashBalance <= 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />
                  <span>
                    Saldo kas tersedia saat ini {formatRupiah(currentCashBalance)}. Saldo kas akan otomatis berkurang sesuai dana bersih pencairan.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                    Nomor Pinjaman Resmi
                  </label>
                  <input
                    type="text"
                    value={loanTxNumber}
                    onChange={(e) => setLoanTxNumber(e.target.value)}
                    required
                    className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] bg-[#F8FAF8] px-3 font-mono text-sm font-semibold text-[#0D4A2E] focus:border-[#0D4A2E] focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                    Peminjam
                  </label>
                  <input
                    type="text"
                    value={disburseTarget.applicantName}
                    disabled
                    className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] bg-[#F8FAF8] px-3 text-sm font-semibold text-[#0F1F17]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                    Tanggal Pinjam <span className="font-normal text-[#5C6E63]">(Tgl/Bln/Thn)</span>
                  </label>
                  <DateInputID
                    value={loanDate}
                    onChange={(val) => {
                      setLoanDate(val);
                      if (val) {
                        setLoanTxNumber(generateTxNumber('PJ', val, existingLoanNumbers));
                        setDueDate(defaultDueDate(val));
                      }
                    }}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                    Jatuh Tempo <span className="font-normal text-[#5C6E63]">(Tgl/Bln/Thn)</span>
                  </label>
                  <DateInputID value={dueDate} onChange={setDueDate} required />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                    Pokok Pinjaman (Rp)
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm font-semibold text-[#5C6E63]">
                      Rp
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={principalText}
                      onChange={(e) => {
                        const formatted = formatNumericDots(e.target.value);
                        setPrincipalText(formatted);
                        if (!interestManual) {
                          const p = parseNumericDots(formatted);
                          setInterestText(formatNumericDots(Math.round(p * 0.2)) || '0');
                        }
                      }}
                      required
                      className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] bg-white pl-10 pr-3 font-mono text-sm font-bold text-[#0F1F17] tabular-nums focus:border-[#0D4A2E] focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label className="block text-xs font-semibold text-[#2A3B31]">
                      Bunga 20% (Rp)
                    </label>
                    {interestManual ? (
                      <button
                        type="button"
                        onClick={() => {
                          setInterestManual(false);
                          setInterestText(
                            formatNumericDots(Math.round(disbursePrincipal * 0.2)) || '0'
                          );
                        }}
                        className="text-[11px] font-semibold text-[#0D4A2E] hover:underline"
                      >
                        Reset 20%
                      </button>
                    ) : (
                      <span className="rounded bg-[#0D4A2E]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#0D4A2E]">
                        Otomatis 20%
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm font-semibold text-[#5C6E63]">
                      Rp
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={interestText}
                      onChange={(e) => {
                        setInterestManual(true);
                        setInterestText(formatNumericDots(e.target.value) || '0');
                      }}
                      className="min-h-[42px] w-full rounded-lg border border-[#DCE4DE] bg-[#F8FAF8] pl-10 pr-3 font-mono text-sm font-bold text-[#0F1F17] tabular-nums focus:border-[#0D4A2E] focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[#C59B27]/50 bg-[#FFFDF5] p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#083320] text-[#DFB848]">
                    <Calculator className="h-3.5 w-3.5" />
                  </div>
                  <p className="font-display text-xs font-bold text-[#0F1F17]">
                    Hitung Pintar Pencairan Pinjaman
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 items-end">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#2A3B31]">
                      Uang Administrasi (Rp)
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm font-semibold text-[#5C6E63]">
                        Rp
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={adminFeeText}
                        onChange={(e) =>
                          setAdminFeeText(formatNumericDots(e.target.value) || '0')
                        }
                        className="min-h-[40px] w-full rounded-lg border border-[#DCE4DE] bg-white pl-10 pr-3 font-mono text-sm font-bold text-[#0F1F17] tabular-nums focus:border-[#0D4A2E] focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3.5 py-2">
                    <p className="text-[11px] font-medium text-[#0D4A2E]">
                      Dana Bersih Diterima Peminjam
                    </p>
                    <p className="font-mono text-base font-bold text-[#083320] tabular-nums">
                      {formatRupiah(disburseNet)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-dashed border-[#C59B27]/50 pt-2 text-sm">
                  <span className="font-semibold text-[#0F1F17]">Total Tagihan Pinjaman</span>
                  <span className="font-mono text-base font-bold text-[#0D4A2E] tabular-nums">
                    {formatRupiah(disburseTotal)}
                  </span>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#2A3B31]">
                  Catatan Akad Pinjaman
                </label>
                <textarea
                  rows={2}
                  value={loanDescription}
                  onChange={(e) => setLoanDescription(e.target.value)}
                  className="w-full rounded-lg border border-[#DCE4DE] bg-white px-3 py-2 text-sm text-[#0F1F17] focus:border-[#0D4A2E] focus:outline-none"
                />
              </div>

              {disburseError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {disburseError}
                </p>
              )}

              <div className="flex flex-col-reverse gap-2 border-t border-[#EBF0EC] pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setDisburseTarget(null)}
                  className="min-h-[42px] rounded-lg border border-[#DCE4DE] px-4 py-2 text-sm font-medium text-[#2A3B31] hover:bg-[#F6F8F6]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={disbursing}
                  className="min-h-[42px] rounded-lg bg-[#0D4A2E] px-5 py-2 text-sm font-semibold text-white hover:bg-[#083320] disabled:opacity-60"
                >
                  {disbursing ? 'Memproses Pencairan...' : 'Cairkan & Masuk Buku Pinjaman'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Hapus Data Calon Nasabah?"
        message={`Pengajuan ${deleteTarget?.applicationNumber} atas nama ${deleteTarget?.applicantName} akan dihapus permanen dari daftar visit lapangan.`}
        confirmLabel="Ya, Hapus Data"
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
