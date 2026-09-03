import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, children, actions }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="glass-strong w-full max-w-lg rounded-2xl p-6 max-h-[85vh] overflow-y-auto"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-display font-semibold">{title}</h2>
              <button onClick={onClose} className="text-ink-faint hover:text-ink transition-colors rounded-lg p-1 hover:bg-surface-3">
                <X size={18} />
              </button>
            </div>
            {children}
            {actions && <div className="flex justify-end gap-2 mt-6">{actions}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
