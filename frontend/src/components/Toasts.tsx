import { AnimatePresence, motion } from 'framer-motion';
import { useUI } from '../store/ui';

const tone = { success: 'border-ok/50', error: 'border-danger/60', info: 'border-line' };
export function Toasts() {
  const { toasts, dismiss } = useUI();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} role={t.kind === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex max-w-sm items-start gap-3 rounded-xl border bg-raised px-4 py-3 text-sm shadow-xl ${tone[t.kind]}`}>
            <span>{t.message}</span>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-muted hover:text-ink">✕</button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
