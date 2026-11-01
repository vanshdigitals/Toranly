import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock } from 'lucide-react';
import type { FunctionItem } from '../domain/plan';
import './FunctionFormDialog.css';

interface FunctionFormDialogProps {
  isOpen: boolean;
  initialData?: FunctionItem | null;
  defaultDate?: string;
  onSave: (fn: { name: string; date: string; startTime?: string; endTime?: string }) => void;
  onCancel: () => void;
}

export const FunctionFormDialog: React.FC<FunctionFormDialogProps> = ({
  isOpen,
  initialData,
  defaultDate,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name);
        setDate(initialData.date);
        setStartTime(initialData.startTime || '');
        setEndTime(initialData.endTime || '');
      } else {
        setName('');
        setDate(defaultDate || new Date().toISOString().split('T')[0]);
        setStartTime('');
        setEndTime('');
      }
      setError(null);
    }
  }, [isOpen, initialData, defaultDate]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a function name.');
      return;
    }
    if (!date) {
      setError('Please select a date.');
      return;
    }
    if (startTime && endTime && endTime <= startTime) {
      setError('End time must be later than start time.');
      return;
    }

    onSave({
      name: name.trim(),
      date,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
    });
  };

  return (
    <div
      className="fn-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fn-dialog-title"
    >
      <div className="fn-dialog-card">
        <div className="fn-dialog-header">
          <h3 id="fn-dialog-title" className="fn-dialog-title">
            {initialData ? 'Edit celebration function' : 'Add celebration function'}
          </h3>
          <button
            type="button"
            className="fn-dialog-close-btn"
            onClick={onCancel}
            aria-label="Close function dialog"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="fn-dialog-form">
          {error && <div className="fn-dialog-error-banner">{error}</div>}

          <div className="fn-field-group">
            <label htmlFor="fn-name-input" className="fn-field-label">
              Function name <span className="fn-required">*</span>
            </label>
            <input
              id="fn-name-input"
              type="text"
              className="fn-field-input"
              placeholder="e.g. Sangeet, Mehendi, Wedding Ceremony, Reception"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              maxLength={60}
              required
            />
          </div>

          <div className="fn-field-group">
            <label htmlFor="fn-date-input" className="fn-field-label">
              Date <span className="fn-required">*</span>
            </label>
            <div className="fn-input-with-icon">
              <Calendar size={18} className="fn-input-icon" />
              <input
                id="fn-date-input"
                type="date"
                className="fn-field-input has-icon"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="fn-grid-two">
            <div className="fn-field-group">
              <label htmlFor="fn-start-input" className="fn-field-label">
                Start time (optional)
              </label>
              <div className="fn-input-with-icon">
                <Clock size={18} className="fn-input-icon" />
                <input
                  id="fn-start-input"
                  type="time"
                  className="fn-field-input has-icon"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
            </div>

            <div className="fn-field-group">
              <label htmlFor="fn-end-input" className="fn-field-label">
                End time (optional)
              </label>
              <div className="fn-input-with-icon">
                <Clock size={18} className="fn-input-icon" />
                <input
                  id="fn-end-input"
                  type="time"
                  className="fn-field-input has-icon"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="fn-dialog-footer">
            <button type="button" className="fn-dialog-cancel-btn" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="fn-dialog-save-btn">
              {initialData ? 'Save function' : 'Add function'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
