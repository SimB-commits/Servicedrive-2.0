// components/help/HelpWidget.tsx
import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Badge } from '@heroui/react';
import HelpOverlay from './HelpOverlay';
import { QuestionCircleIcon, CloseIcon } from '../icons';

const HelpWidget = () => {
  const { data: session, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [hasNewHelp, setHasNewHelp] = useState(true); // Om användaren har ny hjälp att upptäcka
  
  // Kontrollera om användaren har sett hjälpguiden tidigare
  useEffect(() => {
    if (typeof window !== 'undefined' && session) {
      const hasSeenGuide = localStorage.getItem('hasSeenHelpGuide');
      if (hasSeenGuide) {
        setHasNewHelp(false);
      }
    }
  }, [session]);

  // Markera hjälpen som visad när den öppnas
  const handleOpenHelp = () => {
    setIsOpen(true);
    if (hasNewHelp) {
      setHasNewHelp(false);
      localStorage.setItem('hasSeenHelpGuide', 'true');
    }
  };

  // Visa inte widgeten om användaren inte är inloggad
  if (status !== 'authenticated') return null;

  return (
    <>
      {/* Flytande hjälpknapp i nedre högra hörnet */}
      <div className="fixed bottom-6 right-6 z-50">
        <Badge
          content=""
          color="danger"
          isInvisible={!hasNewHelp}
          variant="solid"
          placement="top-right"
        >
          <Button
            isIconOnly
            color="primary"
            variant="shadow"
            size="lg"
            radius="full"
            aria-label={isOpen ? "Stäng hjälp" : "Öppna hjälp"}
            onPress={() => isOpen ? setIsOpen(false) : handleOpenHelp()}
            className="h-14 w-14 shadow-lg hover:scale-105 transition-transform"
          >
            {isOpen ? <CloseIcon size={24} /> : <QuestionCircleIcon size={24} />}
          </Button>
        </Badge>
      </div>

      {/* Animerad overlay som visas när hjälpen är öppen */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 z-40"
          >
            <HelpOverlay onClose={() => setIsOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default HelpWidget;