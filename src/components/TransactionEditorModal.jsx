import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CircleOff, CopyPlus, RotateCcw, Save, Tag, X } from 'lucide-react';
import { formatCurrency, formatDateLabel } from '../utils/format.js';

const presetChoices = [
  {
    label: 'Vehicle purchase',
    patch: { category: 'Vehicle Purchase', bucketGroup: 'capital', tags: ['vehicle'] },
  },
  {
    label: 'Asset purchase',
    patch: { category: 'Asset Purchase', bucketGroup: 'capital', tags: ['asset'] },
  },
  {
    label: 'Family transfer',
    patch: { category: 'Family Transfer', bucketGroup: 'transfer', tags: ['family'] },
  },
  {
    label: 'Investment move',
    patch: { category: 'Investment Funding', bucketGroup: 'wealth', tags: ['investment'] },
  },
];

const normalizeTags = (value) => [...new Set(String(value || '')
  .split(',')
  .map((tag) => tag.trim())
  .filter(Boolean))];

const buildInitialState = (transaction) => ({
  merchant: transaction?.merchant || '',
  category: transaction?.category || '',
  bucketGroup: transaction?.bucketGroup || 'uncategorized',
  tags: (transaction?.tags || []).join(', '),
  note: transaction?.note || '',
  excludeFromAnalysis: Boolean(transaction?.excludedFromAnalysis),
});

const TransactionEditorModal = ({
  transaction,
  open,
  bucketOptions,
  categorySuggestions,
  merchantSuggestions,
  tagSuggestions,
  onClose,
  onSave,
  onReset,
  onCreateRule,
}) => {
  const [form, setForm] = useState(buildInitialState(transaction));

  useEffect(() => {
    setForm(buildInitialState(transaction));
  }, [transaction]);

  if (!transaction) return null;

  const applyPreset = (preset) => {
    setForm((current) => {
      const nextTags = [...new Set([...normalizeTags(current.tags), ...(preset.patch.tags || [])])];
      return {
        ...current,
        ...preset.patch,
        tags: nextTags.join(', '),
      };
    });
  };

  const handleSave = () => {
    onSave(transaction.uniqueKey, {
      merchant: form.merchant,
      category: form.category,
      bucketGroup: form.bucketGroup,
      tags: normalizeTags(form.tags),
      note: form.note,
      excludeFromAnalysis: form.excludeFromAnalysis,
    });
  };

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed inset-x-4 top-4 z-50 mx-auto max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-slate-200/80 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">
                  Transaction review
                </p>
                <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  {transaction.merchant}
                </h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-white/55">
                  {formatDateLabel(transaction.date)} · {formatCurrency(transaction.amount)} · {transaction.direction === 'credit' ? 'Credit' : 'Debit'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl p-2 text-slate-500 transition hover:bg-slate-100 dark:text-white/55 dark:hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Imported category</p>
                <p className="mt-2 font-bold text-slate-800 dark:text-white">{transaction.rawCategory}</p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Imported bucket</p>
                <p className="mt-2 font-bold text-slate-800 dark:text-white">{bucketOptions.find((option) => option.value === transaction.rawBucketGroup)?.label || transaction.rawBucketGroup}</p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Statement</p>
                <p className="mt-2 font-bold text-slate-800 dark:text-white">{transaction.statementName}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {presetChoices.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-white/10 dark:bg-white/5 dark:text-white/65 dark:hover:border-indigo-400 dark:hover:text-indigo-200"
                >
                  <Tag size={12} />
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Merchant label</span>
                <input
                  className="control-input"
                  value={form.merchant}
                  onChange={(event) => setForm((current) => ({ ...current, merchant: event.target.value }))}
                  list="merchant-suggestions"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Category</span>
                <input
                  className="control-input"
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                  list="category-suggestions"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Bucket</span>
                <select
                  className="control-input"
                  value={form.bucketGroup}
                  onChange={(event) => setForm((current) => ({ ...current, bucketGroup: event.target.value }))}
                >
                  {bucketOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Tags</span>
                <input
                  className="control-input"
                  value={form.tags}
                  onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
                  placeholder="vehicle, one-off, family"
                  list="tag-suggestions"
                />
              </label>
              <label className="md:col-span-2 flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Notes</span>
                <textarea
                  className="control-input min-h-[110px] resize-y"
                  value={form.note}
                  onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                  placeholder="Example: Bike purchase, excluded from recurring spend analysis."
                />
              </label>
            </div>

            <label className="mt-5 flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-4 dark:border-white/10 dark:bg-white/5">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                checked={form.excludeFromAnalysis}
                onChange={(event) => setForm((current) => ({ ...current, excludeFromAnalysis: event.target.checked }))}
              />
              <div>
                <p className="font-semibold text-slate-800 dark:text-white">Exclude this transaction from dashboard analysis</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-white/55">
                  Use this for pass-through money movement, temporary funding, or one-off transactions you do not want counted in the charts.
                </p>
              </div>
            </label>

            {tagSuggestions.length ? (
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Popular tags</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {tagSuggestions.slice(0, 8).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setForm((current) => {
                        const nextTags = [...new Set([...normalizeTags(current.tags), tag])];
                        return { ...current, tags: nextTags.join(', ') };
                      })}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-white/10 dark:bg-white/5 dark:text-white/65 dark:hover:border-indigo-400 dark:hover:text-indigo-200"
                    >
                      <Tag size={12} />
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap justify-between gap-3">
              <button
                type="button"
                onClick={() => onReset(transaction.uniqueKey)}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10"
              >
                <RotateCcw size={16} />
                Clear one-off override
              </button>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => onCreateRule({
                    transaction,
                    draft: {
                      merchant: form.merchant,
                      category: form.category,
                      bucketGroup: form.bucketGroup,
                      tags: normalizeTags(form.tags),
                      note: form.note,
                      excludeFromAnalysis: form.excludeFromAnalysis,
                    },
                  })}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10"
                >
                  <CopyPlus size={16} />
                  Create rule
                </button>
                <button
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, excludeFromAnalysis: !current.excludeFromAnalysis }))}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10"
                >
                  <CircleOff size={16} />
                  {form.excludeFromAnalysis ? 'Keep in analysis' : 'Exclude'}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-sky-500 to-violet-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/20"
                >
                  <Save size={16} />
                  Save changes
                </button>
              </div>
            </div>

            <datalist id="category-suggestions">
              {categorySuggestions.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
            <datalist id="merchant-suggestions">
              {merchantSuggestions.map((merchant) => (
                <option key={merchant} value={merchant} />
              ))}
            </datalist>
            <datalist id="tag-suggestions">
              {tagSuggestions.map((tag) => (
                <option key={tag} value={tag} />
              ))}
            </datalist>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
};

export default TransactionEditorModal;
