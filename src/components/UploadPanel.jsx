import { useState } from 'react';
import { CreditCard, DatabaseZap, FileStack, Landmark, LockKeyhole, Replace, Upload, WandSparkles } from 'lucide-react';

const modes = [
  {
    value: 'merge',
    label: 'Merge with current profile',
    icon: FileStack,
    description: 'Add new statement years on top of what is already stored.',
  },
  {
    value: 'replace',
    label: 'Replace existing profile',
    icon: Replace,
    description: 'Start fresh and overwrite the current profile with these files.',
  },
];

const importTypes = [
  {
    value: 'auto',
    label: 'Auto-detect',
    icon: DatabaseZap,
    description: 'Try to detect whether these PDFs are bank statements or credit card bills.',
  },
  {
    value: 'bank',
    label: 'Bank account',
    icon: Landmark,
    description: 'Use the HDFC account-statement parser for cash account imports.',
  },
  {
    value: 'creditCard',
    label: 'Credit card',
    icon: CreditCard,
    description: 'Use the credit-card statement flow so purchases stay separate from bank settlements.',
  },
];

const UploadPanel = ({ hasExistingData, importing, status, onImport }) => {
  const [password, setPassword] = useState('');
  const [files, setFiles] = useState([]);
  const [mode, setMode] = useState(hasExistingData ? 'merge' : 'replace');
  const [statementType, setStatementType] = useState('auto');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!files.length) return;
    await onImport({ files, password, mode, statementType });
    setFiles([]);
  };

  return (
    <div className="rounded-[2rem] border border-slate-200/80 bg-white/80 p-5 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
          <Upload size={20} />
        </div>
        <div>
          <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">
            Import statements
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-white/55">
            PDFs are parsed in your browser. Bank accounts and credit cards can live together here, but card bills are analyzed separately from bank settlements to avoid double counting.
          </p>
        </div>
      </div>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-white/70">
            <LockKeyhole size={14} />
            Statement password / customer ID
          </span>
          <input
            className="control-input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter the PDF password"
            autoComplete="off"
          />
        </label>

        <label className="block">
          <span className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-white/70">
            <DatabaseZap size={14} />
            Choose statement PDFs
          </span>
          <input
            className="control-input cursor-pointer file:mr-4 file:rounded-full file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-700"
            type="file"
            accept=".pdf,application/pdf"
            multiple
            onChange={(event) => setFiles([...event.target.files])}
          />
        </label>

        {files.length ? (
          <div className="flex flex-wrap gap-2">
            {files.map((file) => (
              <span key={`${file.name}-${file.size}`} className="tag normal-case tracking-normal">
                {file.name}
              </span>
            ))}
          </div>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-3">
          {importTypes.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setStatementType(option.value)}
              className={`rounded-[1.5rem] border p-4 text-left transition-premium ${
                statementType === option.value
                  ? 'border-indigo-400 bg-indigo-50/80 shadow-lg shadow-indigo-500/10 dark:border-indigo-400 dark:bg-indigo-500/10'
                  : 'border-slate-200/80 bg-white/70 hover:border-indigo-200 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`rounded-2xl p-3 ${statementType === option.value ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-white/55'}`}>
                  <option.icon size={18} />
                </div>
                <div>
                  <p className="font-bold text-slate-800 dark:text-white">{option.label}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-white/55">{option.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {modes.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setMode(option.value)}
              className={`rounded-[1.5rem] border p-4 text-left transition-premium ${
                mode === option.value
                  ? 'border-indigo-400 bg-indigo-50/80 shadow-lg shadow-indigo-500/10 dark:border-indigo-400 dark:bg-indigo-500/10'
                  : 'border-slate-200/80 bg-white/70 hover:border-indigo-200 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`rounded-2xl p-3 ${mode === option.value ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-white/55'}`}>
                  <option.icon size={18} />
                </div>
                <div>
                  <p className="font-bold text-slate-800 dark:text-white">{option.label}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-white/55">{option.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <button
          type="submit"
          disabled={importing || !files.length}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-sky-500 to-violet-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <WandSparkles size={16} />
          {importing ? 'Analyzing statements...' : 'Analyze and update profile'}
        </button>
      </form>

      {status ? (
        <div
          className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
            status.type === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200'
          }`}
        >
          {status.message}
        </div>
      ) : null}
    </div>
  );
};

export default UploadPanel;
