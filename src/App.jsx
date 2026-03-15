import { startTransition, useDeferredValue, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDownUp,
  ArrowDownLeft,
  ArrowUpRight,
  BadgeIndianRupee,
  CheckCheck,
  CircleOff,
  BriefcaseBusiness,
  CalendarRange,
  ChartNoAxesCombined,
  CircleDollarSign,
  Download,
  Filter,
  HandCoins,
  Landmark,
  PencilLine,
  PiggyBank,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Tags,
  Trash2,
  Waypoints,
  Workflow,
  XCircle,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Layout from './components/Layout.jsx';
import RuleEditorModal from './components/RuleEditorModal.jsx';
import SectionCard from './components/SectionCard.jsx';
import StatCard from './components/StatCard.jsx';
import TransactionEditorModal from './components/TransactionEditorModal.jsx';
import UploadPanel from './components/UploadPanel.jsx';
import { buildAnalytics } from './utils/analytics.js';
import { reclassifyStoredTransaction } from './utils/classification.js';
import { formatCurrency, formatDateLabel, formatInteger, formatSignedCurrency, monthLabelFromKey } from './utils/format.js';
import {
  clearTransactionOverride,
  createEmptyProfile,
  dismissSuggestion,
  loadStoredProfile,
  mergeProfiles,
  removeStatementFromProfile,
  saveStoredProfile,
  removeBulkRule,
  toggleBulkRule,
  upsertBulkRule,
  upsertTransactionOverride,
} from './utils/storage.js';
import { applyOverridesToTransactions, applyRulesToTransactions, buildPassThroughSuggestions } from './utils/transactionOverrides.js';

const tooltipStyle = {
  background: 'rgba(15, 23, 42, 0.92)',
  border: '1px solid rgba(148, 163, 184, 0.18)',
  borderRadius: '18px',
  boxShadow: '0 20px 40px rgba(2, 6, 23, 0.28)',
};

const bucketText = {
  essential: 'Essential',
  nonEssential: 'Non-essential',
  capital: 'Capital / Big-ticket',
  wealth: 'Investment',
  wealthReturn: 'Wealth Returned',
  debt: 'Debt',
  transfer: 'Transfer',
  uncategorized: 'Uncategorized',
  income: 'Income',
};

const bucketOptions = [
  { value: 'essential', label: 'Essential' },
  { value: 'nonEssential', label: 'Non-essential' },
  { value: 'capital', label: 'Capital / Big-ticket' },
  { value: 'wealth', label: 'Investment' },
  { value: 'wealthReturn', label: 'Wealth Returned' },
  { value: 'debt', label: 'Debt' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'uncategorized', label: 'Uncategorized' },
  { value: 'income', label: 'Income' },
];

const flowText = {
  all: 'All flows',
  debit: 'Outflows only',
  credit: 'Inflows only',
};

const reviewScopeText = {
  included: 'Included in analysis',
  excluded: 'Excluded only',
  customized: 'Customized only',
  all: 'All transactions',
};

const ruleMatchFieldText = {
  merchant: 'Merchant',
  narration: 'Narration',
  refNo: 'Reference',
};

const describeRuleMatch = (rule) => {
  const operatorText = rule.operator === 'equals' ? 'equals' : 'contains';
  const directionText = rule.direction === 'all' ? 'all flows' : `${rule.direction}s`;
  return `${ruleMatchFieldText[rule.matchField] || rule.matchField} ${operatorText} "${rule.matchValue}" on ${directionText}`;
};

const describeRuleActions = (rule, bucketLabels) => {
  const parts = [];
  if (rule.patch.merchant) parts.push(`merchant -> ${rule.patch.merchant}`);
  if (rule.patch.category) parts.push(`category -> ${rule.patch.category}`);
  if (rule.patch.bucketGroup) parts.push(`bucket -> ${bucketLabels[rule.patch.bucketGroup] || rule.patch.bucketGroup}`);
  if (rule.patch.tags?.length) parts.push(`tags -> ${rule.patch.tags.join(', ')}`);
  if (rule.patch.excludeFromAnalysis) parts.push('exclude from analysis');
  if (rule.patch.note) parts.push('attach note');
  return parts.join(' · ');
};

const amountBandText = {
  all: 'Any amount',
  under500: 'Under Rs 500',
  between500And5000: 'Rs 500 to Rs 5,000',
  between5000And25000: 'Rs 5,000 to Rs 25,000',
  between25000And100000: 'Rs 25,000 to Rs 1,00,000',
  above100000: 'Above Rs 1,00,000',
};

const sortLabelText = {
  'date:desc': 'Newest first',
  'date:asc': 'Oldest first',
  'amount:desc': 'Amount high to low',
  'amount:asc': 'Amount low to high',
  'merchant:asc': 'Merchant A to Z',
  'merchant:desc': 'Merchant Z to A',
  'category:asc': 'Category A to Z',
  'category:desc': 'Category Z to A',
  'balance:desc': 'Balance high to low',
  'balance:asc': 'Balance low to high',
};

const sortChoices = [
  { value: 'date:desc', label: sortLabelText['date:desc'] },
  { value: 'date:asc', label: sortLabelText['date:asc'] },
  { value: 'amount:desc', label: sortLabelText['amount:desc'] },
  { value: 'amount:asc', label: sortLabelText['amount:asc'] },
  { value: 'merchant:asc', label: sortLabelText['merchant:asc'] },
  { value: 'merchant:desc', label: sortLabelText['merchant:desc'] },
  { value: 'category:asc', label: sortLabelText['category:asc'] },
  { value: 'category:desc', label: sortLabelText['category:desc'] },
  { value: 'balance:desc', label: sortLabelText['balance:desc'] },
  { value: 'balance:asc', label: sortLabelText['balance:asc'] },
];

const rowsPerPageChoices = ['100', '250', '500', '1000', 'all'];

const categoryFlowText = {
  debit: 'Outflow categories',
  credit: 'Income categories',
  all: 'All category movement',
};

const categorySortText = {
  'amount:desc': 'Highest total first',
  'amount:asc': 'Lowest total first',
  'label:asc': 'Category A to Z',
  'label:desc': 'Category Z to A',
  'count:desc': 'Most transactions first',
};

const categorySortChoices = [
  { value: 'amount:desc', label: categorySortText['amount:desc'] },
  { value: 'amount:asc', label: categorySortText['amount:asc'] },
  { value: 'label:asc', label: categorySortText['label:asc'] },
  { value: 'label:desc', label: categorySortText['label:desc'] },
  { value: 'count:desc', label: categorySortText['count:desc'] },
];

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

const compareText = (left, right) => collator.compare(String(left || ''), String(right || ''));

const matchesAmountBand = (amount, band) => {
  if (band === 'all') return true;
  if (band === 'under500') return amount < 500;
  if (band === 'between500And5000') return amount >= 500 && amount < 5000;
  if (band === 'between5000And25000') return amount >= 5000 && amount < 25000;
  if (band === 'between25000And100000') return amount >= 25000 && amount < 100000;
  if (band === 'above100000') return amount >= 100000;
  return true;
};

const sortTransactions = (transactions, sortField, sortDirection) => {
  const modifier = sortDirection === 'asc' ? 1 : -1;

  return [...transactions].sort((left, right) => {
    let result = 0;

    if (sortField === 'amount') {
      result = Number(left.amount || 0) - Number(right.amount || 0);
    } else if (sortField === 'merchant') {
      result = compareText(left.merchant, right.merchant);
    } else if (sortField === 'category') {
      result = compareText(left.category, right.category) || compareText(left.merchant, right.merchant);
    } else if (sortField === 'balance') {
      result = Number(left.balance || 0) - Number(right.balance || 0);
    } else {
      result = compareText(left.date, right.date)
        || compareText(left.valueDate, right.valueDate)
        || compareText(left.merchant, right.merchant)
        || (Number(left.order || 0) - Number(right.order || 0));
    }

    return result * modifier;
  });
};

const buildCategorySummaries = (transactions, flowMode, sortMode) => {
  const [sortField, sortDirection = 'desc'] = String(sortMode || 'amount:desc').split(':');
  const modifier = sortDirection === 'asc' ? 1 : -1;
  const groups = new Map();

  transactions
    .filter((transaction) => flowMode === 'all' || transaction.direction === flowMode)
    .forEach((transaction) => {
      const current = groups.get(transaction.category) || {
        label: transaction.category,
        amount: 0,
        count: 0,
        creditAmount: 0,
        debitAmount: 0,
        latestDate: transaction.date,
        largestAmount: 0,
      };

      current.amount += Number(transaction.amount || 0);
      current.count += 1;
      current.latestDate = current.latestDate > transaction.date ? current.latestDate : transaction.date;
      current.largestAmount = Math.max(current.largestAmount, Number(transaction.amount || 0));
      if (transaction.direction === 'credit') {
        current.creditAmount += Number(transaction.amount || 0);
      } else {
        current.debitAmount += Number(transaction.amount || 0);
      }

      groups.set(transaction.category, current);
    });

  return [...groups.values()].sort((left, right) => {
    let result = 0;

    if (sortField === 'label') {
      result = compareText(left.label, right.label);
    } else if (sortField === 'count') {
      result = left.count - right.count;
    } else {
      result = left.amount - right.amount;
    }

    if (result === 0) {
      result = compareText(left.label, right.label);
    }

    return result * modifier;
  });
};

const TransactionDirection = ({ direction, amount }) => (
  <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-bold ${
    direction === 'credit'
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200'
      : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200'
  }`}
  >
    {direction === 'credit' ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
    {direction === 'credit' ? 'Credit' : 'Debit'}
    <span className="opacity-80">{formatCurrency(amount)}</span>
  </span>
);

const EmptyState = ({ title, body }) => (
  <div className="rounded-[1.5rem] border border-dashed border-slate-200/90 bg-slate-50/70 px-5 py-8 text-center dark:border-white/10 dark:bg-white/[0.03]">
    <p className="text-sm font-bold text-slate-700 dark:text-white">{title}</p>
    <p className="mt-2 text-sm text-slate-500 dark:text-white/55">{body}</p>
  </div>
);

const ChartTooltip = ({ active, payload, label, formatter = formatCurrency }) => {
  if (!active || !payload?.length) return null;

  return (
    <div style={tooltipStyle}>
      <div className="border-b border-white/10 px-4 py-3">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-white/60">{label}</p>
      </div>
      <div className="space-y-2 px-4 py-3 text-sm text-white">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-5">
            <span className="flex items-center gap-2 text-white/70">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: entry.color }} />
              {entry.name}
            </span>
            <span className="font-semibold">{formatter(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const SortableHeader = ({ label, sortKey, currentField, currentDirection, defaultDirection = 'asc', onSort }) => {
  const active = currentField === sortKey;

  return (
    <button
      type="button"
      onClick={() => onSort(sortKey, defaultDirection)}
      className={`inline-flex items-center gap-1.5 transition-colors ${
        active
          ? 'text-slate-700 dark:text-white'
          : 'text-slate-400 hover:text-slate-600 dark:text-white/35 dark:hover:text-white/70'
      }`}
      title={`Sort by ${label}`}
    >
      <span>{label}</span>
      <ArrowDownUp size={12} className={active ? 'opacity-100' : 'opacity-55'} />
      {active ? <span className="text-[10px]">{currentDirection === 'asc' ? '↑' : '↓'}</span> : null}
    </button>
  );
};

function App() {
  const [profile, setProfile] = useState(() => loadStoredProfile());
  const [status, setStatus] = useState(null);
  const [importing, setImporting] = useState(false);
  const [scopeYear, setScopeYear] = useState('all');
  const [scopeStatementId, setScopeStatementId] = useState('all');
  const [flowFilter, setFlowFilter] = useState('all');
  const [bucketFilter, setBucketFilter] = useState('all');
  const [merchantFilter, setMerchantFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [amountBandFilter, setAmountBandFilter] = useState('all');
  const [reviewScope, setReviewScope] = useState('included');
  const [categoryExplorerFlow, setCategoryExplorerFlow] = useState('debit');
  const [categoryExplorerSort, setCategoryExplorerSort] = useState('amount:desc');
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [rowsLimit, setRowsLimit] = useState('250');
  const [searchText, setSearchText] = useState('');
  const [editorTransactionKey, setEditorTransactionKey] = useState(null);
  const [ruleEditorDraft, setRuleEditorDraft] = useState(null);

  const deferredSearch = useDeferredValue(searchText);
  const hasData = profile.transactions.length > 0;
  const refreshedTransactions = profile.transactions.map((transaction) => reclassifyStoredTransaction(transaction));
  const ruleAdjustedTransactions = applyRulesToTransactions(refreshedTransactions, profile.rules);
  const effectiveTransactions = applyOverridesToTransactions(ruleAdjustedTransactions, profile.overrides);
  const years = [...new Set(effectiveTransactions.map((transaction) => transaction.year))].sort((left, right) => right - left);
  const scopedTransactions = effectiveTransactions.filter((transaction) => {
    if (scopeYear !== 'all' && Number(transaction.year) !== Number(scopeYear)) return false;
    if (scopeStatementId !== 'all' && transaction.statementId !== scopeStatementId) return false;
    return true;
  });
  const analytics = buildAnalytics(
    {
      ...profile,
      transactions: effectiveTransactions.filter((transaction) => !transaction.excludedFromAnalysis),
    },
    { year: scopeYear, statementId: scopeStatementId },
  );
  const merchantOptions = [...new Set(scopedTransactions.map((transaction) => transaction.merchant).filter(Boolean))].sort(compareText);
  const categoryOptions = [...new Set(scopedTransactions.map((transaction) => transaction.category).filter(Boolean))].sort(compareText);
  const tagOptions = [...new Set(scopedTransactions.flatMap((transaction) => transaction.tags || []).filter(Boolean))].sort(compareText);
  const categorySummaries = buildCategorySummaries(analytics.transactions, categoryExplorerFlow, categoryExplorerSort);
  const passThroughSuggestions = buildPassThroughSuggestions(scopedTransactions, profile.dismissedSuggestionKeys);
  const customizedTransactions = effectiveTransactions.filter((transaction) => transaction.hasOverride || transaction.hasRule);
  const excludedTransactions = effectiveTransactions.filter((transaction) => transaction.excludedFromAnalysis);
  const taggedTransactions = effectiveTransactions.filter((transaction) => transaction.tags?.length);
  const scopedCustomizedTransactions = scopedTransactions.filter((transaction) => transaction.hasOverride || transaction.hasRule);
  const scopedExcludedTransactions = scopedTransactions.filter((transaction) => transaction.excludedFromAnalysis);
  const activeRules = (profile.rules || []).filter((rule) => rule.enabled);
  const inactiveRules = (profile.rules || []).filter((rule) => !rule.enabled);
  const excludedOutflowTotal = excludedTransactions
    .filter((transaction) => transaction.direction === 'debit')
    .reduce((total, transaction) => total + Number(transaction.amount || 0), 0);
  const excludedInflowTotal = excludedTransactions
    .filter((transaction) => transaction.direction === 'credit')
    .reduce((total, transaction) => total + Number(transaction.amount || 0), 0);
  const editorTransaction = effectiveTransactions.find((transaction) => transaction.uniqueKey === editorTransactionKey) || null;
  const categorySuggestions = [...new Set([...categoryOptions, 'Vehicle Purchase', 'Asset Purchase', 'Family Transfer', 'Investment Funding'])].sort(compareText);
  const tagSuggestions = [...new Set([...tagOptions, 'vehicle', 'asset', 'family', 'pass-through', 'one-off', 'investment', 'reimbursable'])].sort(compareText);

  useEffect(() => {
    saveStoredProfile(profile);
  }, [profile]);

  useEffect(() => {
    if (!status) return undefined;
    const timeout = window.setTimeout(() => setStatus(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [status]);

  useEffect(() => {
    if (merchantFilter !== 'all' && !merchantOptions.includes(merchantFilter)) {
      setMerchantFilter('all');
    }
  }, [merchantFilter, merchantOptions]);

  useEffect(() => {
    if (categoryFilter !== 'all' && !categoryOptions.includes(categoryFilter)) {
      setCategoryFilter('all');
    }
  }, [categoryFilter, categoryOptions]);

  useEffect(() => {
    if (tagFilter !== 'all' && !tagOptions.includes(tagFilter)) {
      setTagFilter('all');
    }
  }, [tagFilter, tagOptions]);

  useEffect(() => {
    if (editorTransactionKey && !effectiveTransactions.some((transaction) => transaction.uniqueKey === editorTransactionKey)) {
      setEditorTransactionKey(null);
    }
  }, [editorTransactionKey, effectiveTransactions]);

  const visibleTransactions = sortTransactions(scopedTransactions.filter((transaction) => {
    if (reviewScope === 'included' && transaction.excludedFromAnalysis) return false;
    if (reviewScope === 'excluded' && !transaction.excludedFromAnalysis) return false;
    if (reviewScope === 'customized' && !(transaction.hasOverride || transaction.hasRule)) return false;
    if (flowFilter !== 'all' && transaction.direction !== flowFilter) return false;
    if (bucketFilter !== 'all' && transaction.bucketGroup !== bucketFilter) return false;
    if (merchantFilter !== 'all' && transaction.merchant !== merchantFilter) return false;
    if (categoryFilter !== 'all' && transaction.category !== categoryFilter) return false;
    if (tagFilter !== 'all' && !(transaction.tags || []).includes(tagFilter)) return false;
    if (!matchesAmountBand(Number(transaction.amount || 0), amountBandFilter)) return false;
    if (!deferredSearch.trim()) return true;
    const needle = deferredSearch.toLowerCase();
    return [
      transaction.merchant,
      transaction.category,
      transaction.narration,
      transaction.refNo,
      transaction.accountLabel,
      transaction.note,
      ...(transaction.appliedRuleLabels || []),
      ...(transaction.tags || []),
    ].some((field) => String(field || '').toLowerCase().includes(needle));
  }), sortField, sortDirection);

  const visibleCreditsTotal = visibleTransactions
    .filter((transaction) => transaction.direction === 'credit')
    .reduce((total, transaction) => total + Number(transaction.amount || 0), 0);
  const visibleDebitsTotal = visibleTransactions
    .filter((transaction) => transaction.direction === 'debit')
    .reduce((total, transaction) => total + Number(transaction.amount || 0), 0);
  const visibleNet = visibleCreditsTotal - visibleDebitsTotal;
  const renderedTransactions = rowsLimit === 'all'
    ? visibleTransactions
    : visibleTransactions.slice(0, Number(rowsLimit));
  const selectedCategorySummary = categoryFilter === 'all'
    ? null
    : {
      label: categoryFilter,
      amount: visibleTransactions.reduce((total, transaction) => total + Number(transaction.amount || 0), 0),
      count: visibleTransactions.length,
      creditAmount: visibleCreditsTotal,
      debitAmount: visibleDebitsTotal,
      largestAmount: Math.max(...visibleTransactions.map((transaction) => Number(transaction.amount || 0)), 0),
      latestDate: visibleTransactions[0]?.date || null,
    };
  const focusedCategoryLabel = categoryFilter !== 'all' ? categoryFilter : categorySummaries[0]?.label;
  const focusedCategorySummary = focusedCategoryLabel
    ? categorySummaries.find((item) => item.label === focusedCategoryLabel) || selectedCategorySummary
    : null;
  const categoryChartHeight = Math.max(340, Math.min(categorySummaries.length * 44, 720));

  const coverageLabel = hasData
    ? `${formatDateLabel(profile.transactions.at(-1)?.date)} to ${formatDateLabel(profile.transactions[0]?.date)}`
    : '';

  const resetTransactionExplorer = () => {
    setScopeYear('all');
    setScopeStatementId('all');
    setFlowFilter('all');
    setBucketFilter('all');
    setMerchantFilter('all');
    setCategoryFilter('all');
    setTagFilter('all');
    setAmountBandFilter('all');
    setReviewScope('included');
    setCategoryExplorerFlow('debit');
    setCategoryExplorerSort('amount:desc');
    setSortField('date');
    setSortDirection('desc');
    setRowsLimit('250');
    setSearchText('');
  };

  const handleSortSelection = (value) => {
    const [field, direction] = value.split(':');
    setSortField(field);
    setSortDirection(direction);
  };

  const handleHeaderSort = (field, defaultDirection) => {
    if (sortField === field) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortField(field);
    setSortDirection(defaultDirection);
  };

  const handleCategoryDrilldown = (categoryLabel, suggestedFlow = categoryExplorerFlow) => {
    if (!categoryLabel) return;
    setCategoryFilter(categoryLabel);
    if (suggestedFlow !== 'all') {
      setFlowFilter(suggestedFlow);
    }
    setReviewScope('included');
    setSortField('amount');
    setSortDirection('desc');
    setRowsLimit('all');
    document.getElementById('transactions')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openRuleEditor = (draft) => {
    setEditorTransactionKey(null);
    setRuleEditorDraft(draft);
  };

  const handleCreateRuleFromTransaction = ({ transaction, draft }) => {
    const rawMerchant = transaction.rawMerchant || transaction.merchant;
    const rawCategory = transaction.rawCategory || transaction.category;
    const rawBucketGroup = transaction.rawBucketGroup || transaction.bucketGroup;
    const nextMerchant = draft?.merchant || transaction.merchant;
    const nextCategory = draft?.category || transaction.category;
    const nextBucketGroup = draft?.bucketGroup || transaction.bucketGroup;

    openRuleEditor({
      label: '',
      enabled: true,
      matchField: 'merchant',
      operator: 'equals',
      direction: transaction.direction,
      matchValue: rawMerchant,
      patch: {
        merchant: nextMerchant !== rawMerchant ? nextMerchant : '',
        category: nextCategory !== rawCategory ? nextCategory : '',
        bucketGroup: nextBucketGroup !== rawBucketGroup ? nextBucketGroup : '',
        tags: draft?.tags || transaction.tags || [],
        note: draft?.note || transaction.note || '',
        excludeFromAnalysis: Boolean(draft?.excludeFromAnalysis || transaction.excludedFromAnalysis),
      },
    });
  };

  const handleSaveBulkRule = (rule) => {
    const hasAction = Boolean(
      rule?.patch?.merchant
      || rule?.patch?.category
      || rule?.patch?.bucketGroup
      || rule?.patch?.note
      || rule?.patch?.excludeFromAnalysis
      || rule?.patch?.tags?.length,
    );

    if (!rule?.matchValue || !hasAction) {
      setStatus({
        type: 'error',
        message: 'Add a match value and at least one change for the bulk rule before saving it.',
      });
      return;
    }

    setProfile((current) => upsertBulkRule(current, rule));
    setRuleEditorDraft(null);
    setStatus({ type: 'success', message: 'Bulk rule saved. It will apply to matching current and future transactions.' });
  };

  const handleToggleBulkRule = (ruleId) => {
    const rule = (profile.rules || []).find((item) => item.id === ruleId);
    setProfile((current) => toggleBulkRule(current, ruleId));
    if (rule) {
      setStatus({
        type: 'success',
        message: rule.enabled ? 'Bulk rule paused.' : 'Bulk rule enabled.',
      });
    }
  };

  const handleDeleteBulkRule = (ruleId) => {
    const rule = (profile.rules || []).find((item) => item.id === ruleId);
    if (rule && !window.confirm(`Delete the rule "${rule.label || 'Untitled rule'}"?`)) return;
    setProfile((current) => removeBulkRule(current, ruleId));
    setStatus({ type: 'success', message: 'Bulk rule deleted.' });
  };

  const handleSaveTransactionOverride = (uniqueKey, patch) => {
    const baseTransaction = ruleAdjustedTransactions.find((transaction) => transaction.uniqueKey === uniqueKey)
      || profile.transactions.find((transaction) => transaction.uniqueKey === uniqueKey);
    const cleanedPatch = {
      merchant: patch.merchant && patch.merchant !== baseTransaction?.merchant ? patch.merchant : undefined,
      category: patch.category && patch.category !== baseTransaction?.category ? patch.category : undefined,
      bucketGroup: patch.bucketGroup && patch.bucketGroup !== baseTransaction?.bucketGroup ? patch.bucketGroup : undefined,
      tags: patch.tags || [],
      note: patch.note || '',
      excludeFromAnalysis: Boolean(patch.excludeFromAnalysis),
    };

    setProfile((current) => upsertTransactionOverride(current, uniqueKey, cleanedPatch));
    setEditorTransactionKey(null);
    setStatus({ type: 'success', message: 'Transaction review changes were saved locally.' });
  };

  const handleClearTransactionReview = (uniqueKey) => {
    setProfile((current) => clearTransactionOverride(current, uniqueKey));
    setEditorTransactionKey(null);
    setStatus({ type: 'success', message: 'Transaction review changes were reset to the imported values.' });
  };

  const handleToggleExcludeTransaction = (transaction) => {
    setProfile((current) => upsertTransactionOverride(current, transaction.uniqueKey, {
      excludeFromAnalysis: !transaction.excludedFromAnalysis,
    }));
    setStatus({
      type: 'success',
      message: transaction.excludedFromAnalysis
        ? 'Transaction added back into the analysis.'
        : 'Transaction excluded from the analysis.',
    });
  };

  const handleAcceptSuggestion = (suggestion) => {
    const note = suggestion.daysApart === 0
      ? 'Excluded as a same-day pass-through credit to investment move.'
      : 'Excluded as a next-day pass-through credit to investment move.';
    const nextCreditTags = [...new Set([...(suggestion.credit.tags || []), 'pass-through'])];
    const nextDebitTags = [...new Set([...(suggestion.debit.tags || []), 'pass-through', 'investment'])];

    setProfile((current) => {
      let nextProfile = upsertTransactionOverride(current, suggestion.credit.uniqueKey, {
        excludeFromAnalysis: true,
        tags: nextCreditTags,
        note: suggestion.credit.note || note,
      });

      nextProfile = upsertTransactionOverride(nextProfile, suggestion.debit.uniqueKey, {
        excludeFromAnalysis: true,
        tags: nextDebitTags,
        note: suggestion.debit.note || note,
      });

      return nextProfile;
    });

    setStatus({
      type: 'success',
      message: 'That pass-through pair was excluded from the dashboard analysis.',
    });
  };

  const handleDismissSuggestion = (suggestionKey) => {
    setProfile((current) => dismissSuggestion(current, suggestionKey));
  };

  const handleImport = async ({ files, password, mode }) => {
    setImporting(true);
    setStatus(null);

    try {
      const { parseStatementPdf } = await import('./utils/pdfParser.js');
      const importedStatements = [];
      const importedTransactions = [];

      for (const file of files) {
        const parsed = await parseStatementPdf(file, password);
        importedStatements.push(parsed.statement);
        importedTransactions.push(...parsed.transactions);
      }

      const nextProfile = mergeProfiles(
        profile,
        {
          statements: importedStatements,
          transactions: importedTransactions,
        },
        mode,
      );

      startTransition(() => {
        setProfile(nextProfile);
        setEditorTransactionKey(null);
        setRuleEditorDraft(null);
        setScopeYear('all');
        setScopeStatementId('all');
        setFlowFilter('all');
        setBucketFilter('all');
        setMerchantFilter('all');
        setCategoryFilter('all');
        setTagFilter('all');
        setAmountBandFilter('all');
        setReviewScope('included');
        setSortField('date');
        setSortDirection('desc');
        setRowsLimit('250');
        setSearchText('');
      });

      setStatus({
        type: 'success',
        message: `Imported ${importedStatements.length} statement${importedStatements.length === 1 ? '' : 's'} and ${formatInteger(importedTransactions.length)} transactions.`,
      });
    } catch (error) {
      setStatus({
        type: 'error',
        message: error?.message || 'The import failed. Please try again with the statement password.',
      });
    } finally {
      setImporting(false);
    }
  };

  const handleExport = () => {
    if (!hasData) return;
    const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = `statement-atlas-profile-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(href);
  };

  const handleClear = () => {
    if (!hasData) return;
    if (!window.confirm('Clear the locally stored profile and remove all imported statements from this browser?')) return;
    setProfile(createEmptyProfile());
    setEditorTransactionKey(null);
    setRuleEditorDraft(null);
    setScopeYear('all');
    setScopeStatementId('all');
    setFlowFilter('all');
    setBucketFilter('all');
    setMerchantFilter('all');
    setCategoryFilter('all');
    setTagFilter('all');
    setAmountBandFilter('all');
    setReviewScope('included');
    setSortField('date');
    setSortDirection('desc');
    setRowsLimit('250');
    setSearchText('');
    setStatus({ type: 'success', message: 'The local profile was cleared from this browser.' });
  };

  const handleDownloadFilteredCsv = () => {
    if (!visibleTransactions.length) return;

    const rows = [
      ['Date', 'Value Date', 'Flow', 'Merchant', 'Category', 'Bucket', 'Tags', 'Excluded', 'Rule labels', 'Note', 'Amount', 'Balance', 'Narration', 'Reference', 'Statement', 'Account'],
      ...visibleTransactions.map((transaction) => ([
        transaction.date,
        transaction.valueDate,
        transaction.direction,
        transaction.merchant,
        transaction.category,
        bucketText[transaction.bucketGroup] || transaction.bucketGroup,
        (transaction.tags || []).join(' | '),
        transaction.excludedFromAnalysis ? 'Yes' : 'No',
        (transaction.appliedRuleLabels || []).join(' | '),
        transaction.note || '',
        Number(transaction.amount || 0).toFixed(2),
        Number(transaction.balance || 0).toFixed(2),
        transaction.narration,
        transaction.refNo,
        transaction.statementName,
        transaction.accountLabel,
      ])),
    ];

    const csv = rows
      .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = `statement-atlas-filtered-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(href);
  };

  const handleRemoveStatement = (statementId) => {
    const statement = profile.statements.find((item) => item.id === statementId);
    if (!statement) return;
    if (!window.confirm(`Remove "${statement.sourceName}" and all of its transactions from the local profile?`)) return;
    const nextProfile = removeStatementFromProfile(profile, statementId);
    setProfile(nextProfile);
    setEditorTransactionKey(null);
    setRuleEditorDraft(null);
    if (scopeStatementId === statementId) setScopeStatementId('all');
    setStatus({ type: 'success', message: `${statement.sourceName} was removed from the local profile.` });
  };

  const filteredStatements = scopeStatementId === 'all'
    ? profile.statements
    : profile.statements.filter((statement) => statement.id === scopeStatementId);

  return (
    <Layout
      hasData={hasData}
      statementCount={profile.statements.length}
      coverageLabel={coverageLabel}
      onExport={handleExport}
      onClear={handleClear}
    >
      <div className="space-y-8">
        <section id="overview" className="glass-card overflow-hidden rounded-[2.2rem]">
          <div className="grid gap-6 p-6 md:p-8 xl:grid-cols-[1.25fr_0.9fr]">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200">
                <Sparkles size={14} />
                Privacy-first finance dashboard
              </div>
              <div>
                <h1 className="max-w-3xl text-4xl font-black tracking-tight text-slate-900 dark:text-white md:text-5xl">
                  See your bank statements as a living
                  {' '}
                  <span className="premium-gradient-text">spending profile</span>
                  .
                </h1>
                <p className="mt-4 max-w-3xl text-base text-slate-500 dark:text-white/55 md:text-lg">
                  Upload annual statements one by one, merge them into a multi-year profile, and break your cash flow into essentials, lifestyle, salary-like inflows, passive income, investments, debt payments, and transfers.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <span className="tag">
                  <CalendarRange size={12} />
                  {hasData ? coverageLabel : 'No statement coverage yet'}
                </span>
                <span className="tag">
                  <Landmark size={12} />
                  Browser-local storage only
                </span>
                <span className="tag">
                  <ChartNoAxesCombined size={12} />
                  Replace or merge imports
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[1.7rem] border border-slate-200/80 bg-white/80 p-5 dark:border-white/10 dark:bg-white/5">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Statements</p>
                  <p className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white">{formatInteger(profile.statements.length)}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-white/55">Imported PDF reports</p>
                </div>
                <div className="rounded-[1.7rem] border border-slate-200/80 bg-white/80 p-5 dark:border-white/10 dark:bg-white/5">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Transactions</p>
                  <p className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white">{formatInteger(profile.transactions.length)}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-white/55">Parsed and bucketed entries</p>
                </div>
                <div className="rounded-[1.7rem] border border-slate-200/80 bg-white/80 p-5 dark:border-white/10 dark:bg-white/5">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Years visible</p>
                  <p className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white">{formatInteger(years.length)}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-white/55">Year buckets in current profile</p>
                </div>
              </div>
            </div>

            <UploadPanel
              hasExistingData={hasData}
              importing={importing}
              status={status}
              onImport={handleImport}
            />
          </div>
        </section>

        {hasData ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <StatCard
                title="Gross cash in"
                value={formatCurrency(analytics.cashInTotal)}
                helpText={`${formatCurrency(analytics.averageMonthlyCashIn)} avg per active month`}
                icon={ArrowDownLeft}
                color="emerald"
                delay={0}
              />
              <StatCard
                title="Gross cash out"
                value={formatCurrency(analytics.outflowTotal)}
                helpText={`${formatCurrency(analytics.averageMonthlyOutflow)} avg per active month`}
                icon={ArrowUpRight}
                color="rose"
                delay={1}
              />
              <StatCard
                title="Net cash movement"
                value={formatSignedCurrency(analytics.netCashFlow)}
                helpText={`${analytics.savingsRate.toFixed(1)}% of gross cash in`}
                icon={PiggyBank}
                color="indigo"
                delay={2}
              />
              <StatCard
                title="Counted income"
                value={formatCurrency(analytics.incomeTotal)}
                helpText={`${formatCurrency(analytics.averageMonthlyIncome)} after excluding wealth returned`}
                icon={BriefcaseBusiness}
                color="amber"
                delay={3}
              />
              <StatCard
                title="Wealth returned"
                value={formatCurrency(analytics.wealthReturnTotal)}
                helpText={`${formatCurrency(analytics.averageMonthlyWealthReturn)} avg per active month`}
                icon={HandCoins}
                color="emerald"
                delay={4}
              />
            </section>

            <SectionCard
              id="spending"
              title="Spending"
              subtitle="View the shape of your outflows across months, categories, and essential vs lifestyle buckets."
              action={(
                <div className="flex flex-wrap gap-3">
                  <label className="flex min-w-[180px] flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Scope year</span>
                    <select className="control-input" value={scopeYear} onChange={(event) => setScopeYear(event.target.value)}>
                      <option value="all">All years</option>
                      {years.map((year) => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-w-[220px] flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Statement scope</span>
                    <select className="control-input" value={scopeStatementId} onChange={(event) => setScopeStatementId(event.target.value)}>
                      <option value="all">All imported statements</option>
                      {profile.statements.map((statement) => (
                        <option key={statement.id} value={statement.id}>
                          {statement.sourceName}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            >
              <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
                <div className="rounded-[1.7rem] border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="mb-4 text-sm font-bold text-slate-700 dark:text-white">Monthly cash flow</p>
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={analytics.monthSeries.map((month) => ({ ...month, label: monthLabelFromKey(month.monthKey) }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" />
                        <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} />
                        <YAxis tickFormatter={(value) => `₹${Math.round(value / 1000)}k`} tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="cashIn" name="Inflows" fill="#22c55e" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="outflow" name="Outflows" fill="#f43f5e" radius={[8, 8, 0, 0]} />
                        <Line type="monotone" dataKey="net" name="Net" stroke="#6366f1" strokeWidth={3} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="grid gap-6">
                  <div className="rounded-[1.7rem] border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="mb-4 text-sm font-bold text-slate-700 dark:text-white">Outflow bucket mix</p>
                    {analytics.bucketTotals.length ? (
                      <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={analytics.bucketTotals}
                              dataKey="value"
                              nameKey="label"
                              innerRadius={68}
                              outerRadius={94}
                              paddingAngle={3}
                            >
                              {analytics.bucketTotals.map((entry) => (
                                <Cell key={entry.label} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip content={<ChartTooltip formatter={formatCurrency} />} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <EmptyState title="No outflow mix yet" body="Import a statement with debit transactions to see this chart." />
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {analytics.bucketTotals.map((entry) => (
                        <span key={entry.label} className="tag normal-case tracking-normal">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: entry.color }} />
                          {entry.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[1.7rem] border border-slate-200/80 bg-white/70 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Essential spend</p>
                        <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{formatCurrency(analytics.coreSpend)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Non-essential spend</p>
                        <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{formatCurrency(analytics.lifestyleSpend)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Money moves</p>
                        <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{formatCurrency(analytics.moneyMoves)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Largest debit</p>
                        <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                          {analytics.biggestDebit ? formatCurrency(analytics.biggestDebit.amount) : formatCurrency(0)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
                <div className="rounded-[1.7rem] border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="mb-4 text-sm font-bold text-slate-700 dark:text-white">Top spend categories</p>
                  {analytics.categoryRanking.length ? (
                    <div className="h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={analytics.categoryRanking.slice(0, 8).map((item) => ({ ...item, label: item.label }))}
                          layout="vertical"
                          margin={{ left: 30 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" horizontal={false} />
                          <XAxis type="number" tickFormatter={(value) => `₹${Math.round(value / 1000)}k`} tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} />
                          <YAxis type="category" dataKey="label" tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} width={120} />
                          <Tooltip content={<ChartTooltip />} />
                          <Bar dataKey="amount" name="Spend" fill="#6366f1" radius={[0, 10, 10, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <EmptyState title="No spend categories yet" body="Once debits are present, category rankings will appear here." />
                  )}
                </div>

                <div className="rounded-[1.7rem] border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="mb-4 text-sm font-bold text-slate-700 dark:text-white">Spend by weekday</p>
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analytics.dayOfWeek}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" />
                        <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} />
                        <YAxis tickFormatter={(value) => `₹${Math.round(value / 1000)}k`} tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Area type="monotone" dataKey="amount" name="Debit spend" stroke="#0ea5e9" fill="rgba(14, 165, 233, 0.35)" strokeWidth={3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              id="income"
              title="Income"
              subtitle="Track what counts as earned income, what looks recurring, and what came back from fixed deposits or similar wealth redemptions."
            >
              <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
                <div className="rounded-[1.7rem] border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="mb-4 text-sm font-bold text-slate-700 dark:text-white">Top counted income sources</p>
                  {analytics.incomeSources.length ? (
                    <div className="h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analytics.incomeSources.slice(0, 8)} layout="vertical" margin={{ left: 30 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" horizontal={false} />
                          <XAxis type="number" tickFormatter={(value) => `₹${Math.round(value / 1000)}k`} tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} />
                          <YAxis type="category" dataKey="label" tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} width={120} />
                          <Tooltip content={<ChartTooltip />} />
                          <Bar dataKey="amount" name="Credits" fill="#22c55e" radius={[0, 10, 10, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <EmptyState title="No counted income yet" body="Income analytics will show up here once your statement imports include credits that are not wealth returns." />
                  )}
                </div>

                <div className="space-y-6">
                  <div className="rounded-[1.7rem] border border-slate-200/80 bg-white/70 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Passive income</p>
                        <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{formatCurrency(analytics.passiveIncome)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Largest counted income credit</p>
                        <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                          {analytics.biggestCredit ? formatCurrency(analytics.biggestCredit.amount) : formatCurrency(0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Wealth returned</p>
                        <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{formatCurrency(analytics.wealthReturnTotal)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.7rem] border border-slate-200/80 bg-white/70 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="text-sm font-bold text-slate-700 dark:text-white">Salary-like recurring credits</p>
                    <div className="mt-4 space-y-3">
                      {analytics.salaryLikeSources.length ? analytics.salaryLikeSources.map((source) => (
                        <div key={source.merchant} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="font-bold text-slate-800 dark:text-white">{source.merchant}</p>
                              <p className="mt-1 text-sm text-slate-500 dark:text-white/55">
                                {source.months} active months · {source.count} credits · avg {formatCurrency(source.average)}
                              </p>
                            </div>
                            <p className="text-sm font-black text-emerald-600 dark:text-emerald-300">{formatCurrency(source.total)}</p>
                          </div>
                        </div>
                      )) : (
                        <EmptyState
                          title="No salary-like pattern detected yet"
                          body="If a source repeats across several months with similar amounts, it will surface here automatically."
                        />
                      )}
                    </div>
                  </div>

                  {analytics.yearSeries.length > 1 ? (
                    <div className="rounded-[1.7rem] border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                      <p className="mb-4 text-sm font-bold text-slate-700 dark:text-white">Year-over-year view</p>
                      <div className="h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analytics.yearSeries}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" />
                            <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} />
                            <YAxis tickFormatter={(value) => `₹${Math.round(value / 1000)}k`} tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} />
                            <Tooltip content={<ChartTooltip />} />
                            <Bar dataKey="cashIn" name="Inflows" fill="#22c55e" radius={[8, 8, 0, 0]} />
                            <Bar dataKey="outflow" name="Outflows" fill="#f43f5e" radius={[8, 8, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </SectionCard>

            <SectionCard
              id="merchants"
              title="Merchants"
              subtitle="See the merchants, platforms, and recurring subscriptions that absorbed the most money."
            >
              <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
                <div className="rounded-[1.7rem] border border-slate-200/80 bg-white/70 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-sm font-bold text-slate-700 dark:text-white">Top debit merchants</p>
                  <div className="mt-4 space-y-3">
                    {analytics.merchantRanking.slice(0, 10).map((merchant, index) => (
                      <div key={merchant.label} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-sm font-black text-slate-500 dark:bg-white/5 dark:text-white/55">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 dark:text-white">{merchant.label}</p>
                            <p className="mt-1 text-sm text-slate-500 dark:text-white/55">
                              {merchant.count} transactions · {merchant.category}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm font-black text-slate-800 dark:text-white">{formatCurrency(merchant.amount)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-[1.7rem] border border-slate-200/80 bg-white/70 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="text-sm font-bold text-slate-700 dark:text-white">Recurring subscriptions</p>
                    <div className="mt-4 space-y-3">
                      {analytics.subscriptions.length ? analytics.subscriptions.map((subscription) => (
                        <div key={subscription.merchant} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="font-bold text-slate-800 dark:text-white">{subscription.merchant}</p>
                              <p className="mt-1 text-sm text-slate-500 dark:text-white/55">
                                {subscription.count} charges across {subscription.activeMonths} months · avg {formatCurrency(subscription.averageAmount, true)}
                              </p>
                            </div>
                            <p className="text-sm font-black text-indigo-600 dark:text-indigo-300">{formatCurrency(subscription.total)}</p>
                          </div>
                        </div>
                      )) : (
                        <EmptyState title="No recurring subscriptions spotted" body="When the same subscription repeats across months, it will appear here." />
                      )}
                    </div>
                  </div>

                  <div className="rounded-[1.7rem] border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="mb-4 text-sm font-bold text-slate-700 dark:text-white">Largest movements</p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/5">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Biggest debit</p>
                        {analytics.biggestDebit ? (
                          <>
                            <p className="mt-2 text-lg font-black text-slate-900 dark:text-white">{analytics.biggestDebit.merchant}</p>
                            <p className="mt-1 text-sm text-slate-500 dark:text-white/55">{formatCurrency(analytics.biggestDebit.amount)} · {formatDateLabel(analytics.biggestDebit.date)}</p>
                          </>
                        ) : null}
                      </div>
                      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/5">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Biggest credit</p>
                        {analytics.biggestCredit ? (
                          <>
                            <p className="mt-2 text-lg font-black text-slate-900 dark:text-white">{analytics.biggestCredit.merchant}</p>
                            <p className="mt-1 text-sm text-slate-500 dark:text-white/55">{formatCurrency(analytics.biggestCredit.amount)} · {formatDateLabel(analytics.biggestCredit.date)}</p>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              id="review"
              title="Review"
              subtitle="Exclude pass-through money movement, re-bucket big-ticket items, and add tags so the dashboard reflects the story you actually want to analyze."
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-[1.6rem] border border-slate-200/80 bg-white/70 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Excluded transactions</p>
                  <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{formatInteger(excludedTransactions.length)}</p>
                  <p className="mt-2 text-sm text-slate-500 dark:text-white/55">
                    {formatCurrency(excludedInflowTotal)} inflow and {formatCurrency(excludedOutflowTotal)} outflow removed from charts
                  </p>
                </div>
                <div className="rounded-[1.6rem] border border-slate-200/80 bg-white/70 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Reviewed rows</p>
                  <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{formatInteger(customizedTransactions.length)}</p>
                  <p className="mt-2 text-sm text-slate-500 dark:text-white/55">Transactions with manual category, bucket, tag, note, or exclude edits</p>
                </div>
                <div className="rounded-[1.6rem] border border-slate-200/80 bg-white/70 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Tagged transactions</p>
                  <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{formatInteger(taggedTransactions.length)}</p>
                  <p className="mt-2 text-sm text-slate-500 dark:text-white/55">Use tags like vehicle, family, one-off, or reimbursable</p>
                </div>
                <div className="rounded-[1.6rem] border border-slate-200/80 bg-white/70 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Pass-through suggestions</p>
                  <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{formatInteger(passThroughSuggestions.length)}</p>
                  <p className="mt-2 text-sm text-slate-500 dark:text-white/55">Detected same-day or next-day credit to investment chains</p>
                </div>
                <div className="rounded-[1.6rem] border border-slate-200/80 bg-white/70 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Bulk rules</p>
                  <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{formatInteger(activeRules.length)}</p>
                  <p className="mt-2 text-sm text-slate-500 dark:text-white/55">
                    {formatInteger(inactiveRules.length)} paused rule{inactiveRules.length === 1 ? '' : 's'} stored for later
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-6">
                  <div className="rounded-[1.7rem] border border-slate-200/80 bg-white/70 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="text-sm font-bold text-slate-700 dark:text-white">How to clean the analysis</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/5">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Step 1</p>
                        <p className="mt-2 font-bold text-slate-800 dark:text-white">Review suggestions</p>
                        <p className="mt-2 text-sm text-slate-500 dark:text-white/55">Use the pass-through cards below to remove funding inflows that were immediately reinvested.</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/5">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Step 2</p>
                        <p className="mt-2 font-bold text-slate-800 dark:text-white">Edit big-ticket items</p>
                        <p className="mt-2 text-sm text-slate-500 dark:text-white/55">Open any row and change the category, bucket, merchant label, tags, or notes.</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/5">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Step 3</p>
                        <p className="mt-2 font-bold text-slate-800 dark:text-white">Filter by tags</p>
                        <p className="mt-2 text-sm text-slate-500 dark:text-white/55">Use the new `Tag` and `Analysis view` filters in Transactions to isolate vehicle, family, or excluded flows.</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.7rem] border border-slate-200/80 bg-white/70 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold text-slate-700 dark:text-white">Suggested pass-through pairs</p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-white/55">
                          These are large credits followed by a same-day or next-day investment-like debit with a very similar amount.
                        </p>
                      </div>
                      <span className="tag normal-case tracking-normal">
                        <Waypoints size={12} />
                        Current scope only
                      </span>
                    </div>

                    <div className="mt-4 space-y-3">
                      {passThroughSuggestions.length ? passThroughSuggestions.slice(0, 8).map((suggestion) => (
                        <div key={suggestion.key} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/5">
                          <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
                            <div>
                              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-500 dark:text-emerald-300">Credit</p>
                              <p className="mt-2 font-bold text-slate-800 dark:text-white">{suggestion.credit.merchant}</p>
                              <p className="mt-1 text-sm text-slate-500 dark:text-white/55">
                                {formatDateLabel(suggestion.credit.date)} · {formatCurrency(suggestion.credit.amount)}
                              </p>
                            </div>
                            <div className="flex justify-center text-slate-300 dark:text-white/20">
                              <Waypoints size={24} />
                            </div>
                            <div>
                              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-indigo-500 dark:text-indigo-300">Investment debit</p>
                              <p className="mt-2 font-bold text-slate-800 dark:text-white">{suggestion.debit.merchant}</p>
                              <p className="mt-1 text-sm text-slate-500 dark:text-white/55">
                                {formatDateLabel(suggestion.debit.date)} · {formatCurrency(suggestion.debit.amount)}
                              </p>
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap gap-2">
                              <span className="tag normal-case tracking-normal">
                                {suggestion.daysApart === 0 ? 'Same day' : `${suggestion.daysApart} day later`}
                              </span>
                              <span className="tag normal-case tracking-normal">
                                Amount gap {formatCurrency(suggestion.amountGap)}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-3">
                              <button
                                type="button"
                                onClick={() => handleDismissSuggestion(suggestion.key)}
                                className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10"
                              >
                                <XCircle size={16} />
                                Keep in analysis
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAcceptSuggestion(suggestion)}
                                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-sky-500 to-violet-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/20"
                              >
                                <CheckCheck size={16} />
                                Exclude both
                              </button>
                            </div>
                          </div>
                        </div>
                      )) : (
                        <EmptyState
                          title="No pass-through pairs in this scope"
                          body="When a large credit is followed by a very similar investment debit on the same day or next day, it will appear here for one-click cleanup."
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-[1.7rem] border border-slate-200/80 bg-white/70 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold text-slate-700 dark:text-white">Bulk rules</p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-white/55">
                          Rules run on imported transactions before one-off overrides, so they keep future imports clean automatically.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openRuleEditor({
                          label: '',
                          enabled: true,
                          matchField: 'merchant',
                          operator: 'equals',
                          direction: 'all',
                          matchValue: '',
                          patch: {
                            merchant: '',
                            category: '',
                            bucketGroup: '',
                            tags: [],
                            note: '',
                            excludeFromAnalysis: false,
                          },
                        })}
                        className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-sky-500 to-violet-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/20"
                      >
                        <Plus size={16} />
                        New rule
                      </button>
                    </div>

                    <div className="mt-4 space-y-3">
                      {profile.rules?.length ? profile.rules.map((rule) => (
                        <div key={rule.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/5">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-bold text-slate-800 dark:text-white">{rule.label || 'Untitled rule'}</p>
                                <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                                  rule.enabled
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200'
                                    : 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-white/55'
                                }`}>
                                  {rule.enabled ? 'Active' : 'Paused'}
                                </span>
                              </div>
                              <p className="mt-2 text-sm text-slate-500 dark:text-white/55">{describeRuleMatch(rule)}</p>
                              <p className="mt-2 text-sm text-slate-600 dark:text-white/65">{describeRuleActions(rule, bucketText)}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handleToggleBulkRule(rule.id)}
                                className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10"
                              >
                                <Workflow size={15} />
                                {rule.enabled ? 'Pause' : 'Enable'}
                              </button>
                              <button
                                type="button"
                                onClick={() => openRuleEditor(rule)}
                                className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10"
                              >
                                <PencilLine size={15} />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteBulkRule(rule.id)}
                                className="inline-flex items-center gap-2 rounded-2xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-200"
                              >
                                <Trash2 size={15} />
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      )) : (
                        <EmptyState
                          title="No rules yet"
                          body="Create a rule from the button here or from any transaction editor when you want the same cleanup to apply automatically in the future."
                        />
                      )}
                    </div>
                  </div>

                  <div className="rounded-[1.7rem] border border-slate-200/80 bg-white/70 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="text-sm font-bold text-slate-700 dark:text-white">Reviewed transactions in scope</p>
                    <div className="mt-4 space-y-3">
                      {scopedCustomizedTransactions.length ? scopedCustomizedTransactions.slice(0, 8).map((transaction) => (
                        <div key={transaction.uniqueKey} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/5">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="font-bold text-slate-800 dark:text-white">{transaction.merchant}</p>
                              <p className="mt-1 text-sm text-slate-500 dark:text-white/55">
                                {formatDateLabel(transaction.date)} · {formatCurrency(transaction.amount)}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <span className="tag normal-case tracking-normal">{transaction.category}</span>
                                {transaction.excludedFromAnalysis ? (
                                  <span className="tag normal-case tracking-normal">Excluded</span>
                                ) : null}
                                {transaction.hasOverride ? (
                                  <span className="tag normal-case tracking-normal">Override</span>
                                ) : null}
                                {transaction.hasRule ? (
                                  <span className="tag normal-case tracking-normal">Rule</span>
                                ) : null}
                                {(transaction.tags || []).map((tag) => (
                                  <span key={`${transaction.uniqueKey}-${tag}`} className="tag normal-case tracking-normal">{tag}</span>
                                ))}
                              </div>
                              {transaction.note ? (
                                <p className="mt-2 text-sm text-slate-500 dark:text-white/55">{transaction.note}</p>
                              ) : null}
                            </div>
                            <div className="flex flex-col gap-2">
                              <button
                                type="button"
                                onClick={() => setEditorTransactionKey(transaction.uniqueKey)}
                                className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10"
                              >
                                <PencilLine size={16} />
                                Edit
                              </button>
                              {transaction.hasOverride ? (
                                <button
                                  type="button"
                                  onClick={() => handleClearTransactionReview(transaction.uniqueKey)}
                                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10"
                                >
                                  <RotateCcw size={16} />
                                  Reset override
                                </button>
                              ) : transaction.appliedRuleIds?.[0] ? (
                                <button
                                  type="button"
                                  onClick={() => openRuleEditor(profile.rules.find((rule) => rule.id === transaction.appliedRuleIds[0]) || null)}
                                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10"
                                >
                                  <Workflow size={16} />
                                  Edit rule
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      )) : (
                        <EmptyState
                          title="No manual overrides in this scope"
                          body="Use the transaction editor to add custom categories, tags, notes, or exclusions for large one-off movements."
                        />
                      )}
                    </div>
                  </div>

                  <div className="rounded-[1.7rem] border border-slate-200/80 bg-white/70 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="text-sm font-bold text-slate-700 dark:text-white">Scope summary</p>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/5">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Excluded in scope</p>
                        <p className="mt-2 text-xl font-black text-slate-900 dark:text-white">{formatInteger(scopedExcludedTransactions.length)}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/5">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Custom tags in scope</p>
                        <p className="mt-2 text-xl font-black text-slate-900 dark:text-white">{formatInteger([...new Set(scopedTransactions.flatMap((transaction) => transaction.tags || []))].length)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              id="library"
              title="Library"
              subtitle="Keep the imported statement archive visible and pair it with generated insights from the current scope."
            >
              <div className="grid gap-6 xl:grid-cols-[1.05fr_1.15fr]">
                <div className="rounded-[1.7rem] border border-slate-200/80 bg-white/70 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-sm font-bold text-slate-700 dark:text-white">Analysis highlights</p>
                  <div className="mt-4 grid gap-3">
                    {analytics.insights.map((insight) => (
                      <motion.div
                        key={insight.title}
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-4 dark:border-white/10 dark:bg-white/5"
                      >
                        <p className="font-bold text-slate-800 dark:text-white">{insight.title}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-white/55">{insight.body}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.7rem] border border-slate-200/80 bg-white/70 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-sm font-bold text-slate-700 dark:text-white">Imported statements</p>
                  <div className="mt-4 space-y-3">
                    {filteredStatements.map((statement) => (
                      <div key={statement.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/5">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="font-bold text-slate-800 dark:text-white">{statement.sourceName}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="tag normal-case tracking-normal">{statement.accountLabel}</span>
                              <span className="tag normal-case tracking-normal">{formatDateLabel(statement.fromDate)} - {formatDateLabel(statement.toDate)}</span>
                            </div>
                            <p className="mt-3 text-sm text-slate-500 dark:text-white/55">
                              {formatInteger(statement.transactionCount)} transactions · imported {formatDateLabel(statement.importedAt.slice(0, 10))}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveStatement(statement.id)}
                            className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold text-rose-500 transition hover:bg-rose-50 dark:hover:bg-rose-500/10"
                          >
                            <Trash2 size={15} />
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              id="categories"
              title="Categories"
              subtitle="See category totals side by side, sort them by value, and click any category to drill straight into the matching transactions."
            >
              <div className="mb-5 rounded-[1.6rem] border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <label className="flex min-w-[180px] flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Category lens</span>
                    <select className="control-input" value={categoryExplorerFlow} onChange={(event) => setCategoryExplorerFlow(event.target.value)}>
                      {Object.entries(categoryFlowText).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-w-[180px] flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Category sort</span>
                    <select className="control-input" value={categoryExplorerSort} onChange={(event) => setCategoryExplorerSort(event.target.value)}>
                      {categorySortChoices.map((choice) => (
                        <option key={choice.value} value={choice.value}>{choice.label}</option>
                      ))}
                    </select>
                  </label>
                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Categories in scope</p>
                    <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{formatInteger(categorySummaries.length)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Active drilldown</p>
                    <p className="mt-2 text-lg font-black text-slate-900 dark:text-white">{categoryFilter === 'all' ? 'None' : categoryFilter}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
                <div className="rounded-[1.7rem] border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="mb-4 text-sm font-bold text-slate-700 dark:text-white">Interactive category totals</p>
                  {categorySummaries.length ? (
                    <div className="max-h-[560px] overflow-y-auto pr-2">
                      <ResponsiveContainer width="100%" height={categoryChartHeight}>
                        <BarChart data={categorySummaries} layout="vertical" margin={{ left: 40 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" horizontal={false} />
                          <XAxis type="number" tickFormatter={(value) => `₹${Math.round(value / 1000)}k`} tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} />
                          <YAxis type="category" dataKey="label" tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} width={150} />
                          <Tooltip content={<ChartTooltip />} />
                          <Bar dataKey="amount" name="Category total" radius={[0, 12, 12, 0]}>
                            {categorySummaries.map((entry) => (
                              <Cell
                                key={entry.label}
                                fill={categoryFilter === entry.label ? '#f97316' : '#6366f1'}
                                style={{ cursor: 'pointer' }}
                                onClick={() => handleCategoryDrilldown(entry.label)}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <EmptyState title="No categories in this scope" body="Change the year or statement scope, or import more data to unlock category totals." />
                  )}
                </div>

                <div className="space-y-6">
                  <div className="rounded-[1.7rem] border border-slate-200/80 bg-white/70 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="text-sm font-bold text-slate-700 dark:text-white">Focused category</p>
                    {focusedCategorySummary ? (
                      <div className="mt-4 space-y-4">
                        <div>
                          <p className="text-2xl font-black text-slate-900 dark:text-white">{focusedCategorySummary.label}</p>
                          <p className="mt-1 text-sm text-slate-500 dark:text-white/55">
                            Click any bar or category chip to sync the transaction table with that category.
                          </p>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Total amount</p>
                            <p className="mt-2 text-xl font-black text-slate-900 dark:text-white">{formatCurrency(focusedCategorySummary.amount)}</p>
                          </div>
                          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Transactions</p>
                            <p className="mt-2 text-xl font-black text-slate-900 dark:text-white">{formatInteger(focusedCategorySummary.count)}</p>
                          </div>
                          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Largest amount</p>
                            <p className="mt-2 text-xl font-black text-slate-900 dark:text-white">{formatCurrency(focusedCategorySummary.largestAmount)}</p>
                          </div>
                          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Latest transaction</p>
                            <p className="mt-2 text-xl font-black text-slate-900 dark:text-white">{focusedCategorySummary.latestDate ? formatDateLabel(focusedCategorySummary.latestDate) : 'N/A'}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => handleCategoryDrilldown(focusedCategorySummary.label)}
                            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-sky-500 to-violet-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/20"
                          >
                            Show matching transactions
                          </button>
                          {categoryFilter !== 'all' ? (
                            <button
                              type="button"
                              onClick={() => setCategoryFilter('all')}
                              className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10"
                            >
                              Clear category drilldown
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <EmptyState title="No focused category yet" body="Pick a scope and the category board will populate here." />
                    )}
                  </div>

                  <div className="rounded-[1.7rem] border border-slate-200/80 bg-white/70 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="text-sm font-bold text-slate-700 dark:text-white">Quick category list</p>
                    <div className="mt-4 space-y-3">
                      {categorySummaries.slice(0, 8).map((category) => (
                        <button
                          key={category.label}
                          type="button"
                          onClick={() => handleCategoryDrilldown(category.label)}
                          className={`flex w-full items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition-premium ${
                            categoryFilter === category.label
                              ? 'border-indigo-300 bg-indigo-50/80 dark:border-indigo-400 dark:bg-indigo-500/10'
                              : 'border-slate-200/80 bg-slate-50/80 hover:border-indigo-200 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20'
                          }`}
                        >
                          <div>
                            <p className="font-bold text-slate-800 dark:text-white">{category.label}</p>
                            <p className="mt-1 text-sm text-slate-500 dark:text-white/55">{formatInteger(category.count)} transactions</p>
                          </div>
                          <p className="text-sm font-black text-slate-800 dark:text-white">{formatCurrency(category.amount)}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              id="transactions"
              title="Transactions"
              subtitle="Search, sort, and drill into the parsed ledger without reopening the PDF."
            >
              {selectedCategorySummary ? (
                <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[1.6rem] border border-indigo-200 bg-indigo-50/80 p-5 dark:border-indigo-400/30 dark:bg-indigo-500/10">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-indigo-500 dark:text-indigo-200/80">Selected category</p>
                    <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{selectedCategorySummary.label}</p>
                    <p className="mt-2 text-sm text-slate-600 dark:text-white/65">Visible total {formatCurrency(selectedCategorySummary.amount)}</p>
                  </div>
                  <div className="rounded-[1.6rem] border border-slate-200/80 bg-white/70 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Matching transactions</p>
                    <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{formatInteger(selectedCategorySummary.count)}</p>
                    <p className="mt-2 text-sm text-slate-500 dark:text-white/55">Across the current table filters</p>
                  </div>
                  <div className="rounded-[1.6rem] border border-slate-200/80 bg-white/70 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Largest matching amount</p>
                    <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{formatCurrency(selectedCategorySummary.largestAmount)}</p>
                    <p className="mt-2 text-sm text-slate-500 dark:text-white/55">Latest {selectedCategorySummary.latestDate ? formatDateLabel(selectedCategorySummary.latestDate) : 'N/A'}</p>
                  </div>
                  <div className="rounded-[1.6rem] border border-slate-200/80 bg-white/70 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Inflow vs outflow</p>
                    <p className="mt-2 text-xl font-black text-emerald-600 dark:text-emerald-300">{formatCurrency(selectedCategorySummary.creditAmount)} in</p>
                    <p className="mt-1 text-xl font-black text-rose-600 dark:text-rose-300">{formatCurrency(selectedCategorySummary.debitAmount)} out</p>
                  </div>
                </div>
              ) : null}

              <div className="mb-5 rounded-[1.6rem] border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                  <label className="flex min-w-[160px] flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Year</span>
                    <select className="control-input" value={scopeYear} onChange={(event) => setScopeYear(event.target.value)}>
                      <option value="all">All years</option>
                      {years.map((year) => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-w-[200px] flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Statement</span>
                    <select className="control-input" value={scopeStatementId} onChange={(event) => setScopeStatementId(event.target.value)}>
                      <option value="all">All statements</option>
                      {profile.statements.map((statement) => (
                        <option key={statement.id} value={statement.id}>{statement.sourceName}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-w-[160px] flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Flow</span>
                    <select className="control-input" value={flowFilter} onChange={(event) => setFlowFilter(event.target.value)}>
                      {Object.entries(flowText).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-w-[180px] flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Bucket</span>
                    <select className="control-input" value={bucketFilter} onChange={(event) => setBucketFilter(event.target.value)}>
                      <option value="all">All buckets</option>
                      {bucketOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-w-[180px] flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Analysis view</span>
                    <select className="control-input" value={reviewScope} onChange={(event) => setReviewScope(event.target.value)}>
                      {Object.entries(reviewScopeText).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-w-[220px] flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Merchant</span>
                    <select className="control-input" value={merchantFilter} onChange={(event) => setMerchantFilter(event.target.value)}>
                      <option value="all">All merchants</option>
                      {merchantOptions.map((merchant) => (
                        <option key={merchant} value={merchant}>{merchant}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-w-[200px] flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Category</span>
                    <select className="control-input" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                      <option value="all">All categories</option>
                      {categoryOptions.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-w-[180px] flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Tag</span>
                    <select className="control-input" value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
                      <option value="all">All tags</option>
                      {tagOptions.map((tag) => (
                        <option key={tag} value={tag}>{tag}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-w-[180px] flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Amount band</span>
                    <select className="control-input" value={amountBandFilter} onChange={(event) => setAmountBandFilter(event.target.value)}>
                      {Object.entries(amountBandText).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-w-[180px] flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Sort order</span>
                    <select className="control-input" value={`${sortField}:${sortDirection}`} onChange={(event) => handleSortSelection(event.target.value)}>
                      {sortChoices.map((choice) => (
                        <option key={choice.value} value={choice.value}>{choice.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-w-[140px] flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Rows shown</span>
                    <select className="control-input" value={rowsLimit} onChange={(event) => setRowsLimit(event.target.value)}>
                      {rowsPerPageChoices.map((choice) => (
                        <option key={choice} value={choice}>{choice === 'all' ? 'All rows' : `${choice} rows`}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-w-[220px] flex-col gap-2 xl:col-span-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Search</span>
                    <div className="relative">
                      <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        className="control-input pl-11"
                        placeholder="Merchant, narration, ref, tag, note..."
                        value={searchText}
                        onChange={(event) => setSearchText(event.target.value)}
                      />
                    </div>
                  </label>
                  <div className="flex flex-col justify-end gap-3 xl:col-span-2">
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={handleDownloadFilteredCsv}
                        disabled={!visibleTransactions.length}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10"
                      >
                        <Download size={16} />
                        Download filtered CSV
                      </button>
                      <button
                        type="button"
                        onClick={resetTransactionExplorer}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10"
                      >
                        <RotateCcw size={16} />
                        Reset explorer
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
                <span className="tag">
                  <Filter size={12} />
                  {formatInteger(visibleTransactions.length)} visible rows
                </span>
                <span className="tag">
                  <CircleOff size={12} />
                  {reviewScopeText[reviewScope]}
                </span>
                <span className="tag">
                  <BadgeIndianRupee size={12} />
                  {scopeYear === 'all' ? 'All years' : `Year ${scopeYear}`}
                </span>
                <span className="tag">
                  <ArrowDownUp size={12} />
                  {sortLabelText[`${sortField}:${sortDirection}`]}
                </span>
                <span className="tag">
                  <ArrowDownLeft size={12} />
                  Filtered inflows {formatCurrency(visibleCreditsTotal)}
                </span>
                <span className="tag">
                  <ArrowUpRight size={12} />
                  Filtered outflows {formatCurrency(visibleDebitsTotal)}
                </span>
                <span className="tag">
                  <PiggyBank size={12} />
                  Filtered net {formatSignedCurrency(visibleNet)}
                </span>
                <span className="tag">
                  <Tags size={12} />
                  {tagFilter === 'all' ? `${formatInteger(taggedTransactions.length)} tagged overall` : `Tag ${tagFilter}`}
                </span>
                <span className="tag">
                  <CalendarRange size={12} />
                  Showing {formatInteger(renderedTransactions.length)} on screen
                </span>
              </div>

              <div className="overflow-x-auto rounded-[1.5rem] border border-slate-200/80 bg-white/70 dark:border-white/10 dark:bg-white/[0.03]">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>
                        <SortableHeader
                          label="Date"
                          sortKey="date"
                          currentField={sortField}
                          currentDirection={sortDirection}
                          defaultDirection="desc"
                          onSort={handleHeaderSort}
                        />
                      </th>
                      <th>Flow</th>
                      <th>
                        <SortableHeader
                          label="Merchant"
                          sortKey="merchant"
                          currentField={sortField}
                          currentDirection={sortDirection}
                          defaultDirection="asc"
                          onSort={handleHeaderSort}
                        />
                      </th>
                      <th>
                        <SortableHeader
                          label="Category"
                          sortKey="category"
                          currentField={sortField}
                          currentDirection={sortDirection}
                          defaultDirection="asc"
                          onSort={handleHeaderSort}
                        />
                      </th>
                      <th>Bucket</th>
                      <th>
                        <SortableHeader
                          label="Amount"
                          sortKey="amount"
                          currentField={sortField}
                          currentDirection={sortDirection}
                          defaultDirection="desc"
                          onSort={handleHeaderSort}
                        />
                      </th>
                      <th>
                        <SortableHeader
                          label="Balance"
                          sortKey="balance"
                          currentField={sortField}
                          currentDirection={sortDirection}
                          defaultDirection="desc"
                          onSort={handleHeaderSort}
                        />
                      </th>
                      <th>Statement</th>
                      <th>Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {renderedTransactions.map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02]">
                        <td>
                          <p className="font-semibold text-slate-800 dark:text-white">{formatDateLabel(transaction.date)}</p>
                          <p className="mt-1 text-xs text-slate-400 dark:text-white/35">{transaction.valueDate !== transaction.date ? `Value: ${formatDateLabel(transaction.valueDate)}` : 'Value same day'}</p>
                        </td>
                        <td><TransactionDirection direction={transaction.direction} amount={transaction.amount} /></td>
                        <td>
                          <p className="font-semibold text-slate-800 dark:text-white">{transaction.merchant}</p>
                          <p className="mt-1 max-w-[280px] truncate text-xs text-slate-400 dark:text-white/35">{transaction.narration}</p>
                          {transaction.tags?.length ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {transaction.tags.map((tag) => (
                                <span key={`${transaction.uniqueKey}-${tag}`} className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:bg-white/5 dark:text-white/55">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </td>
                        <td>
                          <p className="font-semibold text-slate-800 dark:text-white">{transaction.category}</p>
                          {transaction.category !== transaction.rawCategory ? (
                            <p className="mt-1 text-xs text-slate-400 dark:text-white/35">Imported as {transaction.rawCategory}</p>
                          ) : null}
                        </td>
                        <td>
                          <p className="font-semibold text-slate-800 dark:text-white">{bucketText[transaction.bucketGroup] || transaction.bucketGroup}</p>
                          {transaction.bucketGroup !== transaction.rawBucketGroup ? (
                            <p className="mt-1 text-xs text-slate-400 dark:text-white/35">Imported as {bucketText[transaction.rawBucketGroup] || transaction.rawBucketGroup}</p>
                          ) : null}
                        </td>
                        <td className={`font-black ${transaction.direction === 'credit' ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>
                          {formatCurrency(transaction.amount)}
                        </td>
                        <td>{formatCurrency(transaction.balance)}</td>
                        <td>
                          <p className="font-semibold text-slate-700 dark:text-white/80">{transaction.accountLabel}</p>
                          <p className="mt-1 text-xs text-slate-400 dark:text-white/35">{transaction.statementName}</p>
                        </td>
                        <td>
                          <div className="flex flex-col items-start gap-2">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => setEditorTransactionKey(transaction.uniqueKey)}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10"
                              >
                                <PencilLine size={13} />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleExcludeTransaction(transaction)}
                                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                                  transaction.excludedFromAnalysis
                                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-200'
                                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-200'
                                }`}
                              >
                                <CircleOff size={13} />
                                {transaction.excludedFromAnalysis ? 'Include' : 'Exclude'}
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {transaction.excludedFromAnalysis ? (
                                <span className="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
                                  Excluded
                                </span>
                              ) : (
                                <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
                                  Included
                                </span>
                              )}
                              {transaction.hasOverride ? (
                                <span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200">
                                  Override
                                </span>
                              ) : null}
                              {transaction.hasRule ? (
                                <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
                                  Rule
                                </span>
                              ) : null}
                            </div>
                            {transaction.note ? (
                              <p className="max-w-[220px] text-xs text-slate-400 dark:text-white/35">{transaction.note}</p>
                            ) : null}
                            {transaction.appliedRuleLabels?.length ? (
                              <p className="max-w-[220px] text-xs text-slate-400 dark:text-white/35">
                                {transaction.appliedRuleLabels.join(' · ')}
                              </p>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!visibleTransactions.length ? (
                      <tr>
                        <td colSpan="9" className="px-6 py-10">
                          <EmptyState title="No transactions match these filters" body="Try changing the merchant, category, amount band, statement scope, or search term." />
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </>
        ) : (
          <SectionCard
            id="spending"
            title="Ready for import"
            subtitle="Once you upload a statement, the dashboard will automatically build category splits, cash-flow trends, salary-like credit detection, recurring merchant patterns, and a searchable transaction ledger."
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard title="Essentials vs lifestyle" value="Auto-bucketed" helpText="Daily living, discretionary spend, transfers, debt, and investments" icon={HandCoins} color="emerald" />
              <StatCard title="Income profiling" value="Recurring" helpText="Salary-like inflows, passive income, refunds, and transfers in" icon={CircleDollarSign} color="indigo" />
              <StatCard title="Spending habits" value="Visualized" helpText="Monthly outflows, biggest merchants, quiet vs heavy months" icon={ChartNoAxesCombined} color="rose" />
              <StatCard title="Searchable ledger" value="Interactive" helpText="Filter every parsed transaction without reopening the PDF" icon={Search} color="amber" />
            </div>
          </SectionCard>
        )}

        <TransactionEditorModal
          transaction={editorTransaction}
          open={Boolean(editorTransaction)}
          bucketOptions={bucketOptions}
          categorySuggestions={categorySuggestions}
          merchantSuggestions={merchantOptions}
          tagSuggestions={tagSuggestions}
          onClose={() => setEditorTransactionKey(null)}
          onSave={handleSaveTransactionOverride}
          onReset={handleClearTransactionReview}
          onCreateRule={handleCreateRuleFromTransaction}
        />
        <RuleEditorModal
          open={Boolean(ruleEditorDraft)}
          initialRule={ruleEditorDraft}
          bucketOptions={bucketOptions}
          categorySuggestions={categorySuggestions}
          merchantSuggestions={merchantOptions}
          tagSuggestions={tagSuggestions}
          onClose={() => setRuleEditorDraft(null)}
          onSave={handleSaveBulkRule}
        />
      </div>
    </Layout>
  );
}

export default App;
