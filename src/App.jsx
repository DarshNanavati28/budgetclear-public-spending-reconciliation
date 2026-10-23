import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, Banknote,
  BarChart3, Check, CheckCheck, ChevronDown, CircleAlert, CircleCheck, ClipboardList,
  Download, FileCheck2, FileText, Filter, FolderOpen, HelpCircle, Info, ListFilter,
  Menu, MoreHorizontal, Pencil, Plus, Printer, Search, Settings2, ShieldAlert,
  SlidersHorizontal, Sparkles, Upload, X, XCircle,
} from 'lucide-react';

const STORE_KEY = 'budgetclear-workspace-v1';
const KNOWN_CATEGORIES = ['Roadworks', 'Education', 'Health', 'Transport', 'Water & sanitation', 'Administration', 'Energy'];
const SAMPLE_ROWS = [
  { id: 'l1', date: '2025-03-03', description: 'East Loop road resurfacing, phase 2', category: 'Roadworks', amount: 46800000, reference: 'PW-2041' },
  { id: 'l2', date: '2025-03-05', description: 'Classroom learning kits — North Ward', category: 'Education', amount: 18650000, reference: 'ED-0918' },
  { id: 'l3', date: '2025-03-06', description: 'Ultrasound monitor for district clinic', category: 'Health', amount: 62500000, reference: 'HC-7721' },
  { id: 'l4', date: '2025-03-03', description: 'East Loop road resurfacing, phase 2', category: 'Roadworks', amount: 46800000, reference: 'PW-2041' },
  { id: 'l5', date: '2025-03-10', description: 'Diesel for emergency fleet — March', category: 'Transport', amount: 8800000, reference: 'TR-3410' },
  { id: 'l6', date: '2025-03-11', description: 'Water testing supplies for district labs', category: 'Water & sanitation', amount: 5400000, reference: 'WS-0056' },
  { id: 'l7', date: '2025-03-12', description: 'Classroom electrical maintenance', category: 'Education', amount: 1640000, reference: 'ED-0937' },
  { id: 'l8', date: '2025-03-15', description: 'Contractor advance — zone 4 drainage works', category: '', amount: 31200000, reference: 'PW-2094' },
  { id: 'l9', date: '2025-03-18', description: 'Quarterly facilities staffing', category: 'Administration', amount: 34200000, reference: 'HR-0145' },
  { id: 'l10', date: '2025-03-20', description: 'Backup generator procurement — central depot', category: 'Energy', amount: 93500000, reference: 'EN-1148' },
  { id: 'l11', date: '2025-03-21', description: 'Solar battery inspection', category: 'Energy', amount: 7400000, reference: 'EN-1091' },
  { id: 'l12', date: '2025-03-22', description: 'Generator load test and service', category: 'Energy', amount: 4650000, reference: 'EN-1095' },
  { id: 'l13', date: '2025-03-24', description: 'Electrical wiring material — pump station', category: 'Energy', amount: 8950000, reference: 'EN-1123' },
  { id: 'l14', date: '2025-03-26', description: 'Office generator fuel', category: 'Energy', amount: 5800000, reference: 'EN-1156' },
];
const SAMPLE_STATE = {
  rows: SAMPLE_ROWS,
  budgetName: 'Sample · District operations · Q1 2025',
  declaredTotal: 366400000,
  categoryTotals: [
    { category: 'Roadworks', amount: 93600000 },
    { category: 'Education', amount: 20290000 },
    { category: 'Health', amount: 62500000 },
    { category: 'Transport', amount: 8800000 },
    { category: 'Water & sanitation', amount: 5400000 },
    { category: 'Administration', amount: 34200000 },
    { category: 'Energy', amount: 118000000 },
  ],
};

const fmt = (cents, options = {}) => cents == null || cents === '' ? '—' : new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2, ...options,
}).format(Number(cents) / 100);
const fmtCompact = (cents) => cents == null ? '—' : new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1,
}).format(Number(cents) / 100);
const fmtDate = (value) => {
  if (!value) return '—';
  if (!validDate(value)) return value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
};
const validDate = (value) => {
  const text = String(value || '').trim();
  let year, month, day;
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/) || text.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (match) [, year, month, day] = match;
  else {
    match = text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
    if (!match) return false;
    [, day, month, year] = match;
  }
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.getUTCFullYear() === Number(year) && date.getUTCMonth() + 1 === Number(month) && date.getUTCDate() === Number(day);
};
const fromInput = (value) => {
  if (value == null || String(value).trim() === '') return null;
  const cleaned = String(value).trim().replace(/[₹$£€\s,]/g, '');
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  const cents = Math.round(n * 100);
  return Number.isSafeInteger(cents) ? cents : null;
};
const toInput = (cents) => cents == null ? '' : (Number(cents) / 100).toFixed(2);
const normalized = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const exactSum = (values) => {
  const total = values.reduce((sum, value) => sum + BigInt(value), 0n);
  return total > BigInt(Number.MAX_SAFE_INTEGER) || total < BigInt(Number.MIN_SAFE_INTEGER) ? null : Number(total);
};

function seeded() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (saved?.rows && Array.isArray(saved.rows)) {
      if (saved.budgetName === 'District operations · Q1 2025' && saved.rows.length === SAMPLE_ROWS.length) return { ...saved, budgetName: SAMPLE_STATE.budgetName };
      return saved;
    }
  } catch { /* Start with the sample when saved browser data cannot be read. */ }
  return SAMPLE_STATE;
}

