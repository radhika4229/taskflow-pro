import React, { useState } from 'react';
import { TaskStatus } from '../types';
import { api, extractErrorMessage } from '../services/api';
import { X, Plus, Loader2, AlertTriangle } from 'lucide-react';

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

export const NewTaskModal: React.FC<NewTaskModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  if (!isOpen) return null;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('BACKLOG');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await api.createTask({
        title: title.trim(),
        description: description.trim(),
        status,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      await onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = extractErrorMessage(err);
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-cream-50 rounded-xl shadow-drawer border border-warmgray-border z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-warmgray-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-terracotta flex items-center justify-center text-white">
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </div>
            <h3 className="font-display text-lg font-medium text-ink-900">
              Create New Task
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-ink-400 hover:text-ink-900 hover:bg-cream-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-badge-blockedBg border border-badge-blockedBorder text-badge-blocked text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 font-mono">{error}</div>
            </div>
          )}

          <div>
            <label className="block text-xs font-mono font-medium text-ink-700 uppercase tracking-wide mb-1">
              Task Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. End-to-end integration test suite"
              className="w-full bg-white border border-warmgray-border rounded-lg px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-1 focus:ring-terracotta focus:border-terracotta transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-medium text-ink-700 uppercase tracking-wide mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Context, dependencies, and requirements..."
              className="w-full bg-white border border-warmgray-border rounded-lg px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-1 focus:ring-terracotta focus:border-terracotta transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono font-medium text-ink-700 uppercase tracking-wide mb-1">
                Initial Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full bg-white border border-warmgray-border rounded-lg px-3 py-2 text-xs text-ink-900 focus:outline-none focus:ring-1 focus:ring-terracotta focus:border-terracotta"
              >
                <option value="BACKLOG">Backlog</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="REVIEW">Review</option>
                <option value="DONE">Done</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono font-medium text-ink-700 uppercase tracking-wide mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-white border border-warmgray-border rounded-lg px-3 py-1.5 text-xs text-ink-900 focus:outline-none focus:ring-1 focus:ring-terracotta focus:border-terracotta"
              >
              </input>
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-medium text-ink-700 uppercase tracking-wide mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-white border border-warmgray-border rounded-lg px-3 py-1.5 text-xs text-ink-900 focus:outline-none focus:ring-1 focus:ring-terracotta focus:border-terracotta"
            >
            </input>
          </div>

          <div className="pt-3 border-t border-warmgray-border flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-warmgray-border text-xs text-ink-600 hover:text-ink-900 hover:bg-cream-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="px-4 py-1.5 bg-terracotta hover:bg-terracotta-hover active:bg-terracotta-active disabled:bg-terracotta/40 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create Task</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
