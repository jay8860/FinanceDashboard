import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Save, X } from 'lucide-react';

const matchFieldOptions = [
  { value: 'merchant', label: 'Merchant' },
  { value: 'narration', label: 'Narration' },
  { value: 'refNo', label: 'Reference' },
];

const operatorOptions = [
  { value: 'contains', label: 'Contains' },
  { value: 'equals', label: 'Equals exactly' },
];

const directionOptions = [
  { value: 'all', label: 'All flows' },
  { value: 'debit', label: 'Debits only' },
  { value: 'credit', label: 'Credits only' },
];

const normalizeTags = (value) => [...new Set(String(value || '')
  .split(',')
  .map((tag) => tag.trim())
  .filter(Boolean))];

const buildInitialState = (draft) => ({
  id: draft?.id || '',
  label: draft?.label || '',
  matchField: draft?.matchField || 'merchant',
  operator: draft?.operator || 'equals',
  direction: draft?.direction || 'all',
  matchValue: draft?.matchValue || '',
  merchant: draft?.patch?.merchant || '',
  category: draft?.patch?.category || '',
  bucketGroup: draft?.patch?.bucketGroup || '',
  tags: (draft?.patch?.tags || []).join(', '),
  note: draft?.patch?.note || '',
  excludeFromAnalysis: Boolean(draft?.patch?.excludeFromAnalysis),
  enabled: draft?.enabled !== false,
});

const RuleEditorModal = ({
  open,
  initialRule,
  bucketOptions,
  categorySuggestions,
  merchantSuggestions,
  tagSuggestions,
  onClose,
  onSave,
}) => {
  const [form, setForm] = useState(buildInitialState(initialRule));

  useEffect(() => {
    setForm(buildInitialState(initialRule));
  }, [initialRule]);

  const handleSave = () => {
    onSave({
      id: form.id || undefined,
      label: form.label,
      matchField: form.matchField,
      operator: form.operator,
      direction: form.direction,
      matchValue: form.matchValue,
      enabled: form.enabled,
      patch: {
        merchant: form.merchant,
        category: form.category,
        bucketGroup: form.bucketGroup,
        tags: normalizeTags(form.tags),
        note: form.note,
        excludeFromAnalysis: form.excludeFromAnalysis,
      },
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
                  Bulk rule
                </p>
                <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  {initialRule?.id ? 'Edit rule' : 'Create rule'}
                </h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-white/55">
                  Apply a label, bucket, tag, note, or exclusion automatically whenever a transaction matches this pattern.
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

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Rule name</span>
                <input
                  className="control-input"
                  value={form.label}
                  onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                  placeholder="Example: All Groww funding"
                />
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  checked={form.enabled}
                  onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
                />
                <span className="text-sm font-semibold text-slate-700 dark:text-white/75">Rule enabled</span>
              </label>
            </div>

            <div className="mt-5 rounded-[1.6rem] border border-slate-200/80 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-sm font-bold text-slate-700 dark:text-white">Match logic</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Field</span>
                  <select
                    className="control-input"
                    value={form.matchField}
                    onChange={(event) => setForm((current) => ({ ...current, matchField: event.target.value }))}
                  >
                    {matchFieldOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Operator</span>
                  <select
                    className="control-input"
                    value={form.operator}
                    onChange={(event) => setForm((current) => ({ ...current, operator: event.target.value }))}
                  >
                    {operatorOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Direction</span>
                  <select
                    className="control-input"
                    value={form.direction}
                    onChange={(event) => setForm((current) => ({ ...current, direction: event.target.value }))}
                  >
                    {directionOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2 xl:col-span-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Match value</span>
                  <input
                    className="control-input"
                    value={form.matchValue}
                    onChange={(event) => setForm((current) => ({ ...current, matchValue: event.target.value }))}
                    placeholder={form.matchField === 'merchant' ? 'Groww' : 'keyword or ref'}
                  />
                </label>
              </div>
            </div>

            <div className="mt-5 rounded-[1.6rem] border border-slate-200/80 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-sm font-bold text-slate-700 dark:text-white">Apply this change whenever matched</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Merchant label</span>
                  <input
                    className="control-input"
                    value={form.merchant}
                    onChange={(event) => setForm((current) => ({ ...current, merchant: event.target.value }))}
                    list="rule-merchant-suggestions"
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Category</span>
                  <input
                    className="control-input"
                    value={form.category}
                    onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                    list="rule-category-suggestions"
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Bucket</span>
                  <select
                    className="control-input"
                    value={form.bucketGroup}
                    onChange={(event) => setForm((current) => ({ ...current, bucketGroup: event.target.value }))}
                  >
                    <option value="">Keep current bucket</option>
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
                    placeholder="vehicle, transfer, pass-through"
                    list="rule-tag-suggestions"
                  />
                </label>
                <label className="md:col-span-2 flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Notes</span>
                  <textarea
                    className="control-input min-h-[100px] resize-y"
                    value={form.note}
                    onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                    placeholder="Example: Bike purchase or funding transfer."
                  />
                </label>
              </div>
            </div>

            <label className="mt-5 flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-4 dark:border-white/10 dark:bg-white/5">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                checked={form.excludeFromAnalysis}
                onChange={(event) => setForm((current) => ({ ...current, excludeFromAnalysis: event.target.checked }))}
              />
              <div>
                <p className="font-semibold text-slate-800 dark:text-white">Exclude all matched transactions from dashboard analysis</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-white/55">
                  Good for funding transfers, reimbursements, temporary parking entries, and pass-through movements.
                </p>
              </div>
            </label>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10"
              >
                <X size={16} />
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-sky-500 to-violet-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/20"
              >
                {initialRule?.id ? <Save size={16} /> : <Plus size={16} />}
                {initialRule?.id ? 'Save rule' : 'Create rule'}
              </button>
            </div>

            <datalist id="rule-category-suggestions">
              {categorySuggestions.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
            <datalist id="rule-merchant-suggestions">
              {merchantSuggestions.map((merchant) => (
                <option key={merchant} value={merchant} />
              ))}
            </datalist>
            <datalist id="rule-tag-suggestions">
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

export default RuleEditorModal;
