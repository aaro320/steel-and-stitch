const phpFmt = new Intl.NumberFormat('en-PH', {
  style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2,
});

/** ₱1,250.00 (NFR-005) */
export const peso = (n: number | string | null | undefined) =>
  phpFmt.format(Number(n ?? 0)).replace('PHP', '₱').replace(/\s/g, '');

export const qty = (n: number | string) =>
  Number(n).toLocaleString('en-PH', { maximumFractionDigits: 2 });

export const dt = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString('en-PH', {
        timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
      })
    : '—';

export const ACTION_LABEL: Record<string, string> = {
  stock_in: 'Stock In',
  stock_out_usage: 'Stock Out (Usage)',
  stock_out_wastage: 'Stock Out (Wastage)',
  job_deduction: 'Job Order Deduction',
  adjustment: 'Stock Adjustment',
  material_created: 'Material Created',
};
