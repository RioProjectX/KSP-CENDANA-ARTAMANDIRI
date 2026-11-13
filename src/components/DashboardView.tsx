import { useState } from 'react';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  HandCoins,
  Plus,
  RotateCcw,
} from 'lucide-react';
import { ActivePage, ComputedLoan, DashboardSummary, KoperasiDatabase } from '../types';
import {
  buildMonthlyChartSeries,
  formatDateID,
  formatRupiah,
  getDueReminderLabel,
  MonthlyChartDatum,
} from '../utils/format';

interface DashboardViewProps {
  db: KoperasiDatabase;
  summary: DashboardSummary;
  computedLoans: ComputedLoan[];
  onNavigate: (page: ActivePage) => void;
}

function shortRupiah(val: number): string {
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}M`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}jt`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}rb`;
  return `${sign}${abs}`;
}

export function DashboardView({
  db,
  summary,
  computedLoans,
  onNavigate,
}: DashboardViewProps) {
  const monthlySeries = buildMonthlyChartSeries(db);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const urgentLoans = computedLoans
    .filter((l) => l.status !== 'LUNAS' && l.dueReminderLevel !== 'aman')
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  const cards = [
    {
      title: 'Total Seluruh Dana',
      value: formatRupiah(summary.totalSeluruhDana),
      sub: 'Saldo kas tersedia + sisa pinjaman berjalan',
      highlight: true,
    },
    {
      title: 'Saldo Kas Tersedia',
      value: formatRupiah(summary.saldoKasTersedia),
      sub: 'Dana likuid siap operasional & pencairan',
      highlight: false,
    },
    {
      title: 'Total Dana Sedang Dipinjam',
      value: formatRupiah(summary.totalDanaSedangDipinjam),
      sub: `${summary.activeLoanCount} pinjaman belum lunas`,
      highlight: false,
    },
    {
      title: 'Total Dana Sudah Kembali',
      value: formatRupiah(summary.totalDanaSudahKembali),
      sub: `${db.repayments.length} transaksi cicilan masuk`,
      highlight: false,
    },
    {
      title: 'Total Uang Masuk',
      value: formatRupiah(summary.totalUangMasuk),
      sub: 'Simpanan anggota, modal & pemasukan kas',
      highlight: false,
    },
    {
      title: 'Total Uang Keluar',
      value: formatRupiah(summary.totalUangKeluar),
      sub: 'Biaya operasional & penarikan simpanan',
      highlight: false,
    },
    {
      title: 'Jumlah Transaksi Aktif',
      value: `${summary.jumlahTransaksiAktif.toLocaleString('id-ID')} Transaksi`,
      sub: `${db.transactions.length} kas · ${summary.activeLoanCount} pinjaman aktif · ${db.repayments.length} cicilan`,
      highlight: false,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header & Quick Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0F1F17]">
            Dashboard Utama
          </h1>
          <p className="mt-1 text-sm text-[#5C6E63]">
            Ringkasan posisi dana, arus kas, dan pemantauan pinjaman secara real-time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('uang-masuk')}
            className="flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#0D4A2E] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#083320] whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5 text-[#DFB848]" />
            <span>Uang Masuk</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('pinjaman')}
            className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#C59B27] bg-[#FEF9E7] px-3.5 py-2 text-xs font-semibold text-[#7D5D0F] transition-colors hover:bg-[#FDF3CC] whitespace-nowrap"
          >
            <HandCoins className="h-3.5 w-3.5" />
            <span>Pinjaman Baru</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('pengembalian')}
            className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#DCE4DE] bg-white px-3.5 py-2 text-xs font-semibold text-[#0F1F17] transition-colors hover:bg-[#F1F5F2] whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5 text-[#0D4A2E]" />
            <span>Catat Cicilan</span>
          </button>
        </div>
      </div>

      {/* 7 Summary Cards */}
      <section aria-label="Ringkasan Keuangan">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card, index) => (
            <div
              key={card.title}
              className={`rounded-xl border p-5 transition-colors ${
                card.highlight
                  ? 'border-[#0D4A2E] bg-[#083320] text-white sm:col-span-2 xl:col-span-2'
                  : 'border-[#DCE4DE] bg-white text-[#0F1F17]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p
                  className={`text-xs font-semibold ${
                    card.highlight ? 'text-[#DFB848]' : 'text-[#5C6E63]'
                  }`}
                >
                  {card.title}
                </p>
                {index === 4 && <ArrowDownLeft className="h-4 w-4 text-emerald-700" />}
                {index === 5 && <ArrowUpRight className="h-4 w-4 text-red-700" />}
              </div>
              <p
                className={`mt-2 font-display font-bold tabular-nums tracking-tight ${
                  card.highlight ? 'text-2xl sm:text-3xl text-white' : 'text-xl sm:text-2xl text-[#0F1F17]'
                }`}
              >
                {card.value}
              </p>
              <p
                className={`mt-1.5 text-xs ${
                  card.highlight ? 'text-emerald-100/75' : 'text-[#6C7E73]'
                }`}
              >
                {card.sub}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Urgent Due Date Reminders */}
      {urgentLoans.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-[#FFFDF5] p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-700" />
              <div>
                <h2 className="font-display text-base font-bold text-[#0F1F17]">
                  Pengingat Jatuh Tempo Pinjaman ({urgentLoans.length})
                </h2>
                <p className="text-xs text-[#5C6E63]">
                  Pinjaman yang melewati jatuh tempo atau mendekati H-7, H-3, dan H-1.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('pinjaman')}
              className="flex min-h-[38px] items-center gap-1.5 self-start rounded-lg border border-[#DCE4DE] bg-white px-3 py-1.5 text-xs font-semibold text-[#0D4A2E] hover:bg-[#EFF5F1] whitespace-nowrap"
            >
              <span>Kelola Pinjaman</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-4 divide-y divide-amber-200/70 rounded-lg border border-amber-200/80 bg-white">
            {urgentLoans.slice(0, 5).map((loan) => {
              const isOverdue = loan.dueReminderLevel === 'terlambat';
              const isH1 = loan.dueReminderLevel === 'h1';
              return (
                <div
                  key={loan.id}
                  onClick={() => onNavigate('pinjaman')}
                  className="flex cursor-pointer flex-col gap-2 px-4 py-3 hover:bg-[#FAFBF9] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#0F1F17]">
                      <span>{loan.borrowerName}</span>
                      <span className="font-mono text-xs font-normal text-[#5C6E63]">
                        {loan.txNumber}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[#5C6E63]">
                      Jatuh tempo: {formatDateID(loan.dueDate)} · Sisa:{' '}
                      <span className="font-semibold text-[#0F1F17] tabular-nums">
                        {formatRupiah(loan.remainingAmount)}
                      </span>
                    </p>
                  </div>

                  <span
                    className={`inline-flex shrink-0 items-center self-start rounded-md px-2.5 py-1 text-xs font-semibold sm:self-center ${
                      isOverdue
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : isH1
                        ? 'bg-orange-50 text-orange-700 border border-orange-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {getDueReminderLabel(loan)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 4 Visual Charts */}
      <section aria-label="Grafik Keuangan" className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Grafik 1: Pemasukan vs Pengeluaran Bulanan */}
        <ChartCard
          title="Pemasukan vs Pengeluaran Bulanan"
          subtitle="Perbandingan total uang masuk (termasuk pengembalian) dengan uang keluar"
          empty={monthlySeries.length === 0}
          onEmptyAction={() => onNavigate('uang-masuk')}
          emptyActionLabel="Catat Transaksi Pertama"
        >
          <DualBarChart
            data={monthlySeries}
            hoveredIdx={hoveredIdx}
            onHover={setHoveredIdx}
          />
        </ChartCard>

        {/* Grafik 2: Dana Sedang Dipinjam */}
        <ChartCard
          title="Dana Dipinjam per Bulan"
          subtitle="Volume pencairan pokok pinjaman anggota setiap bulan"
          empty={monthlySeries.every((m) => m.danaDipinjam === 0)}
          onEmptyAction={() => onNavigate('pinjaman')}
          emptyActionLabel="Catat Pinjaman Pertama"
        >
          <SingleBarChart
            data={monthlySeries}
            valueKey="danaDipinjam"
            label="Dana Dipinjam"
            barColor="#C59B27"
            hoveredIdx={hoveredIdx}
            onHover={setHoveredIdx}
          />
        </ChartCard>

        {/* Grafik 3: Pengembalian Dana */}
        <ChartCard
          title="Pengembalian Dana Bulanan"
          subtitle="Realisasi pembayaran cicilan & pelunasan pinjaman per bulan"
          empty={monthlySeries.every((m) => m.pengembalian === 0)}
          onEmptyAction={() => onNavigate('pengembalian')}
          emptyActionLabel="Catat Pengembalian"
        >
          <SingleBarChart
            data={monthlySeries}
            valueKey="pengembalian"
            label="Pengembalian Dana"
            barColor="#0D4A2E"
            hoveredIdx={hoveredIdx}
            onHover={setHoveredIdx}
          />
        </ChartCard>

        {/* Grafik 4: Perkembangan Saldo */}
        <ChartCard
          title="Perkembangan Saldo Kas"
          subtitle="Tren akumulasi saldo kas bersih koperasi dari bulan ke bulan"
          empty={monthlySeries.length === 0}
          onEmptyAction={() => onNavigate('uang-masuk')}
          emptyActionLabel="Mulai Pembukuan"
        >
          <BalanceLineChart
            data={monthlySeries}
            hoveredIdx={hoveredIdx}
            onHover={setHoveredIdx}
          />
        </ChartCard>
      </section>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  empty,
  emptyActionLabel,
  onEmptyAction,
  children,
}: {
  title: string;
  subtitle: string;
  empty: boolean;
  emptyActionLabel: string;
  onEmptyAction: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-[#DCE4DE] bg-white p-5">
      <div className="mb-4">
        <h3 className="font-display text-base font-bold text-[#0F1F17]">{title}</h3>
        <p className="mt-0.5 text-xs text-[#5C6E63]">{subtitle}</p>
      </div>

      {empty ? (
        <div className="flex flex-1 min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed border-[#DCE4DE] bg-[#F8FAF8] px-4 py-8 text-center">
          <p className="text-sm font-medium text-[#425449]">
            Belum ada data untuk ditampilkan pada grafik ini.
          </p>
          <button
            type="button"
            onClick={onEmptyAction}
            className="mt-3 rounded-lg bg-[#0D4A2E] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#083320]"
          >
            {emptyActionLabel}
          </button>
        </div>
      ) : (
        <div className="flex-1">{children}</div>
      )}
    </div>
  );
}

function DualBarChart({
  data,
  hoveredIdx,
  onHover,
}: {
  data: MonthlyChartDatum[];
  hoveredIdx: number | null;
  onHover: (idx: number | null) => void;
}) {
  const recent = data.slice(-8);
  const maxVal = Math.max(
    1,
    ...recent.map((d) => Math.max(d.uangMasuk + d.pengembalian, d.uangKeluar))
  );

  const chartH = 180;
  const chartW = Math.max(360, recent.length * 68);
  const padL = 48;
  const padB = 28;
  const padT = 12;
  const plotH = chartH - padT - padB;
  const groupW = (chartW - padL - 12) / recent.length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-[#425449]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-xs bg-[#0D4A2E]" />
          <span>Pemasukan (Kas + Cicilan)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-xs bg-[#B91C1C]" />
          <span>Pengeluaran Kas</span>
        </span>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartW} ${chartH}`}
          className="h-[200px] w-full min-w-[340px]"
          role="img"
          aria-label="Grafik Pemasukan vs Pengeluaran Bulanan"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padT + plotH * (1 - ratio);
            return (
              <g key={ratio}>
                <line
                  x1={padL}
                  y1={y}
                  x2={chartW - 8}
                  y2={y}
                  stroke="#E5ECE7"
                  strokeDasharray="3 3"
                />
                <text
                  x={padL - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-[#6C7E73] text-[9px] font-mono"
                >
                  {shortRupiah(maxVal * ratio)}
                </text>
              </g>
            );
          })}

          {recent.map((item, i) => {
            const pemasukan = item.uangMasuk + item.pengembalian;
            const pengeluaran = item.uangKeluar;
            const h1 = (pemasukan / maxVal) * plotH;
            const h2 = (pengeluaran / maxVal) * plotH;
            const xCenter = padL + groupW * i + groupW / 2;
            const barW = Math.min(18, groupW * 0.32);

            return (
              <g
                key={item.monthKey}
                onMouseEnter={() => onHover(i)}
                onMouseLeave={() => onHover(null)}
                className="cursor-pointer"
              >
                <rect
                  x={xCenter - barW - 2}
                  y={padT + plotH - h1}
                  width={barW}
                  height={Math.max(2, h1)}
                  rx={3}
                  fill="#0D4A2E"
                  opacity={hoveredIdx === null || hoveredIdx === i ? 1 : 0.45}
                />
                <rect
                  x={xCenter + 2}
                  y={padT + plotH - h2}
                  width={barW}
                  height={Math.max(2, h2)}
                  rx={3}
                  fill="#B91C1C"
                  opacity={hoveredIdx === null || hoveredIdx === i ? 1 : 0.45}
                />
                <text
                  x={xCenter}
                  y={chartH - 8}
                  textAnchor="middle"
                  className="fill-[#425449] text-[10px]"
                >
                  {item.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {hoveredIdx !== null && recent[hoveredIdx] && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#F8FAF8] px-3 py-2 text-xs border border-[#DCE4DE]">
          <span className="font-semibold text-[#0F1F17]">{recent[hoveredIdx].label}</span>
          <div className="flex flex-wrap gap-3 font-mono tabular-nums">
            <span className="text-[#0D4A2E]">
              Masuk: {formatRupiah(recent[hoveredIdx].uangMasuk + recent[hoveredIdx].pengembalian)}
            </span>
            <span className="text-red-700">
              Keluar: {formatRupiah(recent[hoveredIdx].uangKeluar)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function SingleBarChart({
  data,
  valueKey,
  label,
  barColor,
  hoveredIdx,
  onHover,
}: {
  data: MonthlyChartDatum[];
  valueKey: 'danaDipinjam' | 'pengembalian';
  label: string;
  barColor: string;
  hoveredIdx: number | null;
  onHover: (idx: number | null) => void;
}) {
  const recent = data.slice(-8);
  const maxVal = Math.max(1, ...recent.map((d) => d[valueKey]));
  const chartH = 180;
  const chartW = Math.max(360, recent.length * 64);
  const padL = 48;
  const padB = 28;
  const padT = 12;
  const plotH = chartH - padT - padB;
  const groupW = (chartW - padL - 12) / recent.length;

  return (
    <div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartW} ${chartH}`}
          className="h-[205px] w-full min-w-[340px]"
          role="img"
          aria-label={label}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padT + plotH * (1 - ratio);
            return (
              <g key={ratio}>
                <line
                  x1={padL}
                  y1={y}
                  x2={chartW - 8}
                  y2={y}
                  stroke="#E5ECE7"
                  strokeDasharray="3 3"
                />
                <text
                  x={padL - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-[#6C7E73] text-[9px] font-mono"
                >
                  {shortRupiah(maxVal * ratio)}
                </text>
              </g>
            );
          })}

          {recent.map((item, i) => {
            const val = item[valueKey];
            const h = (val / maxVal) * plotH;
            const xCenter = padL + groupW * i + groupW / 2;
            const barW = Math.min(28, groupW * 0.52);

            return (
              <g
                key={item.monthKey}
                onMouseEnter={() => onHover(i)}
                onMouseLeave={() => onHover(null)}
                className="cursor-pointer"
              >
                <rect
                  x={xCenter - barW / 2}
                  y={padT + plotH - h}
                  width={barW}
                  height={val > 0 ? Math.max(3, h) : 0}
                  rx={4}
                  fill={barColor}
                  opacity={hoveredIdx === null || hoveredIdx === i ? 1 : 0.45}
                />
                <text
                  x={xCenter}
                  y={chartH - 8}
                  textAnchor="middle"
                  className="fill-[#425449] text-[10px]"
                >
                  {item.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {hoveredIdx !== null && recent[hoveredIdx] && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-[#F8FAF8] px-3 py-2 text-xs border border-[#DCE4DE]">
          <span className="font-semibold text-[#0F1F17]">{recent[hoveredIdx].label}</span>
          <span className="font-mono font-semibold text-[#0F1F17] tabular-nums">
            {label}: {formatRupiah(recent[hoveredIdx][valueKey])}
          </span>
        </div>
      )}
    </div>
  );
}

function BalanceLineChart({
  data,
  hoveredIdx,
  onHover,
}: {
  data: MonthlyChartDatum[];
  hoveredIdx: number | null;
  onHover: (idx: number | null) => void;
}) {
  const recent = data.slice(-8);
  const values = recent.map((d) => d.saldoAkhir);
  const minVal = Math.min(0, ...values);
  const maxVal = Math.max(1, ...values);
  const span = Math.max(1, maxVal - minVal);

  const chartH = 180;
  const chartW = Math.max(360, recent.length * 64);
  const padL = 52;
  const padR = 18;
  const padB = 28;
  const padT = 16;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const points = recent.map((d, i) => {
    const x =
      recent.length === 1
        ? padL + plotW / 2
        : padL + (i / (recent.length - 1)) * plotW;
    const y = padT + plotH - ((d.saldoAkhir - minVal) / span) * plotH;
    return { x, y, datum: d };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');
  const areaPath =
    points.length > 0
      ? `M ${points[0].x},${padT + plotH} L ${points
          .map((p) => `${p.x},${p.y}`)
          .join(' L ')} L ${points[points.length - 1].x},${padT + plotH} Z`
      : '';

  return (
    <div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartW} ${chartH}`}
          className="h-[205px] w-full min-w-[340px]"
          role="img"
          aria-label="Grafik Perkembangan Saldo Kas"
        >
          <defs>
            <linearGradient id="saldoAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0D4A2E" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#0D4A2E" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padT + plotH * (1 - ratio);
            const val = minVal + span * ratio;
            return (
              <g key={ratio}>
                <line
                  x1={padL}
                  y1={y}
                  x2={chartW - padR}
                  y2={y}
                  stroke="#E5ECE7"
                  strokeDasharray="3 3"
                />
                <text
                  x={padL - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-[#6C7E73] text-[9px] font-mono"
                >
                  {shortRupiah(val)}
                </text>
              </g>
            );
          })}

          {points.length > 1 && <path d={areaPath} fill="url(#saldoAreaGrad)" />}
          {points.length > 1 && (
            <polyline
              fill="none"
              stroke="#0D4A2E"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={polyline}
            />
          )}

          {points.map((p, i) => (
            <g
              key={p.datum.monthKey}
              onMouseEnter={() => onHover(i)}
              onMouseLeave={() => onHover(null)}
              className="cursor-pointer"
            >
              <circle
                cx={p.x}
                cy={p.y}
                r={hoveredIdx === i ? 5.5 : 4}
                fill="#C59B27"
                stroke="#083320"
                strokeWidth="1.5"
              />
              <text
                x={p.x}
                y={chartH - 8}
                textAnchor="middle"
                className="fill-[#425449] text-[10px]"
              >
                {p.datum.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {hoveredIdx !== null && recent[hoveredIdx] && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-[#F8FAF8] px-3 py-2 text-xs border border-[#DCE4DE]">
          <span className="font-semibold text-[#0F1F17]">{recent[hoveredIdx].label}</span>
          <span className="font-mono font-semibold text-[#0D4A2E] tabular-nums">
            Saldo Kas: {formatRupiah(recent[hoveredIdx].saldoAkhir)}
          </span>
        </div>
      )}
    </div>
  );
}
