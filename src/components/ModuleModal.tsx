import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { CourseModule, SCHEMA_LIMITS } from '../types/course';

interface ModuleModalProps {
  isOpen: boolean;
  initialModule: CourseModule | null;
  nextOrderIndex: number;
  onClose: () => void;
  onSave: (payload: {
    code: string;
    title: string;
    instructor: string;
    orderIndex: number;
  }) => Promise<void>;
}

export const ModuleModal: React.FC<ModuleModalProps> = ({
  isOpen,
  initialModule,
  nextOrderIndex,
  onClose,
  onSave,
}) => {
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [instructor, setInstructor] = useState('');
  const [orderIndex, setOrderIndex] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (initialModule) {
      setCode(initialModule.code);
      setTitle(initialModule.title);
      setInstructor(initialModule.instructor);
      setOrderIndex(initialModule.orderIndex);
    } else {
      setCode(`AI-${nextOrderIndex}01`);
      setTitle('');
      setInstructor('');
      setOrderIndex(nextOrderIndex);
    }
    setError('');
  }, [isOpen, initialModule, nextOrderIndex]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim();
    const cleanTitle = title.trim();
    if (!cleanCode || !cleanTitle) {
      setError('Module code and title are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({
        code: cleanCode.slice(0, SCHEMA_LIMITS.MODULE_CODE_MAX),
        title: cleanTitle.slice(0, SCHEMA_LIMITS.MODULE_TITLE_MAX),
        instructor: instructor.trim().slice(0, SCHEMA_LIMITS.INSTRUCTOR_MAX),
        orderIndex: Math.max(0, Math.min(1000, Math.round(Number(orderIndex) || 0))),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save module.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="module-modal-title"
    >
      <div className="w-full max-w-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 id="module-modal-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {initialModule ? 'Edit Course Module' : 'Add Course Module'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Class Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={SCHEMA_LIMITS.MODULE_CODE_MAX}
                placeholder="AI-301"
                required
                className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Module or Class Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={SCHEMA_LIMITS.MODULE_TITLE_MAX}
                placeholder="Transformers & Attention Mechanisms"
                required
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Instructor / Schedule Note
              </label>
              <input
                type="text"
                value={instructor}
                onChange={(e) => setInstructor(e.target.value)}
                maxLength={SCHEMA_LIMITS.INSTRUCTOR_MAX}
                placeholder="Dr. Nair · Tue/Thu 18:00"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Order
              </label>
              <input
                type="number"
                min={0}
                max={1000}
                value={orderIndex}
                onChange={(e) => setOrderIndex(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {saving ? 'Saving...' : initialModule ? 'Save Changes' : 'Create Module'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
