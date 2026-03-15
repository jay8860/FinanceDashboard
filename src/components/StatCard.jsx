import { motion } from 'framer-motion';

const colorTokens = {
  indigo: {
    text: 'text-indigo-600 dark:text-indigo-300',
    halo: 'from-indigo-500/20 to-indigo-500/5',
    line: 'from-indigo-500',
  },
  emerald: {
    text: 'text-emerald-600 dark:text-emerald-300',
    halo: 'from-emerald-500/20 to-emerald-500/5',
    line: 'from-emerald-500',
  },
  amber: {
    text: 'text-amber-600 dark:text-amber-300',
    halo: 'from-amber-500/20 to-amber-500/5',
    line: 'from-amber-500',
  },
  rose: {
    text: 'text-rose-600 dark:text-rose-300',
    halo: 'from-rose-500/20 to-rose-500/5',
    line: 'from-rose-500',
  },
};

const StatCard = ({ title, value, helpText, icon: Icon, color = 'indigo', delay = 0 }) => {
  const token = colorTokens[color] || colorTokens.indigo;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: delay * 0.08, duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
      whileHover={{ y: -6, scale: 1.01 }}
      className="glass-card relative overflow-hidden rounded-[2rem] p-6 transition-premium"
    >
      <div className={`absolute -right-8 -top-8 h-32 w-32 bg-gradient-to-br blur-3xl ${token.halo}`} />
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">
            {title}
          </p>
          <p className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            {value}
          </p>
          {helpText ? (
            <p className="text-sm text-slate-500 dark:text-white/55">
              {helpText}
            </p>
          ) : null}
        </div>
        <div className={`rounded-2xl bg-slate-50 p-4 dark:bg-white/5 ${token.text}`}>
          <Icon size={26} />
        </div>
      </div>
      <div className="absolute bottom-0 left-0 h-1.5 w-full bg-slate-100 dark:bg-white/5">
        <div className={`h-full w-2/3 bg-gradient-to-r ${token.line} to-transparent opacity-40`} />
      </div>
    </motion.div>
  );
};

export default StatCard;
