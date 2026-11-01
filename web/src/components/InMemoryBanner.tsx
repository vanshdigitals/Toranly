import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { isInMemoryStorage, subscribeMemoryMode } from '../storage/db';
import './InMemoryBanner.css';

export const InMemoryBanner: React.FC = () => {
  const [inMemory, setInMemory] = useState(isInMemoryStorage());

  useEffect(() => {
    return subscribeMemoryMode((val) => setInMemory(val));
  }, []);

  if (!inMemory) return null;

  return (
    <aside className="in-memory-banner" role="alert" aria-live="polite">
      <div className="in-memory-banner-inner">
        <AlertTriangle size={18} className="in-memory-icon" aria-hidden="true" />
        <span className="in-memory-text">
          <strong>Storage notice:</strong> Your browser storage is in temporary memory mode. Changes
          will not be kept if you refresh or close this tab. Please export a backup from Settings to
          keep your plan.
        </span>
      </div>
    </aside>
  );
};
