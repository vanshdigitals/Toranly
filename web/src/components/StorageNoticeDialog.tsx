import React, { useEffect, useState } from 'react';
import { HardDrive, X, ShieldAlert } from 'lucide-react';
import { getMeta, setMeta } from '../storage/db';
import { Button } from './Button';
import './StorageNoticeDialog.css';

export const StorageNoticeDialog: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let active = true;
    async function checkNotice() {
      const seen = await getMeta<boolean>('storageWarningSeen');
      if (active && !seen) {
        setIsOpen(true);
      }
    }
    checkNotice();
    return () => {
      active = false;
    };
  }, []);

  const handleDismiss = async () => {
    setIsOpen(false);
    await setMeta('storageWarningSeen', true);
  };

  if (!isOpen) return null;

  return (
    <div className="storage-notice-overlay" role="presentation">
      <div
        className="storage-notice-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="storage-notice-title"
      >
        <div className="storage-notice-header">
          <div className="storage-notice-icon-badge">
            <HardDrive size={22} className="storage-notice-icon" aria-hidden="true" />
          </div>
          <button
            type="button"
            className="storage-notice-close"
            onClick={handleDismiss}
            aria-label="Close storage notice"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="storage-notice-content">
          <h2 id="storage-notice-title" className="storage-notice-title">
            Your plans are saved right here
          </h2>
          <p className="storage-notice-text">
            Toranly saves all your celebration details locally in this browser on this device. Your
            data is never uploaded to an account or shared with third parties.
          </p>

          <div className="storage-notice-callout">
            <ShieldAlert size={18} className="storage-notice-callout-icon" aria-hidden="true" />
            <p className="storage-notice-callout-text">
              Clearing browsing history or using a private window removes your saved plans. You can
              download a <strong>.toranly.json backup</strong> anytime from Settings to keep a safe
              copy.
            </p>
          </div>
        </div>

        <div className="storage-notice-actions">
          <Button variant="primary" onClick={handleDismiss} fullWidth>
            I understand
          </Button>
        </div>
      </div>
    </div>
  );
};
