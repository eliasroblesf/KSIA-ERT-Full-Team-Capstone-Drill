import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-amber-500 text-white rounded-lg shadow-2xl border border-amber-400"
        >
          <WifiOff size={20} />
          <div className="flex flex-col">
            <span className="text-sm font-bold uppercase tracking-wider leading-tight">Offline Mode</span>
            <span className="text-xs opacity-90 font-medium">Using cached simulation data.</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