function parseCsv(text) {
  const records = [];
  let record = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"' && quoted && text[i + 1] === '"') { cell += '"'; i += 1; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) { record.push(cell); cell = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      record.push(cell); cell = '';
      if (record.some((part) => String(part).trim())) records.push(record);
      record = [];
    } else cell += ch;
  }
  record.push(cell);
  if (record.some((part) => String(part).trim())) records.push(record);
  if (records.length < 2) throw new Error('No line items found. Add a header row and at least one expenditure line.');
  const headers = records[0].map((h) => normalized(h.replace(/^\uFEFF/, '')).replace(/[ _-]+/g, ''));
  const aliases = {
    date: ['date', 'transactiondate', 'paymentdate'],
    description: ['description', 'details', 'item', 'expendituredetails', 'particulars'],
    category: ['category', 'budgetcategory', 'expenditurecategory'],
    amount: ['amount', 'value', 'expenditure', 'lineamount'],
    reference: ['reference', 'ref', 'referenceid', 'voucher', 'invoicenumber'],
  };
  const positions = Object.fromEntries(Object.entries(aliases).map(([key, values]) => [key, headers.findIndex((h) => values.includes(h))]));
  if (positions.description < 0 && positions.amount < 0) throw new Error('Could not find the description and amount columns. Expected headers such as date, description, category, amount, reference.');
  return records.slice(1).map((record, index) => {
    const read = (key) => positions[key] < 0 ? '' : String(record[positions[key]] ?? '').trim();
    const rawAmount = read('amount');
    return {
      id: `import-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
      date: read('date'), description: read('description'), category: read('category'),
      amount: fromInput(rawAmount), rawAmount, reference: read('reference'),
    };
  });
}

function makeFindings(rows, declaredTotal, categoryTotals) {
  const findings = [];
  const knownAmounts = rows.filter((row) => Number.isSafeInteger(row.amount));
  const incompleteAmounts = rows.filter((row) => !Number.isSafeInteger(row.amount));
  const sum = exactSum(knownAmounts.map((row) => row.amount));
  if (declaredTotal != null) {
    findings.push({
      id: 'total-check', kind: sum == null || incompleteAmounts.length ? 'pending' : declaredTotal === sum ? 'matched' : 'verified',
      title: 'Stated total', rows: rows.map((row) => row.id),
      observed: sum, stated: declaredTotal,
      reason: sum == null
        ? 'The combined readable amount is outside the exact integer range supported by this review, so the total cannot be verified safely.'
        : incompleteAmounts.length
          ? `${incompleteAmounts.length} line ${incompleteAmounts.length === 1 ? 'amount is' : 'amounts are'} missing or unreadable, so the full total cannot be verified.`
        : `Sum of ${knownAmounts.length} line ${knownAmounts.length === 1 ? 'item' : 'items'} compared with the stated total.`,
    });
  }
  for (const declared of categoryTotals) {
    if (declared.amount == null || !declared.category?.trim()) continue;
    const group = rows.filter((row) => normalized(row.category) === normalized(declared.category));
    const unknownAmounts = group.filter((row) => !Number.isSafeInteger(row.amount));
    const observed = exactSum(group.filter((row) => Number.isSafeInteger(row.amount)).map((row) => row.amount));
    const id = `category-${normalized(declared.category).replace(/[^a-z0-9]+/g, '-')}`;
    findings.push({
      id, kind: unknownAmounts.length || observed == null ? 'pending' : declared.amount === observed ? 'matched' : 'verified',
      title: declared.category, rows: group.map((row) => row.id), observed, stated: declared.amount,
      reason: observed == null ? 'The combined category amount is outside the exact integer range supported by this review, so this total cannot be verified safely.' : unknownAmounts.length ? `${unknownAmounts.length} line amount in this category is missing or unreadable.` : `Sum of ${group.length} matching line ${group.length === 1 ? 'item' : 'items'} compared with this category total.`,
    });
  }

  const byDuplicateKey = new Map();
  rows.forEach((row) => {
    if (!row.date?.trim() || !row.description?.trim() || !row.category?.trim() || !Number.isSafeInteger(row.amount) || !row.reference?.trim()) return;
    const key = [row.date, row.description, row.category, row.amount, row.reference].map(normalized).join('|');
    byDuplicateKey.set(key, [...(byDuplicateKey.get(key) || []), row]);
  });
  for (const group of byDuplicateKey.values()) {
    if (group.length > 1) findings.push({
      id: `duplicate-${group.map((row) => row.id).join('-')}`, kind: 'duplicate', title: 'Possible duplicate', rows: group.map((row) => row.id),
      reason: `Exact match across ${group.map((row) => row.reference || 'no reference').join(' and ')}: date, description, category, amount, and reference are the same. Verify against source documents.`,
    });
  }

  for (const row of rows) {
    const missing = ['description', 'category', 'reference'].filter((field) => !String(row[field] || '').trim());
    if (!row.date?.trim()) missing.push('date');
    else if (!validDate(row.date)) missing.push('unclear-date');
    if (!Number.isSafeInteger(row.amount)) missing.push('amount');
    for (const field of missing) findings.push({
      id: `missing-${row.id}-${field}`, kind: 'missing', title: field === 'amount' && row.rawAmount ? 'Unreadable amount' : field === 'unclear-date' ? 'Unclear date' : `Missing ${field}`,
      rows: [row.id], reason: field === 'amount' && row.rawAmount ? `“${row.rawAmount}” could not be read as a money amount; check the source entry.` : field === 'unclear-date' ? `“${row.date}” is not a recognized calendar date. Check the source format; no date has been inferred.` : `This line has no ${field}. The value has not been inferred or filled in.`,
    });
  }

  const byCategory = new Map();
  rows.filter((row) => row.category && Number.isSafeInteger(row.amount)).forEach((row) => byCategory.set(row.category, [...(byCategory.get(row.category) || []), row]));
  for (const [category, group] of byCategory) {
    if (group.length < 4) continue;
    const values = group.map((row) => row.amount).sort((a, b) => a - b);
    const mid = Math.floor(values.length / 2);
    const median = values.length % 2 ? values[mid] : Math.round((values[mid - 1] + values[mid]) / 2);
    if (!median) continue;
    for (const row of group) if (row.amount >= median * 3 && row.amount - median >= 2500000) findings.push({
      id: `unusual-${row.id}`, kind: 'unusual', title: 'Unusual amount', rows: [row.id],
      reason: `${fmt(row.amount)} is ${(row.amount / median).toFixed(1)}× the ${category} median of ${fmt(median)} across ${group.length} line items. Statistical comparison only; check the supporting records.`,
    });
  }

  for (const row of rows.filter((item) => !item.category?.trim() && item.description?.trim())) {
    const description = normalized(row.description);
    const rules = [
      { test: /road|pav|asphalt|bridge|drain|contractor|works/, category: 'Roadworks', confidence: /road|pav|asphalt|bridge|drain/.test(description) ? 91 : 73 },
      { test: /school|classroom|student|learning|teacher/, category: 'Education', confidence: 94 },
      { test: /clinic|hospital|health|medical|medicine|patient/, category: 'Health', confidence: 93 },
      { test: /fuel|diesel|vehicle|fleet|transport/, category: 'Transport', confidence: 89 },
      { test: /water|sewer|sanitation|pump|waste/, category: 'Water & sanitation', confidence: 86 },
      { test: /staff|salary|office|administration|payroll/, category: 'Administration', confidence: 82 },
      { test: /electric|generator|solar|energy|power/, category: 'Energy', confidence: 88 },
    ];
    const rule = rules.find((item) => item.test.test(description));
    if (rule) findings.push({
      id: `suggestion-${row.id}`, kind: 'suggestion', title: `Suggested: ${rule.category}`, rows: [row.id],
      category: rule.category, confidence: rule.confidence,
      reason: `Description contains terms commonly associated with ${rule.category.toLowerCase()}. This rule-based suggestion has not been applied.`,
    });
  }
  return findings;
}

function IconButton({ title, onClick, children, className = '', disabled = false }) {
  return <button type="button" title={title} aria-label={title} onClick={onClick} disabled={disabled} className={`icon-button ${className}`}>{children}</button>;
}

function App() {
  const [data, setData] = useState(seeded);
  const [page, setPage] = useState('overview');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [compactMenu, setCompactMenu] = useState(false);
  const [reviewed, setReviewed] = useState(() => JSON.parse(localStorage.getItem(`${STORE_KEY}-reviewed`) || '[]'));
  const [activeRow, setActiveRow] = useState(null);
  const uploadRef = useRef(null);
  const dataRef = useRef(data);
  const { rows = [], budgetName = 'New spending review', declaredTotal = null, categoryTotals = [] } = data;
  const findings = useMemo(() => makeFindings(rows, declaredTotal, categoryTotals), [rows, declaredTotal, categoryTotals]);
  const discrepancies = findings.filter((item) => item.kind === 'verified');
  const pending = findings.filter((item) => item.kind === 'pending');
  const reviewFlags = findings.filter((item) => ['duplicate', 'missing', 'unusual'].includes(item.kind));
  const suggestions = findings.filter((item) => item.kind === 'suggestion');
  const total = exactSum(rows.filter((row) => Number.isSafeInteger(row.amount)).map((row) => row.amount));
  const amountGaps = rows.filter((row) => !Number.isSafeInteger(row.amount)).length;
  const unmatched = discrepancies.length;

  useEffect(() => { localStorage.setItem(STORE_KEY, JSON.stringify(data)); dataRef.current = data; }, [data]);
  useEffect(() => { localStorage.setItem(`${STORE_KEY}-reviewed`, JSON.stringify(reviewed)); }, [reviewed]);
  useEffect(() => { if (!toast) return undefined; const timeout = setTimeout(() => setToast(''), 3200); return () => clearTimeout(timeout); }, [toast]);

  const lineNo = (id) => {
    const index = rows.findIndex((row) => row.id === id);
    return index < 0 ? '—' : String(index + 1).padStart(3, '0');
  };
  const getRow = (id) => rows.find((row) => row.id === id);
  const goToLine = (id) => { setActiveRow(id); setPage('transactions'); setQuery(''); };
  const updateData = (patch) => setData((current) => ({ ...current, ...patch }));

  const handleFile = async (file) => {
    if (!file) return;
    try {
      const parsed = parseCsv(await file.text());
      if (rows.length && !window.confirm(`Replace the current ${rows.length} line items with ${parsed.length} lines from “${file.name}”? Stated totals will also be cleared.`)) {
        if (uploadRef.current) uploadRef.current.value = '';
        return;
      }
      setData({ rows: parsed, budgetName: file.name.replace(/\.csv$/i, ''), declaredTotal: null, categoryTotals: [] });
      setReviewed([]); setPage('overview'); setToast(`Imported ${parsed.length} line items. Enter the stated totals to reconcile.`);
    } catch (error) { setToast(error.message || 'Could not read this CSV file.'); }
    if (uploadRef.current) uploadRef.current.value = '';
  };

  const setDeclaredTotal = (value) => updateData({ declaredTotal: fromInput(value) });
  const updateCategory = (index, key, value) => {
    const next = [...categoryTotals];
    next[index] = { ...next[index], [key]: key === 'amount' ? fromInput(value) : value };
    updateData({ categoryTotals: next });
  };
  const addCategoryTotal = () => updateData({ categoryTotals: [...categoryTotals, { category: '', amount: null }] });
  const deleteCategoryTotal = (index) => updateData({ categoryTotals: categoryTotals.filter((_, i) => i !== index) });

  const saveRow = (form, existingId) => {
    const amount = fromInput(form.amount);
    if (form.amount !== '' && amount == null) { setToast('Enter an amount with up to two decimal places.'); return; }
    const row = {
      id: existingId || `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      date: form.date.trim(), description: form.description.trim(), category: form.category.trim(), amount,
      rawAmount: form.amount, reference: form.reference.trim(),
    };
    updateData({ rows: existingId ? rows.map((item) => item.id === existingId ? row : item) : [...rows, row] });
    setModal(null); setToast(existingId ? 'Line item updated.' : 'Line item added.');
  };
  const deleteRow = (id) => {
    updateData({ rows: rows.filter((row) => row.id !== id) });
    setModal(null); setActiveRow(null); setToast('Line item removed.');
  };
  const exportCsv = () => {
    const header = ['date', 'description', 'category', 'amount', 'reference'];
    const escapeCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const body = [header, ...rows.map((row) => [row.date, row.description, row.category, row.amount == null ? row.rawAmount || '' : toInput(row.amount), row.reference])];
    downloadFile(`${safeName(budgetName)}-lines.csv`, `\uFEFF${body.map((line) => line.map(escapeCell).join(',')).join('\r\n')}`, 'text/csv;charset=utf-8');
    setToast('Line items exported as CSV.');
  };
  const exportReport = () => {
    const report = {
      budget: budgetName,
      generatedAt: new Date().toISOString(),
      currency: 'INR',
      arithmetic: findings.filter((item) => ['verified', 'pending', 'matched'].includes(item.kind)).map((item) => ({
        check: item.title, status: item.kind, stated: item.stated == null ? null : item.stated / 100,
        observed: item.observed == null ? null : item.observed / 100,
        difference: item.kind === 'pending' || item.stated == null || item.observed == null ? null : (item.observed - item.stated) / 100,
        evidenceLines: item.rows.map(lineNo), explanation: item.reason,
      })),
      reviewSuggestions: findings.filter((item) => ['duplicate', 'missing', 'unusual', 'suggestion'].includes(item.kind)).map((item) => ({
        type: item.kind, title: item.title, evidenceLines: item.rows.map(lineNo), explanation: item.reason,
        ...(item.confidence ? { confidencePercent: item.confidence } : {}),
      })),
      notice: 'An anomaly flag is not proof of corruption or wrongdoing. Every flag needs human investigation before any conclusion is drawn.',
    };
    downloadFile(`${safeName(budgetName)}-review-report.json`, JSON.stringify(report, null, 2), 'application/json');
    setToast('Evidence-linked review report exported.');
  };
  const printReport = () => window.print();
  const resetDemo = () => {
    if (rows.length && !budgetName.startsWith('Sample ·') && !window.confirm('Restore the demonstration data? This will replace the current lines and totals.')) return;
    setData(SAMPLE_STATE); setReviewed([]); setPage('overview'); setModal(null); setToast('Sample review restored.');
  };
  const newReview = () => {
    if (rows.length && !window.confirm(`Start a new review? This will clear the current ${rows.length} line items and stated totals from this browser.`)) return;
    setData({ rows: [], budgetName: 'New spending review', declaredTotal: null, categoryTotals: [] });
    setReviewed([]); setPage('overview'); setModal(null); setToast('New empty review ready.');
  };

  const menu = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'transactions', label: 'Transactions', icon: ClipboardList, count: rows.length },
    { id: 'review', label: 'Review flags', icon: ShieldAlert, count: reviewFlags.filter((item) => !reviewed.includes(item.id)).length },
    { id: 'reconciliation', label: 'Reconciliation', icon: FileCheck2, count: unmatched || pending.length ? `${unmatched + pending.length}` : null },
  ];

  const renderNav = () => <nav className="nav-list" aria-label="Main navigation">{menu.map(({ id, label, icon: Icon, count }) => <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => { setPage(id); setCompactMenu(false); }}><Icon size={18} strokeWidth={1.8} /><span>{label}</span>{count ? <span className="nav-count">{count}</span> : null}</button>)}</nav>;

  return <div className="app-shell">
    <aside className={`sidebar ${compactMenu ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><img src="/budgetclear-mark.svg" alt="" /></div><div><div className="brand-name">budgetclear<span>.</span></div><div className="brand-sub">PUBLIC SPENDING REVIEW</div></div><button className="close-menu" aria-label="Close menu" onClick={() => setCompactMenu(false)}><X size={18} /></button></div>
      <div className="side-caption">WORKSPACE</div>
      {renderNav()}
      <div className="sidebar-spacer" />
      <div className="side-caption">ACTIVE REVIEW</div>
      <button className="budget-switcher" onClick={() => setModal({ type: 'budget' })}><span className="budget-switcher-icon"><FolderOpen size={17} /></span><span className="budget-switcher-text"><strong>{budgetName || 'New spending review'}</strong><small>{rows.length} line items</small></span><ChevronDown size={16} /></button>
      <div className="side-bottom"><div className="privacy-note"><ShieldAlert size={15} /><span>Stored in this browser<br />on this device</span></div><button className="nav-item quiet" onClick={() => setModal({ type: 'help' })}><HelpCircle size={17} /><span>How it works</span></button></div>
    </aside>
    <div className="mobile-scrim" onClick={() => setCompactMenu(false)} />

    <main className="main-area">
      <header className="topbar"><button className="mobile-menu" aria-label="Open menu" onClick={() => setCompactMenu(true)}><Menu size={20} /></button><div className="crumb"><span>Budget workspace</span><ArrowRight size={14} /><strong>{menu.find((item) => item.id === page)?.label}</strong></div><div className="topbar-right"><span className="local-badge"><span className="green-dot" />Local review</span><IconButton title="Help" onClick={() => setModal({ type: 'help' })}><HelpCircle size={18} /></IconButton><div className="avatar" title="Public finance reviewer">R</div></div></header>
      <div className="content-wrap">
        {page === 'overview' && <OverviewPage {...{ rows, budgetName, total, declaredTotal, discrepancies, pending, reviewFlags, suggestions, findings, lineNo, goToLine, setPage, onUpload: () => uploadRef.current?.click(), onAdd: () => setModal({ type: 'row' }), onReport: exportReport }} />}
        {page === 'transactions' && <TransactionsPage {...{ rows, query, setQuery, activeRow, setActiveRow, lineNo, onUpload: () => uploadRef.current?.click(), onAdd: () => setModal({ type: 'row' }), onEdit: (row) => setModal({ type: 'row', row }), onExport: exportCsv }} />}
        {page === 'review' && <ReviewPage {...{ findings: reviewFlags, suggestions, reviewed, setReviewed, lineNo, getRow, goToLine, onExport: exportReport }} />}
        {page === 'reconciliation' && <ReconciliationPage {...{ rows, declaredTotal, categoryTotals, findings, amountGaps, setDeclaredTotal, updateCategory, addCategoryTotal, deleteCategoryTotal, lineNo, goToLine, onExport: exportReport, onPrint: printReport }} />}
      </div>
      <footer className="footer"><span>BudgetClear <span className="footer-dot">·</span> Reconcile with evidence. Review with care.</span><button onClick={() => setModal({ type: 'help' })}>Method &amp; safeguards <ArrowUpRight size={13} /></button><span className="version">BETA 1.0</span></footer>
    </main>

    <input ref={uploadRef} type="file" accept=".csv,text/csv" hidden onChange={(event) => handleFile(event.target.files?.[0])} />
    {modal?.type === 'row' && <RowModal row={modal.row} onClose={() => setModal(null)} onSave={saveRow} onDelete={deleteRow} />}
    {modal?.type === 'help' && <HelpModal onClose={() => setModal(null)} />}
    {modal?.type === 'budget' && <BudgetModal name={budgetName} onClose={() => setModal(null)} onRename={(name) => { updateData({ budgetName: name.trim() || 'New spending review' }); setModal(null); }} onNew={newReview} onReset={resetDemo} />}
    {toast && <div role="status" className="toast"><CircleCheck size={17} />{toast}</div>}
  </div>;
}

function safeName(value) { return String(value || 'budgetclear-review').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'budgetclear-review'; }
function downloadFile(name, data, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function PageHeading({ eyebrow, title, subtitle, actions, badge }) {
  return <div className="page-heading"><div><div className="heading-eyebrow"><div className="eyebrow">{eyebrow}</div>{badge && <span className="demo-chip">{badge}</span>}</div><h1>{title}</h1><p>{subtitle}</p></div><div className="heading-actions">{actions}</div></div>;
}

function OverviewPage({ rows, budgetName, total, declaredTotal, discrepancies, pending, reviewFlags, suggestions, findings, lineNo, goToLine, setPage, onUpload, onAdd, onReport }) {
  const clear = discrepancies.length === 0 && pending.length === 0;
  const categories = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => { if (row.category && Number.isSafeInteger(row.amount)) map.set(row.category, (map.get(row.category) || 0) + row.amount); });
    return [...map.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount).slice(0, 5);
  }, [rows]);
  const maxAmount = Math.max(...categories.map((item) => item.amount), 1);
  const recent = [...rows].slice(-5).reverse();
  return <>
    <PageHeading eyebrow="FINANCIAL REVIEW · 01" badge={budgetName.startsWith('Sample ·') ? 'DEMO DATA' : null} title="A clearer view of every line." subtitle="Reconcile the numbers first. Keep review suggestions in their own lane." actions={<><button className="button-secondary" onClick={onUpload}><Upload size={16} />Upload CSV</button><button className="button-primary" onClick={onAdd}><Plus size={17} />Add line item</button></>} />
    <section className={`recon-banner ${clear ? 'all-clear' : pending.length ? 'has-pending' : 'has-diff'}`}>
      <div className="recon-banner-icon">{clear ? <CircleCheck size={21} /> : pending.length ? <Info size={21} /> : <CircleAlert size={21} />}</div>
      <div className="recon-banner-copy"><strong>{clear ? 'Arithmetic checks are complete' : pending.length ? 'Some arithmetic checks need complete data' : `${discrepancies.length} arithmetic ${discrepancies.length === 1 ? 'discrepancy' : 'discrepancies'} need attention`}</strong><span>{clear ? 'Stated totals match the available lines.' : pending.length ? `${discrepancies.length} verified discrepancy · ${pending.length} check${pending.length === 1 ? '' : 's'} awaiting missing data. Review arithmetic in its own section.` : 'Verified differences come from the line items shown. They are separate from all review suggestions.'}</span></div>
      <button className="banner-link" onClick={() => setPage('reconciliation')}>View reconciliation <ArrowRight size={15} /></button>
    </section>
    <div className="stat-grid">
      <StatCard label="Line items" value={rows.length.toLocaleString('en-IN')} foot="Across this review" icon={ClipboardList} tone="sage" />
      <StatCard label="Recorded spend" value={fmtCompact(total)} foot="Sum of readable amounts" icon={Banknote} tone="sand" />
      <StatCard label="Verified differences" value={discrepancies.length.toString()} foot={discrepancies.length ? 'Arithmetic only · see evidence' : 'No verified mismatches'} icon={FileCheck2} tone={discrepancies.length ? 'coral' : 'sage'} />
      <StatCard label="Review flags" value={reviewFlags.length.toString()} foot="Human review required" icon={ShieldAlert} tone="lavender" />
    </div>
    <div className="dashboard-grid">
      <section className="panel spend-panel"><div className="panel-heading"><div><div className="eyebrow">BREAKDOWN</div><h2>Spend by category</h2></div><button className="text-button" onClick={() => setPage('reconciliation')}>See reconciliation <ArrowRight size={14} /></button></div>
        {categories.length ? <div className="category-bars">{categories.map((item, index) => <div className="category-row" key={item.name}><div className="category-meta"><span>{item.name}</span><span>{fmtCompact(item.amount)}</span></div><div className="bar-track"><div className={`bar-fill bar-${index % 5}`} style={{ width: `${Math.max(2, item.amount / maxAmount * 100)}%` }} /></div></div>)}</div> : <EmptyBlock icon={BarChart3} title="Nothing to chart yet" description="Add a line item or upload a CSV to see the category breakdown." />}
        <div className="category-footnote"><Info size={14} />Categories are shown as entered; missing labels stay unassigned.</div>
      </section>
      <section className="panel totals-panel"><div className="panel-heading"><div><div className="eyebrow">TOP LINE</div><h2>Budget at a glance</h2></div><span className="period-chip">{budgetName}</span></div><div className="total-compare"><div className="total-item"><span>Stated total</span><strong>{fmt(declaredTotal)}</strong><small>Entered by reviewer</small></div><div className="total-divider"><ArrowRight size={15} /></div><div className="total-item"><span>Recorded lines</span><strong>{fmt(total)}</strong><small>Calculated from line items</small></div></div><button className="totals-cta" onClick={() => setPage('reconciliation')}>Check totals <ArrowRight size={15} /></button><div className="totals-foot"><span><span className={`status-dot ${pending.length ? 'amber' : discrepancies.length ? 'red' : 'green'}`} />{pending.length ? 'Review required' : discrepancies.length ? 'Difference found' : 'Totals aligned'}</span><span>{pending.length ? `${pending.length} pending` : discrepancies.length ? `${discrepancies.length} difference${discrepancies.length === 1 ? '' : 's'}` : 'All checks complete'}</span></div></section>
    </div>
    <div className="lower-grid"><section className="panel recent-panel"><div className="panel-heading"><div><div className="eyebrow">LATEST ENTRIES</div><h2>Recent line items</h2></div><button className="text-button" onClick={() => setPage('transactions')}>View all <ArrowRight size={14} /></button></div>
      {recent.length ? <div className="recent-list">{recent.map((row) => <button key={row.id} className="recent-row" onClick={() => goToLine(row.id)}><span className="recent-id">{lineNo(row.id).padStart(3, '0')}</span><span className="recent-detail"><strong>{row.description || 'Untitled entry'}</strong><small>{row.category || 'Missing category'} · {row.reference || 'No reference'}</small></span><span className="recent-amount">{fmt(row.amount)}</span><ArrowUpRight className="recent-arrow" size={15} /></button>)}</div> : <EmptyBlock icon={ClipboardList} title="No line items" description="Add an entry manually or import a CSV file." />}</section>
      <section className="panel attention-panel"><div className="panel-heading"><div><div className="eyebrow">REVIEW, NOT VERDICT</div><h2>Needs a closer look</h2></div><button className="review-count" onClick={() => setPage('review')}>{reviewFlags.length + suggestions.length}</button></div>
        {[...reviewFlags.slice(0, 2), ...suggestions.slice(0, 1)].length ? <div className="attention-list">{[...reviewFlags.slice(0, 2), ...suggestions.slice(0, 1)].map((item) => <button key={item.id} className="attention-row" onClick={() => item.rows[0] && goToLine(item.rows[0])}><span className={`attention-icon ${item.kind === 'suggestion' ? 'icon-suggestion' : item.kind === 'unusual' ? 'icon-unusual' : ''}`}>{item.kind === 'suggestion' ? <Sparkles size={15} /> : item.kind === 'unusual' ? <BarChart3 size={15} /> : <Info size={15} />}</span><span><strong>{item.title}</strong><small>Line {item.rows.map(lineNo).join(', ')} · {item.kind === 'suggestion' ? `${item.confidence}% confidence` : item.reason.slice(0, 66) + (item.reason.length > 66 ? '…' : '')}</small></span><ArrowRight size={14} /></button>)}</div> : <div className="calm-empty"><CircleCheck size={20} /><span>No review flags found in the current lines.</span></div>}
        <div className="attention-disclaimer"><Info size={13} />Flags are not proof of wrongdoing. A person must investigate.</div>
      </section></div>
    <div className="below-actions"><button className="text-button" onClick={onReport}><Download size={15} />Export evidence-linked report</button><button className="text-button muted-action" onClick={() => setPage('review')}><ListFilter size={15} />Review all flags ({reviewFlags.length + suggestions.length})</button></div>
  </>;
}

function StatCard({ label, value, foot, icon: Icon, tone }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={18} strokeWidth={1.8} /></div><div className="stat-card-copy"><span>{label}</span><strong>{value}</strong><small>{foot}</small></div><ArrowUpRight size={15} className="stat-arrow" /></div>;
}

function EmptyBlock({ icon: Icon, title, description }) { return <div className="empty-block"><div><Icon size={18} /></div><strong>{title}</strong><span>{description}</span></div>; }

function TransactionsPage({ rows, query, setQuery, activeRow, setActiveRow, lineNo, onUpload, onAdd, onEdit, onExport }) {
  const filtered = rows.filter((row) => [row.date, row.description, row.category, row.reference, fmt(row.amount)].some((value) => String(value || '').toLowerCase().includes(query.toLowerCase())));
  return <>
    <PageHeading eyebrow="SOURCE DATA · 02" title="Transactions" subtitle="Each total ties back to these source lines. Missing values remain visible and unfilled." actions={<><button className="button-secondary" onClick={onExport}><Download size={16} />Export CSV</button><button className="button-secondary" onClick={onUpload}><Upload size={16} />Import CSV</button><button className="button-primary" onClick={onAdd}><Plus size={17} />Add line item</button></>} />
    <section className="table-panel panel"><div className="table-toolbar"><div className="table-toolbar-left"><div className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search description, ref, category…" /></div><span className="line-count">{filtered.length} of {rows.length} lines</span></div><button className="filter-button" onClick={() => setQuery('')}><SlidersHorizontal size={15} />Clear filters</button></div>
      {filtered.length ? <div className="table-scroll"><table><thead><tr><th>LINE</th><th>DATE</th><th>DESCRIPTION</th><th>CATEGORY</th><th>REFERENCE</th><th className="amount-head">AMOUNT</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id} className={`${activeRow === row.id ? 'row-highlight' : ''} ${!row.category || !Number.isSafeInteger(row.amount) ? 'row-incomplete' : ''}`} onClick={() => setActiveRow(activeRow === row.id ? null : row.id)}><td><span className="line-number">{lineNo(row.id).padStart(3, '0')}</span></td><td className="date-cell">{fmtDate(row.date)}</td><td><div className="description-cell"><strong>{row.description || <span className="missing-value">Description missing</span>}</strong>{!row.date && <span className="cell-warning">Date missing</span>}</div></td><td>{row.category ? <span className="category-pill">{row.category}</span> : <span className="missing-pill"><CircleAlert size={12} />Missing</span>}</td><td className="reference-cell">{row.reference || <span className="missing-value">Missing</span>}</td><td className="amount-cell">{Number.isSafeInteger(row.amount) ? fmt(row.amount) : <span className="missing-pill"><CircleAlert size={12} />{row.rawAmount ? 'Unreadable' : 'Missing'}</span>}</td><td className="action-cell"><IconButton title="Edit line item" onClick={(event) => { event.stopPropagation(); onEdit(row); }}><Pencil size={15} /></IconButton></td></tr>)}</tbody></table></div> : <EmptyBlock icon={Search} title={rows.length ? 'No matches' : 'No line items yet'} description={rows.length ? 'Try a different search term or clear the filter.' : 'Import a CSV or add a line item to begin this review.'} />}
      <div className="table-footer"><span><CircleAlert size={14} />{rows.filter((row) => !row.category || !row.reference || !row.date || !row.description || !Number.isSafeInteger(row.amount)).length} lines have at least one missing or unreadable field</span><button className="text-button" onClick={onAdd}><Plus size={14} />Add a manual entry</button></div>
    </section>
    <div className="evidence-note"><ShieldAlert size={16} /><div><strong>Source lines are the evidence.</strong><span>Editing a line recalculates the totals. Review suggestions remain separate and never alter arithmetic on their own.</span></div></div>
  </>;
}

function ReviewPage({ findings, suggestions, reviewed, setReviewed, lineNo, getRow, goToLine, onExport }) {
  const toggleReviewed = (id) => setReviewed((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  return <>
    <PageHeading eyebrow="HUMAN REVIEW · 03" title="Review flags" subtitle="Potential issues and pattern-based suggestions for a person to investigate. These do not change reconciliation." actions={<button className="button-secondary" onClick={onExport}><Download size={16} />Export review report</button>} />
    <div className="review-safety"><div className="safety-mark"><ShieldAlert size={18} /></div><div><strong>A flag is a prompt to investigate, not a conclusion.</strong><span>An anomaly flag is not proof of corruption or wrongdoing. Every flag needs human investigation before any conclusion is drawn.</span></div></div>
    <section className="panel review-section"><div className="panel-heading"><div><div className="eyebrow">SOURCE CHECKS</div><h2>Entries to verify <span className="section-total">{findings.length}</span></h2></div><span className="review-label"><span className="status-dot amber" />Needs human review</span></div>
      {findings.length ? <div className="finding-list">{findings.map((item) => <FindingCard key={item.id} finding={item} lineNo={lineNo} getRow={getRow} reviewed={reviewed.includes(item.id)} onToggle={() => toggleReviewed(item.id)} onOpen={() => item.rows[0] && goToLine(item.rows[0])} />)}</div> : <EmptyBlock icon={CircleCheck} title="No review flags" description="No duplicates, missing fields, or amount outliers were found by these checks." />}
    </section>
    <section className="panel review-section suggestion-section"><div className="panel-heading"><div><div className="eyebrow">OPTIONAL ASSISTANCE</div><h2>Category suggestions <span className="section-total">{suggestions.length}</span></h2></div><span className="suggestion-label"><Sparkles size={14} />Rule-based suggestions</span></div>
      <p className="section-intro">Suggestions use description keywords and a confidence estimate. They are not AI findings, are not applied automatically, and never affect any reconciliation until a reviewer chooses to apply one.</p>
      {suggestions.length ? <div className="finding-list">{suggestions.map((item) => <FindingCard key={item.id} finding={item} lineNo={lineNo} getRow={getRow} onOpen={() => item.rows[0] && goToLine(item.rows[0])} />)}</div> : <EmptyBlock icon={Sparkles} title="No category suggestions" description="No unassigned description matched the local keyword rules." />}
    </section>
    <div className="method-card"><div className="method-icon"><Info size={16} /></div><div><strong>How flags are produced</strong><p>Duplicates require exact matches across date, description, category, amount, and reference. Amount outliers are highlighted when a line is at least three times its category median (with four or more comparable lines). These rules help prioritize review; they cannot establish intent or wrongdoing.</p></div></div>
  </>;
}

function FindingCard({ finding, lineNo, getRow, reviewed, onToggle, onOpen }) {
  const rowSummaries = finding.rows.map((id) => getRow(id)).filter(Boolean);
  return <article className={`finding-card finding-${finding.kind} ${reviewed ? 'is-reviewed' : ''}`}><div className="finding-symbol">{finding.kind === 'duplicate' ? <CopyIcon /> : finding.kind === 'missing' ? <CircleAlert size={18} /> : finding.kind === 'suggestion' ? <Sparkles size={18} /> : <BarChart3 size={18} />}</div><div className="finding-content"><div className="finding-title-row"><h3>{finding.title}</h3><span className={`finding-type type-${finding.kind}`}>{finding.kind === 'duplicate' ? 'POSSIBLE DUPLICATE' : finding.kind === 'missing' ? 'MISSING DATA' : finding.kind === 'suggestion' ? 'SUGGESTION' : 'PATTERN FLAG'}</span>{reviewed && <span className="reviewed-tag"><Check size={12} />Marked reviewed</span>}</div><p>{finding.reason}</p><div className="evidence-lines"><span className="evidence-label">EVIDENCE</span>{finding.rows.map((id, i) => { const row = getRow(id); return <button key={id} onClick={onOpen}>Line {lineNo(id)}{row?.reference ? ` · ${row.reference}` : ''}{i < finding.rows.length - 1 ? <span className="evidence-plus">+</span> : null}</button>; })}{rowSummaries.length > 0 && <span className="evidence-amount">{rowSummaries.map((row) => fmt(row.amount)).join(' / ')}</span>}</div>
      {finding.kind === 'suggestion' && <div className="confidence-track"><span>Confidence</span><div><i style={{ width: `${finding.confidence}%` }} /></div><strong>{finding.confidence}%</strong></div>}
      <div className="finding-actions"><button className="text-button" onClick={onOpen}>Open source line <ArrowUpRight size={14} /></button>{onToggle && <button className={`mark-reviewed ${reviewed ? 'marked' : ''}`} onClick={onToggle}>{reviewed ? <><CheckCheck size={14} />Reviewed</> : <><Check size={14} />Mark reviewed</>}</button>}</div>
    </div></article>;
}
function CopyIcon() { return <FileText size={18} />; }

function ReconciliationPage({ rows, declaredTotal, categoryTotals, findings, amountGaps, setDeclaredTotal, updateCategory, addCategoryTotal, deleteCategoryTotal, lineNo, goToLine, onExport, onPrint }) {
  const arithmetic = findings.filter((item) => ['verified', 'pending', 'matched'].includes(item.kind));
  const byId = new Map(arithmetic.map((item) => [item.id, item]));
  const totalFinding = byId.get('total-check');
  return <>
    <PageHeading eyebrow="EXACT ARITHMETIC · 04" title="Reconciliation" subtitle="Line sums and category sums are checked exactly in paise. Review flags do not alter these figures." actions={<><button className="button-secondary" onClick={onPrint}><Printer size={16} />Print report</button><button className="button-primary" onClick={onExport}><ArrowDownToLine size={16} />Export report</button></>} />
    <div className="recon-legend"><span><i className="legend-dot verified" />Verified arithmetic</span><span><i className="legend-dot suggestion" />Human review suggestion</span><span className="legend-note"><Info size={14} />Only verified arithmetic is used to report a discrepancy.</span></div>
    <section className="panel total-recon-card"><div className="recon-card-top"><div><div className="eyebrow">OVERALL TOTAL</div><h2>Do the line items add up?</h2></div><span className={`status-chip ${totalFinding?.kind === 'verified' ? 'chip-diff' : totalFinding?.kind === 'pending' || !totalFinding ? 'chip-pending' : 'chip-match'}`}>{totalFinding?.kind === 'verified' ? <><CircleAlert size={14} />Verified difference</> : totalFinding?.kind === 'pending' || !totalFinding ? <><Info size={14} />Needs complete data</> : <><CircleCheck size={14} />Matches</>}</span></div>
      <div className="recon-equation"><div className="equation-item"><span>Stated total</span><label className="money-input"><span>₹</span><input aria-label="Stated overall total in rupees" type="number" min="0" step="0.01" value={toInput(declaredTotal)} onChange={(event) => setDeclaredTotal(event.target.value)} placeholder="Enter stated total" /></label><small>From the budget document</small></div><div className="equation-symbol">−</div><div className="equation-item"><span>Sum of line items</span><strong>{fmt(exactSum(rows.filter((row) => Number.isSafeInteger(row.amount)).map((row) => row.amount)))}</strong><small>Readable amounts across {rows.length} lines</small></div><div className="equation-symbol">=</div><div className={`equation-item difference-box ${totalFinding?.kind === 'verified' ? 'diff' : totalFinding?.kind === 'matched' ? 'match' : ''}`}><span>Difference <Info size={13} title="Sum of line items minus stated total" /></span><strong>{!totalFinding || totalFinding.kind === 'pending' ? '—' : fmt(totalFinding.observed - totalFinding.stated)}</strong><small>{!totalFinding ? 'Enter a stated total' : totalFinding.kind === 'pending' ? `${amountGaps ? `${amountGaps} amount field(s) missing; ` : ''}not verified` : 'Observed lines minus stated total'}</small></div></div>
      {totalFinding && <FindingEvidence finding={totalFinding} lineNo={lineNo} goToLine={goToLine} />}
      {amountGaps > 0 && <div className="inline-pending"><Info size={15} /><span>Full total is not verifiable until all {amountGaps} missing or unreadable amount field(s) are corrected. The displayed sum is only the sum of readable amounts.</span></div>}
    </section>
    <section className="panel category-recon-card"><div className="panel-heading"><div><div className="eyebrow">CATEGORY TOTALS</div><h2>Match each stated category to its lines</h2></div><button className="button-small" onClick={addCategoryTotal}><Plus size={14} />Add category</button></div>
      <div className="category-table-wrap"><table className="category-recon-table"><thead><tr><th>CATEGORY</th><th>STATED AMOUNT</th><th>SUM OF LINES</th><th>DIFFERENCE</th><th>CHECK</th><th></th></tr></thead><tbody>{categoryTotals.map((item, index) => {
        const id = `category-${normalized(item.category).replace(/[^a-z0-9]+/g, '-')}`;
        const result = byId.get(id);
        const missingStated = item.amount == null;
        const status = missingStated ? 'pending' : result?.kind || 'pending';
        return <tr key={`${item.category}-${index}`}><td><input className="category-input" aria-label="Category name" value={item.category} onChange={(event) => updateCategory(index, 'category', event.target.value)} placeholder="Category name" /></td><td><label className="inline-money"><span>₹</span><input aria-label={`Stated amount for ${item.category || 'new category'}`} type="number" min="0" step="0.01" value={toInput(item.amount)} onChange={(event) => updateCategory(index, 'amount', event.target.value)} placeholder="0.00" /></label></td><td>{item.category ? result?.kind === 'pending' ? '—' : fmt(result?.observed ?? 0) : '—'}</td><td className={status === 'verified' ? 'text-red' : status === 'matched' ? 'text-green' : 'text-muted'}>{status === 'pending' || result?.stated == null || !result ? '—' : fmt(result.observed - result.stated)}</td><td><span className={`table-check ${status}`}>{status === 'verified' ? <><CircleAlert size={13} />Difference</> : status === 'matched' ? <><CircleCheck size={13} />Matches</> : <><Info size={13} />Pending</>}</span></td><td><IconButton title="Remove category total" onClick={() => deleteCategoryTotal(index)}><X size={15} /></IconButton></td></tr>;
      })}{categoryTotals.length === 0 && <tr><td colSpan="6"><EmptyBlock icon={FileCheck2} title="No category totals entered" description="Add a stated category total to compare it with the matching line items." /></td></tr>}</tbody></table></div>
      <div className="category-recon-note"><Info size={14} />Each check compares stated category amount with lines carrying that label. A missing category stays unassigned; it is not guessed into a category.</div>
    </section>
    <section className="report-note"><ShieldAlert size={17} /><div><strong>Keep arithmetic and anomaly review separate.</strong><span>{reviewFlagsCount(findings)} potential review flags do not change the checked sums. An anomaly flag is not proof of corruption or wrongdoing; every flag needs human investigation before any conclusion.</span></div></section>
  </>;
}
function reviewFlagsCount(findings) { return findings.filter((item) => ['duplicate', 'missing', 'unusual', 'suggestion'].includes(item.kind)).length; }
function FindingEvidence({ finding, lineNo, goToLine }) {
  return <div className="recon-evidence"><span className="evidence-label">CHECK EVIDENCE</span><span>{finding.reason}</span><div>{finding.rows.slice(0, 12).map((id) => <button key={id} onClick={() => goToLine(id)}>Line {lineNo(id)} <ArrowUpRight size={12} /></button>)}{finding.rows.length > 12 && <span>+{finding.rows.length - 12} more lines</span>}</div></div>;
}

function RowModal({ row, onClose, onSave, onDelete }) {
  const [form, setForm] = useState({ date: row?.date || '', description: row?.description || '', category: row?.category || '', amount: row?.amount == null ? row?.rawAmount || '' : toInput(row.amount), reference: row?.reference || '' });
  const input = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  return <Modal onClose={onClose} title={row ? 'Edit line item' : 'Add line item'} subtitle="Enter values as they appear in the source record. Leave unclear fields blank."><form className="row-form" onSubmit={(event) => { event.preventDefault(); onSave(form, row?.id); }}>
    <div className="form-grid"><label>Date<input type="date" value={form.date} onChange={(event) => input('date', event.target.value)} /></label><label>Amount (INR)<div className="form-money"><span>₹</span><input type="number" min="0" step="0.01" placeholder="0.00" value={form.amount} onChange={(event) => input('amount', event.target.value)} /></div></label><label className="form-wide">Description<input value={form.description} onChange={(event) => input('description', event.target.value)} placeholder="What was purchased or paid for?" /></label><label>Category<input list="category-options" value={form.category} onChange={(event) => input('category', event.target.value)} placeholder="Leave blank if unclear" /><datalist id="category-options">{[...KNOWN_CATEGORIES, ...new Set(SAMPLE_ROWS.map((item) => item.category).filter(Boolean))].map((item) => <option value={item} key={item} />)}</datalist></label><label>Reference<input value={form.reference} onChange={(event) => input('reference', event.target.value)} placeholder="Voucher or invoice number" /></label></div><div className="modal-foot"><span><Info size={14} />Blank fields stay visible in the review.</span><div>{row && <button type="button" className="delete-button" onClick={() => onDelete(row.id)}>Remove line</button>}<button type="button" className="button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="button-primary"><Check size={15} />Save line</button></div></div>
  </form></Modal>;
}

function HelpModal({ onClose }) {
  return <Modal onClose={onClose} title="How BudgetClear works" subtitle="A reviewer’s aid for arithmetic checks and evidence-led follow-up."><div className="help-content"><div><span className="help-number">01</span><p><strong>Bring in source lines</strong>Upload a CSV with date, description, category, amount, and reference columns, or add entries manually. Missing fields stay blank.</p></div><div><span className="help-number">02</span><p><strong>Enter stated totals</strong>Type the amounts from the budget document. BudgetClear compares them with the exact sum of readable line items and each entered category total.</p></div><div><span className="help-number">03</span><p><strong>Review flags separately</strong>Duplicate patterns, missing fields, outliers, and category suggestions are prompts for human review. Suggestions are never applied without a reviewer action.</p></div><div className="help-warning"><ShieldAlert size={17} /><p><strong>Anomaly flags are not proof of corruption or wrongdoing.</strong> Every flag needs human investigation before any conclusion is drawn.</p></div><div className="help-local"><Info size={15} /><span>Records are saved to this browser’s local storage on this device. This demo has no server account or cloud sync. Download a report to share your findings.</span></div></div><div className="modal-foot single-action"><span>Built for transparent arithmetic and careful review.</span><button className="button-primary" onClick={onClose}>Got it</button></div></Modal>;
}

function BudgetModal({ name, onClose, onRename, onNew, onReset }) {
  const [value, setValue] = useState(name);
  return <Modal onClose={onClose} title="Review settings" subtitle="Name this review or start with a fresh one."><form onSubmit={(event) => { event.preventDefault(); onRename(value); }} className="budget-form"><label>Review name<input value={value} onChange={(event) => setValue(event.target.value)} /></label><div className="budget-options"><button type="button" onClick={onNew}><Plus size={16} /><span><strong>Start a new review</strong><small>Clear current lines and totals</small></span><ArrowRight size={15} /></button><button type="button" onClick={onReset}><Sparkles size={16} /><span><strong>Restore sample review</strong><small>Reload the included demonstration data</small></span><ArrowRight size={15} /></button></div><div className="modal-foot"><span>Saved in this browser only.</span><div><button type="button" className="button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="button-primary"><Check size={15} />Save name</button></div></div></form></Modal>;
}

function Modal({ onClose, title, subtitle, children }) {
  useEffect(() => { const handler = (event) => { if (event.key === 'Escape') onClose(); }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-header"><div><h2>{title}</h2><p>{subtitle}</p></div><IconButton title="Close dialog" onClick={onClose}><X size={19} /></IconButton></div>{children}</section></div>;
}

export default App;
