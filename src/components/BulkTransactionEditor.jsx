import { useEffect, useState } from 'react';
import { CheckCheck, RotateCcw, Save, XCircle } from 'lucide-react';

const normalizeTags = (value) => [...new Set(String(value || '')
  .split(',')
  .map((tag) => tag.trim())
  .filter(Boolean))];

const buildInitialState = () => ({
  merchant: '',
  category: '',
  bucketGroup: '',
  tags: '',
  tagMode: 'append',
  note: '',
  excludeMode: 'unchanged',
});

const BulkTransactionEditor = ({
  selectionCount,
  visibleCount,
  renderedCount,
  bucketOptions,
  categorySuggestions,
  merchantSuggestions,
  tagSuggestions,
  onApply,
  onResetSelected,
  onClearSelection,
  onSelectVisible,
  onSelectAllFiltered,
}) => {
  const [form, setForm] = useState(buildInitialState());

  useEffect(() => {
    if (!selectionCount) {
      setForm(buildInitialState());
    }
  }, [selectionCount]);

  if (!selectionCount) return null;

  return (
    <div className="mb-5 rounded-[1.7rem] border border-indigo-200 bg-indigo-50/80 p-5 dark:border-indigo-400/30 dark:bg-indigo-500/10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-indigo-500 dark:text-indigo-200/80">Bulk edit</p>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{selectionCount} transaction{selectionCount === 1 ? '' : 's'} selected</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-white/65">
            Apply one merchant/category/bucket/tag/note change across the current selection without opening each row one by one.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSelectVisible}
            className="inline-flex items-center gap-2 rounded-2xl bg-white/80 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10"
          >
            <CheckCheck size={16} />
            Select visible ({renderedCount})
          </button>
          <button
            type="button"
            onClick={onSelectAllFiltered}
            className="inline-flex items-center gap-2 rounded-2xl bg-white/80 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10"
          >
            <CheckCheck size={16} />
            Select all filtered ({visibleCount})
          </button>
          <button
            type="button"
            onClick={onClearSelection}
            className="inline-flex items-center gap-2 rounded-2xl bg-white/80 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10"
          >
            <XCircle size={16} />
            Clear selection
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <label className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Merchant label</span>
          <input
            className="control-input"
            value={form.merchant}
            onChange={(event) => setForm((current) => ({ ...current, merchant: event.target.value }))}
            placeholder="Leave blank to keep current"
            list="bulk-merchant-suggestions"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Category</span>
          <input
            className="control-input"
            value={form.category}
            onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
            placeholder="Leave blank to keep current"
            list="bulk-category-suggestions"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Bucket</span>
          <select
            className="control-input"
            value={form.bucketGroup}
            onChange={(event) => setForm((current) => ({ ...current, bucketGroup: event.target.value }))}
          >
            <option value="">Keep existing bucket</option>
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
            placeholder="vehicle, family, one-off"
            list="bulk-tag-suggestions"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Tag mode</span>
          <select
            className="control-input"
            value={form.tagMode}
            onChange={(event) => setForm((current) => ({ ...current, tagMode: event.target.value }))}
          >
            <option value="append">Append to existing tags</option>
            <option value="replace">Replace existing tags</option>
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Analysis status</span>
          <select
            className="control-input"
            value={form.excludeMode}
            onChange={(event) => setForm((current) => ({ ...current, excludeMode: event.target.value }))}
          >
            <option value="unchanged">Leave inclusion unchanged</option>
            <option value="include">Include in analysis</option>
            <option value="exclude">Exclude from analysis</option>
          </select>
        </label>
        <label className="md:col-span-2 xl:col-span-3 flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">Note</span>
          <textarea
            className="control-input min-h-[96px] resize-y"
            value={form.note}
            onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
            placeholder="Optional shared note for the selected rows"
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap justify-between gap-3">
        <button
          type="button"
          onClick={onResetSelected}
          className="inline-flex items-center gap-2 rounded-2xl bg-white/80 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10"
        >
          <RotateCcw size={16} />
          Reset selected overrides
        </button>
        <button
          type="button"
          onClick={() => {
            onApply({
              merchant: form.merchant.trim(),
              category: form.category.trim(),
              bucketGroup: form.bucketGroup,
              tags: normalizeTags(form.tags),
              tagMode: form.tagMode,
              note: form.note.trim(),
              excludeMode: form.excludeMode,
            });
            setForm(buildInitialState());
          }}
          className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-sky-500 to-violet-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/20"
        >
          <Save size={16} />
          Apply bulk changes
        </button>
      </div>

      <datalist id="bulk-category-suggestions">
        {categorySuggestions.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>
      <datalist id="bulk-merchant-suggestions">
        {merchantSuggestions.map((merchant) => (
          <option key={merchant} value={merchant} />
        ))}
      </datalist>
      <datalist id="bulk-tag-suggestions">
        {tagSuggestions.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>
    </div>
  );
};

export default BulkTransactionEditor;
