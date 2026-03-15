import { motion } from 'framer-motion';

const SectionCard = ({ id, title, subtitle, action, children, className = '' }) => (
  <motion.section
    id={id}
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-20% 0px' }}
    transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
    className={`glass-card rounded-[2rem] p-6 md:p-7 ${className}`}
  >
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-white/35">
          {title}
        </p>
        {subtitle ? (
          <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-white/55">
            {subtitle}
          </p>
        ) : null}
      </div>
      {action}
    </div>
    <div className="mt-6">
      {children}
    </div>
  </motion.section>
);

export default SectionCard;
