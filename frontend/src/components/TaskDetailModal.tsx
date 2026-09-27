import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Task, Suggestion, AffectedTask } from '../types';
import { api, extractErrorMessage } from '../services/api';
import { analyzeDependencies, checkCycleOnAdd } from '../utils/dependencyAnalysis';
import {
  X,
  Calendar,
  AlertTriangle,
  GitFork,
  Sparkles,
  Trash2,
  Plus,
  Check,
  Ban,
  Loader2,
  CheckCircle2,
  Clock,
  MessageSquare,
  Send,
  History,
  ArrowRight,
  Search,
  CheckSquare,
  Square,
  Zap,
  RotateCcw,
} from 'lucide-react';

interface TaskDetailModalProps {
  task: Task | null;
  allTasks: Task[];
  onClose: () => void;
  onRefreshTasks: () => Promise<void>;
}

interface TaskComment {
  id: string;
  author: string;
  avatar: string;
  text: string;
  timestamp: string;
}

interface HistoryItem {
  id: string;
  action: string;
  author: string;
  timeAgo: string;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  allTasks,
  onClose,
  onRefreshTasks,
}) => {
  if (!task) return null;

  // Selected prerequisite autocomplete state
  const [selectedPrereqId, setSelectedPrereqId] = useState<string>('');
  const [prereqSearchQuery, setPrereqSearchQuery] = useState<string>('');
  const [isPrereqDropdownOpen, setIsPrereqDropdownOpen] = useState<boolean>(false);
  const prereqSearchRef = useRef<HTMLDivElement>(null);

  const [isAddingDep, setIsAddingDep] = useState(false);
  const [depError, setDepError] = useState<string | null>(null);
  const [deletingPrereqId, setDeletingPrereqId] = useState<string | null>(null);

  // AI suggestions state
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [processingSuggestionId, setProcessingSuggestionId] = useState<string | null>(null);

  // What-If Delay Preview state
  const [delayDays, setDelayDays] = useState<number>(2);
  const [previewResults, setPreviewResults] = useState<AffectedTask[] | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Comments state (stored in localStorage)
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');

  // Load comments from localStorage
  useEffect(() => {
    try {
      const storageKey = `taskflow_comments_${task.id}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setComments(JSON.parse(saved));
      } else {
        // Initial default comment for demonstration
        const defaultComments: TaskComment[] = [
          {
            id: 'c1',
            author: 'Radhika P.',
            avatar: 'RP',
            text: 'Prerequisite dependencies mapped. Ready to proceed as soon as upstream clears.',
            timestamp: '2 hours ago',
          },
        ];
        setComments(defaultComments);
        localStorage.setItem(storageKey, JSON.stringify(defaultComments));
      }
    } catch {
      // fallback
    }
  }, [task.id]);

  // Reset transient form state when task changes
  useEffect(() => {
    setSelectedPrereqId('');
    setPrereqSearchQuery('');
    setDepError(null);
    setSuggestions([]);
    setSuggestionsError(null);
    setIsPrereqDropdownOpen(false);
    setDelayDays(2);
    setPreviewResults(null);
    setPreviewError(null);
    setIsLoadingPreview(false);
  }, [task.id]);

  // Click outside to close autocomplete dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        prereqSearchRef.current &&
        !prereqSearchRef.current.contains(e.target as Node)
      ) {
        setIsPrereqDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Post Comment Handler
  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    const newComment: TaskComment = {
      id: Date.now().toString(),
      author: 'Radhika P. (You)',
      avatar: 'RP',
      text: newCommentText.trim(),
      timestamp: 'Just now',
    };

    const updated = [...comments, newComment];
    setComments(updated);
    setNewCommentText('');
    try {
      localStorage.setItem(`taskflow_comments_${task.id}`, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  // Delete Comment Handler
  const handleDeleteComment = (commentId: string) => {
    const updated = comments.filter((c) => c.id !== commentId);
    setComments(updated);
    try {
      localStorage.setItem(`taskflow_comments_${task.id}`, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  // Compute available candidates for prerequisites
  const existingPrereqIds = new Set(task.prerequisiteIds || []);
  const candidateTasks = useMemo(() => {
    return allTasks.filter(
      (t) => t.id !== task.id && !existingPrereqIds.has(t.id)
    );
  }, [allTasks, task.id, existingPrereqIds]);

  // Filtered candidate tasks for autocomplete search
  const filteredCandidates = useMemo(() => {
    if (!prereqSearchQuery.trim()) return candidateTasks;
    const q = prereqSearchQuery.toLowerCase();
    return candidateTasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        t.status.toLowerCase().includes(q)
    );
  }, [candidateTasks, prereqSearchQuery]);

  // Full dependency analysis for task scores and cycle detection
  const dependencyAnalysis = useMemo(() => {
    return analyzeDependencies(allTasks);
  }, [allTasks]);

  const taskScore = dependencyAnalysis.scores.get(task.id);
  const isCycleMember = dependencyAnalysis.cycleAnalysis.cycleNodeIds.has(task.id);

  // Candidate tasks annotated with proactive cycle check
  const annotatedCandidates = useMemo(() => {
    return filteredCandidates.map((candidate) => {
      const cycleCheck = checkCycleOnAdd(allTasks, task.id, candidate.id);
      return {
        ...candidate,
        wouldCycle: cycleCheck.wouldCycle,
        cyclePath: cycleCheck.path,
      };
    });
  }, [filteredCandidates, allTasks, task.id]);

  // Prerequisite task objects
  const prerequisiteTasks = useMemo(() => {
    return (task.prerequisiteIds || [])
      .map((pId) => allTasks.find((t) => t.id === pId))
      .filter(Boolean) as Task[];
  }, [task.prerequisiteIds, allTasks]);

  // Direct downstream dependents
  const dependentTasks = useMemo(() => {
    return allTasks.filter((t) => t.prerequisiteIds?.includes(task.id));
  }, [allTasks, task.id]);

  // Format dates
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Not scheduled';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  // Schedule timeline metrics
  const { durationDays, progressPercent } = useMemo(() => {
    if (!task.startDate || !task.endDate) return { durationDays: 2, progressPercent: 50 };
    try {
      const s = new Date(task.startDate).getTime();
      const e = new Date(task.endDate).getTime();
      const now = new Date().getTime();
      const total = Math.max(1, Math.round((e - s) / 86400000));
      const elapsed = Math.max(0, Math.round((now - s) / 86400000));
      const pct = task.status === 'DONE' ? 100 : Math.max(10, Math.min(90, Math.round((elapsed / total) * 100)));
      return { durationDays: total, progressPercent: pct };
    } catch {
      return { durationDays: 2, progressPercent: 50 };
    }
  }, [task.startDate, task.endDate, task.status]);

  // Status Badge Helper
  const renderStatusBadge = (t: Task) => {
    if (t.blocked) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-medium tracking-wide uppercase bg-badge-blockedBg text-badge-blocked border border-badge-blockedBorder">
          Blocked
        </span>
      );
    }
    if (t.status === 'DONE') {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-medium tracking-wide uppercase bg-badge-doneBg text-badge-done border border-badge-doneBorder">
          Done
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-medium tracking-wide uppercase bg-badge-readyBg text-badge-ready border border-badge-readyBorder">
        Ready
      </span>
    );
  };

  // Add dependency handler
  const handleAddDependency = async () => {
    if (!selectedPrereqId) return;
    setIsAddingDep(true);
    setDepError(null);

    try {
      await api.createDependency(task.id, selectedPrereqId);
      setSelectedPrereqId('');
      setPrereqSearchQuery('');
      await onRefreshTasks();
    } catch (err: unknown) {
      const errorMsg = extractErrorMessage(err);
      setDepError(errorMsg);
    } finally {
      setIsAddingDep(false);
    }
  };

  // Remove dependency handler
  const handleRemoveDependency = async (prereqId: string) => {
    setDeletingPrereqId(prereqId);
    setDepError(null);

    try {
      await api.deleteDependency(prereqId, task.id);
      await onRefreshTasks();
    } catch (err: unknown) {
      const errorMsg = extractErrorMessage(err);
      setDepError(errorMsg);
    } finally {
      setDeletingPrereqId(null);
    }
  };

  // Trigger AI suggestions
  const handleFetchSuggestions = async () => {
    setIsLoadingSuggestions(true);
    setSuggestionsError(null);

    try {
      const results = await api.getSuggestions(task.id);
      setSuggestions(results);
      if (results.length === 0) {
        setSuggestionsError('AI examined all tasks: no missing prerequisites detected for this task.');
      }
    } catch (err: unknown) {
      const errorMsg = extractErrorMessage(err);
      setSuggestionsError(errorMsg);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // Accept suggestion handler
  const handleAcceptSuggestion = async (suggestion: Suggestion) => {
    setProcessingSuggestionId(suggestion.id);
    setSuggestionsError(null);

    try {
      await api.acceptSuggestion(suggestion.id);
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
      await onRefreshTasks();
    } catch (err: unknown) {
      const errorMsg = extractErrorMessage(err);
      setSuggestionsError(`Failed to accept suggestion: ${errorMsg}`);
    } finally {
      setProcessingSuggestionId(null);
    }
  };

  // Reject suggestion handler
  const handleRejectSuggestion = async (suggestionId: string) => {
    setProcessingSuggestionId(suggestionId);
    try {
      await api.rejectSuggestion(suggestionId);
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
    } catch (err: unknown) {
      const errorMsg = extractErrorMessage(err);
      setSuggestionsError(errorMsg);
    } finally {
      setProcessingSuggestionId(null);
    }
  };

  // What-If Delay Preview Handler (read-only)
  const handlePreviewImpact = async () => {
    setIsLoadingPreview(true);
    setPreviewError(null);

    try {
      // Current duration is: endDate - startDate in days. If the task doesn't have dates, default to current duration = 1.
      let currentDuration = 1;
      if (task.startDate && task.endDate) {
        try {
          const s = new Date(task.startDate).getTime();
          const e = new Date(task.endDate).getTime();
          const diff = Math.round((e - s) / 86400000);
          currentDuration = Math.max(1, diff);
        } catch {
          currentDuration = 1;
        }
      }

      const durationDays = currentDuration + Math.max(0, delayDays);
      const res = await api.previewTaskDelay(task.id, { durationDays });
      setPreviewResults(res.affectedTasks || []);
    } catch (_err: unknown) {
      setPreviewError("Couldn't load preview.");
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Generated status history log
  const historyLog: HistoryItem[] = useMemo(() => {
    const list: HistoryItem[] = [];
    if (task.status === 'DONE') {
      list.push({
        id: 'h1',
        action: 'Completed task (moved to DONE)',
        author: 'Alex K.',
        timeAgo: '1 hour ago',
      });
    }
    if (task.status === 'REVIEW' || task.status === 'DONE') {
      list.push({
        id: 'h2',
        action: 'Submitted for QA verification (REVIEW)',
        author: 'Radhika P.',
        timeAgo: 'Yesterday',
      });
    }
    if (task.status === 'IN_PROGRESS' || task.status === 'REVIEW' || task.status === 'DONE') {
      list.push({
        id: 'h3',
        action: 'Started execution (moved to IN_PROGRESS)',
        author: 'Radhika P.',
        timeAgo: '2 days ago',
      });
    }
    if (task.prerequisiteIds && task.prerequisiteIds.length > 0) {
      list.push({
        id: 'h4',
        action: `Linked ${task.prerequisiteIds.length} DAG prerequisite(s)`,
        author: 'System DAG Engine',
        timeAgo: '3 days ago',
      });
    }
    list.push({
      id: 'h5',
      action: 'Task created in BACKLOG',
      author: 'Radhika P.',
      timeAgo: '4 days ago',
    });
    return list;
  }, [task.status, task.prerequisiteIds]);

  const completedPrereqsCount = prerequisiteTasks.filter((t) => t.status === 'DONE').length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex justify-end">
      {/* Background click to close */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Slide-over Drawer */}
      <div className="relative w-full max-w-2xl bg-cream-50 dark:bg-dark-bg min-h-screen shadow-drawer border-l border-warmgray-border dark:border-dark-border flex flex-col z-10 animate-in slide-in-from-right duration-200 text-ink-900 dark:text-slate-100">
        {/* Drawer Header */}
        <div className="p-6 border-b border-warmgray-border dark:border-dark-border bg-cream-100/70 dark:bg-dark-surface flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-xs font-mono text-ink-400 dark:text-slate-400">
                TASK #{task.id}
              </span>
              <span className="text-ink-300 dark:text-slate-600">•</span>
              <span className="text-xs font-mono font-medium text-ink-600 dark:text-slate-300 uppercase">
                {task.status.replace('_', ' ')}
              </span>
              <span className="text-ink-300 dark:text-slate-600">•</span>
              {renderStatusBadge(task)}
            </div>
            <h3 className="font-display text-2xl font-medium text-ink-900 dark:text-slate-100 leading-snug">
              {task.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-warmgray-border dark:border-dark-border text-ink-500 dark:text-slate-400 hover:text-ink-900 dark:hover:text-slate-100 hover:bg-cream-200 dark:hover:bg-dark-cardHover transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="p-6 flex-1 space-y-6 overflow-y-auto">
          {/* Circular Dependency Loop Alert Banner */}
          {isCycleMember && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/60 border-2 border-red-500 dark:border-red-600 text-red-900 dark:text-red-200 flex items-start gap-3 shadow-md animate-pulse">
              <RotateCcw className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5 animate-spin" />
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-red-700 dark:text-red-300">
                  ⚠️ Circular Reference Deadlock
                </div>
                <p className="text-xs mt-0.5 leading-relaxed font-mono">
                  This task is part of a circular prerequisite loop. Tasks wait on each other infinitely until a link in the cycle is removed.
                </p>
              </div>
            </div>
          )}

          {/* Blocked Alert Banner if currently blocked */}
          {task.blocked && !isCycleMember && (
            <div className="p-4 rounded-lg bg-badge-blockedBg/90 dark:bg-red-950/40 border border-badge-blockedBorder dark:border-red-800/60 text-badge-blocked dark:text-red-300 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-badge-blocked dark:text-red-400" />
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider">
                  Blocked by Prerequisites
                </div>
                <p className="text-sm mt-0.5 leading-relaxed font-normal">
                  {task.blockedReason || 'This task cannot start until all prerequisite tasks are completed.'}
                </p>
              </div>
            </div>
          )}

          {/* Dependency Importance Score & Network Reach Card */}
          {taskScore && (
            <div className="bg-white dark:bg-dark-card border border-warmgray-border dark:border-dark-border rounded-xl p-4 shadow-subtle space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-ink-700 dark:text-slate-300">
                    Network Dependency Score
                  </span>
                </div>
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                  taskScore.tier === 'Keystone'
                    ? 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950 dark:text-purple-200'
                    : taskScore.tier === 'High'
                    ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200'
                    : 'bg-cream-200 text-ink-700 border-warmgray-border dark:bg-dark-surface dark:text-slate-300'
                }`}>
                  {taskScore.tierLabel} ({taskScore.score}/100)
                </span>
              </div>

              {/* Progress Bar of Dependency Score */}
              <div className="w-full h-2 bg-cream-200 dark:bg-dark-surface rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    taskScore.score >= 70 ? 'bg-purple-600' : taskScore.score >= 40 ? 'bg-amber-500' : 'bg-slate-400'
                  }`}
                  style={{ width: `${taskScore.score}%` }}
                />
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs font-mono pt-1 text-center">
                <div className="p-2 rounded bg-cream-100/60 dark:bg-dark-surface">
                  <span className="text-ink-400 dark:text-slate-500 block text-[10px] uppercase">Direct Dependents</span>
                  <span className="text-ink-900 dark:text-slate-100 font-bold text-sm">{taskScore.directDependentsCount}</span>
                </div>
                <div className="p-2 rounded bg-cream-100/60 dark:bg-dark-surface">
                  <span className="text-ink-400 dark:text-slate-500 block text-[10px] uppercase">Transitive Reach</span>
                  <span className="text-ink-900 dark:text-slate-100 font-bold text-sm">{taskScore.transitiveDependentsCount}</span>
                </div>
                <div className="p-2 rounded bg-cream-100/60 dark:bg-dark-surface">
                  <span className="text-ink-400 dark:text-slate-500 block text-[10px] uppercase">Unblocks Pending</span>
                  <span className="text-purple-700 dark:text-purple-300 font-bold text-sm">{taskScore.unblocksPendingCount}</span>
                </div>
              </div>

              <p className="text-[11px] text-ink-500 dark:text-slate-400 font-mono">
                {taskScore.isKeystone
                  ? '⚡ Keystone Blocker: Multiple downstream tasks depend on this task.'
                  : taskScore.isOrphaned
                  ? '🍃 Leaf Task: 0 tasks depend on this. Safe to defer without blocking the team.'
                  : 'Moderate reach across the dependency graph.'}
              </p>
            </div>
          )}

          {/* 1. Full Description Section */}
          <div>
            <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-400 dark:text-slate-400 mb-2">
              Full Description
            </h4>
            <div className="bg-white dark:bg-dark-card border border-warmgray-border dark:border-dark-border rounded-lg p-4 text-sm text-ink-800 dark:text-slate-200 leading-relaxed shadow-subtle font-normal">
              {task.description || (
                <span className="text-ink-400 dark:text-slate-500 italic">No description provided.</span>
              )}
            </div>
          </div>

          {/* 2. Dependency Chain Visualization (Pipeline Diagram) */}
          <div>
            <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-400 dark:text-slate-400 mb-2 flex items-center gap-1.5">
              <GitFork className="w-3.5 h-3.5 text-terracotta dark:text-neon-orange" />
              <span>Dependency Chain Pipeline</span>
            </h4>

            <div className="bg-white dark:bg-dark-card border border-warmgray-border dark:border-dark-border rounded-lg p-3.5 shadow-subtle overflow-x-auto">
              {/* Horizontal Pipeline Diagram: Blocker1 → Blocker2 → [THIS TASK] → Dependent1, Dependent2 */}
              <div className="flex items-center gap-2 min-w-max py-1 text-xs font-mono">
                {/* Blockers */}
                {prerequisiteTasks.length === 0 ? (
                  <span className="px-2.5 py-1.5 rounded bg-cream-200/60 dark:bg-dark-surface dark:text-slate-400 text-ink-500 border border-dashed border-warmgray-border dark:border-dark-border">
                    Root (No prerequisites)
                  </span>
                ) : (
                  prerequisiteTasks.map((prereq) => (
                    <React.Fragment key={prereq.id}>
                      <div
                        className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 shadow-2xs ${
                          prereq.status === 'DONE'
                            ? 'bg-badge-readyBg dark:bg-emerald-950/40 text-badge-ready dark:text-emerald-300 border-badge-readyBorder dark:border-emerald-700/60'
                            : 'bg-badge-blockedBg dark:bg-red-950/40 text-badge-blocked dark:text-red-300 border-badge-blockedBorder dark:border-red-800/60'
                        }`}
                      >
                        {prereq.status === 'DONE' ? (
                          <CheckCircle2 className="w-3 h-3 text-badge-ready dark:text-emerald-400" />
                        ) : (
                          <Clock className="w-3 h-3 text-badge-blocked dark:text-red-400 animate-pulse" />
                        )}
                        <span className="font-medium max-w-[130px] truncate">{prereq.title}</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-ink-400 dark:text-slate-500 shrink-0" />
                    </React.Fragment>
                  ))
                )}

                {/* This Task (Highlighted) */}
                <div className="px-3 py-1.5 rounded-lg bg-terracotta-light dark:bg-orange-950/40 border-2 border-terracotta dark:border-neon-orange text-terracotta dark:text-neon-orange font-semibold shadow-xs flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-terracotta dark:bg-neon-orange animate-ping" />
                  <span className="max-w-[150px] truncate">{task.title} (THIS TASK)</span>
                </div>

                {/* Dependents */}
                {dependentTasks.length > 0 && (
                  <>
                    <ArrowRight className="w-3.5 h-3.5 text-ink-400 dark:text-slate-500 shrink-0" />
                    <div className="flex items-center gap-1.5">
                      {dependentTasks.map((dep) => (
                        <div
                          key={dep.id}
                          className="px-2.5 py-1.5 rounded-lg bg-cream-100 dark:bg-dark-surface border border-warmgray-border dark:border-dark-border text-ink-700 dark:text-slate-300 shadow-2xs"
                        >
                          <span className="max-w-[130px] truncate block">{dep.title}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 3. Visual Timeline Bar with Start/End Dates */}
          <div>
            <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-400 dark:text-slate-400 mb-2 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-ink-500 dark:text-slate-400" />
              <span>Schedule Timeline Track</span>
            </h4>

            <div className="bg-white dark:bg-dark-card border border-warmgray-border dark:border-dark-border rounded-lg p-4 shadow-subtle space-y-3">
              <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                <div>
                  <span className="text-ink-400 dark:text-slate-500 block text-[10px] uppercase">Start Date</span>
                  <span className="text-ink-900 dark:text-slate-100 font-semibold">{formatDate(task.startDate)}</span>
                </div>
                <div>
                  <span className="text-ink-400 dark:text-slate-500 block text-[10px] uppercase">Duration</span>
                  <span className="text-ink-900 dark:text-slate-100 font-semibold">{durationDays} days</span>
                </div>
                <div>
                  <span className="text-ink-400 dark:text-slate-500 block text-[10px] uppercase">End Date</span>
                  <span className="text-ink-900 dark:text-slate-100 font-semibold">{formatDate(task.endDate)}</span>
                </div>
              </div>

              {/* Progress Bar Track */}
              <div className="space-y-1">
                <div className="w-full h-2.5 bg-cream-200 dark:bg-dark-surface rounded-full overflow-hidden border border-warmgray-border/50 dark:border-dark-border">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      task.status === 'DONE'
                        ? 'bg-badge-ready dark:bg-emerald-500'
                        : task.blocked
                        ? 'bg-badge-blocked dark:bg-red-500'
                        : 'bg-terracotta dark:bg-neon-orange'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-ink-400 dark:text-slate-500">
                  <span>Start</span>
                  <span>{progressPercent}% schedule progress</span>
                  <span>Target Due</span>
                </div>
              </div>
            </div>
          </div>

          {/* Preview a delay section */}
          <div>
            <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-400 dark:text-slate-400 mb-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-terracotta dark:text-neon-orange" />
              <span>Preview a delay</span>
            </h4>

            <div className="bg-white dark:bg-dark-card border border-warmgray-border dark:border-dark-border rounded-lg p-4 shadow-subtle space-y-3">
              <p className="text-xs text-ink-600 dark:text-slate-400 leading-relaxed font-normal">
                Simulate what happens to downstream project tasks if this task is delayed.
              </p>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <label htmlFor="delay-days-input" className="text-xs font-medium text-ink-700 dark:text-slate-300 whitespace-nowrap">
                    Days to delay:
                  </label>
                  <input
                    id="delay-days-input"
                    type="number"
                    min="1"
                    max="60"
                    value={delayDays}
                    onChange={(e) => setDelayDays(Math.max(1, parseInt(e.target.value) || 1))}
                    disabled={isLoadingPreview}
                    className="w-20 px-2.5 py-1.5 bg-cream-50 dark:bg-dark-surface border border-warmgray-border dark:border-dark-border rounded-lg text-xs font-mono font-semibold text-ink-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-terracotta dark:focus:ring-neon-orange focus:border-terracotta dark:focus:border-neon-orange text-center disabled:opacity-50"
                  />
                </div>

                <button
                  type="button"
                  onClick={handlePreviewImpact}
                  disabled={isLoadingPreview}
                  className="px-3.5 py-1.5 bg-terracotta hover:bg-terracotta-hover active:bg-terracotta-active disabled:bg-terracotta/40 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm shrink-0 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isLoadingPreview ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Previewing...</span>
                    </>
                  ) : (
                    <span>Preview impact</span>
                  )}
                </button>
              </div>

              {/* Inline Error Notice */}
              {previewError && (
                <div className="p-2.5 rounded-lg bg-badge-blockedBg dark:bg-red-950/40 border border-badge-blockedBorder dark:border-red-800/60 text-badge-blocked dark:text-red-300 text-xs font-mono flex items-center justify-between gap-2">
                  <span>{typeof previewError === 'string' ? previewError : String((previewError as any)?.message || JSON.stringify(previewError))}</span>
                  <button
                    type="button"
                    onClick={() => setPreviewError(null)}
                    className="hover:underline font-mono text-[11px]"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Preview Results Display */}
              {previewResults !== null && !isLoadingPreview && (
                <div className="pt-2 border-t border-warmgray-border/60 dark:border-dark-border/60 space-y-2">
                  {previewResults.length === 0 ? (
                    <p className="text-xs text-ink-500 dark:text-slate-400 font-mono italic">
                      No other tasks would be affected.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-mono text-ink-500 dark:text-slate-400 font-semibold block">
                        Affected tasks ({previewResults.length}):
                      </span>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {previewResults.map((item) => {
                          const affectedTaskObj = allTasks.find((t) => t.id === item.taskId);
                          const title = affectedTaskObj ? affectedTaskObj.title : item.taskId;
                          return (
                            <div
                              key={item.taskId}
                              className="p-2 rounded bg-cream-100/70 dark:bg-dark-surface border border-warmgray-border/70 dark:border-dark-border text-xs font-mono text-ink-800 dark:text-slate-200 flex items-center justify-between gap-2"
                            >
                              <span className="font-medium truncate">
                                {title}: now ends {item.newEndDate}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 4. Prerequisites Checklist (Visual Checkmarks) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-400 dark:text-slate-400 flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-badge-ready dark:text-emerald-400" />
                <span>Prerequisites Checklist ({completedPrereqsCount}/{prerequisiteTasks.length})</span>
              </h4>
              <span className="text-[11px] font-mono text-ink-500 dark:text-slate-400">
                {prerequisiteTasks.length === 0
                  ? 'No prerequisites'
                  : completedPrereqsCount === prerequisiteTasks.length
                  ? '✓ 100% Cleared'
                  : `${prerequisiteTasks.length - completedPrereqsCount} pending`}
              </span>
            </div>

            {/* Checklist items */}
            <div className="space-y-2 mb-3">
              {prerequisiteTasks.length === 0 ? (
                <div className="bg-white/60 dark:bg-dark-card/60 border border-dashed border-warmgray-border dark:border-dark-border rounded-lg p-3 text-center text-xs text-ink-400 dark:text-slate-500 font-mono">
                  This task has no prerequisites. It can be worked on independently.
                </div>
              ) : (
                prerequisiteTasks.map((prereq) => {
                  const isDone = prereq.status === 'DONE';
                  const isDeleting = deletingPrereqId === prereq.id;

                  return (
                    <div
                      key={prereq.id}
                      className="bg-white dark:bg-dark-card border border-warmgray-border dark:border-dark-border rounded-lg p-3 flex items-center justify-between gap-3 shadow-subtle hover:border-ink-300 dark:hover:border-slate-500 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {isDone ? (
                          <CheckSquare className="w-4 h-4 text-badge-ready dark:text-emerald-400 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-badge-blocked dark:text-red-400 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <span
                            className={`text-xs font-medium block truncate ${
                              isDone ? 'text-ink-500 dark:text-slate-500 line-through' : 'text-ink-900 dark:text-slate-100 font-semibold'
                            }`}
                          >
                            {prereq.title}
                          </span>
                          <span className="text-[10px] font-mono text-ink-400 dark:text-slate-500">
                            Status: {prereq.status} • Ends: {prereq.endDate || 'TBD'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {renderStatusBadge(prereq)}
                        <button
                          onClick={() => handleRemoveDependency(prereq.id)}
                          disabled={isDeleting}
                          title="Remove prerequisite dependency"
                          className="p-1 rounded text-ink-400 hover:text-badge-blocked hover:bg-badge-blockedBg/50 dark:hover:bg-red-950/50 transition-colors disabled:opacity-50"
                        >
                          {isDeleting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-badge-blocked" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Inline 409 Cycle Detection Error Notice */}
            {depError && (
              <div className="mb-3 p-3.5 rounded-lg bg-badge-blockedBg dark:bg-red-950/40 border border-badge-blockedBorder dark:border-red-800/60 text-badge-blocked dark:text-red-300 flex items-start gap-2.5 animate-in fade-in duration-200">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-badge-blocked dark:text-red-400" />
                <div className="flex-1 text-xs">
                  <div className="font-semibold uppercase tracking-wider mb-0.5">
                    Cycle Conflict Detected (409)
                  </div>
                  <div className="leading-relaxed font-mono">{typeof depError === 'string' ? depError : String((depError as any)?.message || JSON.stringify(depError))}</div>
                </div>
                <button
                  onClick={() => setDepError(null)}
                  className="text-xs text-badge-blocked dark:text-red-400 hover:underline font-mono"
                >
                  ✕
                </button>
              </div>
            )}

            {/* 7. Add New Dependency with Autocomplete Search UI */}
            <div ref={prereqSearchRef} className="relative bg-cream-100/90 dark:bg-dark-surface border border-warmgray-border dark:border-dark-border rounded-lg p-3">
              <label className="block text-xs font-medium text-ink-700 dark:text-slate-300 mb-1.5">
                Add prerequisite (with autocomplete search)
              </label>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 dark:text-slate-500 pointer-events-none" />
                  <input
                    type="text"
                    value={prereqSearchQuery}
                    onFocus={() => setIsPrereqDropdownOpen(true)}
                    onChange={(e) => {
                      setPrereqSearchQuery(e.target.value);
                      setIsPrereqDropdownOpen(true);
                    }}
                    placeholder="Search candidate tasks to link as prerequisite..."
                    className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-dark-card border border-warmgray-border dark:border-dark-border rounded-lg text-xs text-ink-900 dark:text-slate-100 placeholder:text-ink-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-terracotta dark:focus:ring-neon-orange focus:border-terracotta dark:focus:border-neon-orange transition-all"
                  />

                  {/* Autocomplete Dropdown */}
                  {isPrereqDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-dark-card border border-warmgray-border dark:border-dark-border rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto divide-y divide-warmgray-border/40 dark:divide-dark-border text-xs">
                      {annotatedCandidates.length === 0 ? (
                        <div className="p-3 text-center text-ink-400 dark:text-slate-500 font-mono text-[11px]">
                          No candidate tasks available to link
                        </div>
                      ) : (
                        annotatedCandidates.map((candidate) => {
                          const isBlockedByCycle = candidate.wouldCycle;
                          return (
                            <div
                              key={candidate.id}
                              onClick={() => {
                                if (isBlockedByCycle) return;
                                setSelectedPrereqId(candidate.id);
                                setPrereqSearchQuery(candidate.title);
                                setIsPrereqDropdownOpen(false);
                              }}
                              className={`p-2 flex items-center justify-between gap-2 transition-colors ${
                                isBlockedByCycle
                                  ? 'bg-red-50/70 dark:bg-red-950/40 text-ink-400 dark:text-slate-500 cursor-not-allowed opacity-80'
                                  : 'hover:bg-cream-100 dark:hover:bg-dark-cardHover cursor-pointer text-ink-900 dark:text-slate-100'
                              }`}
                              title={
                                isBlockedByCycle
                                  ? `Cycle Defense Warning: Linking this task creates an illegal circular loop [${candidate.cyclePath.map(id => allTasks.find(t=>t.id===id)?.title || id).join(' ➔ ')}]`
                                  : undefined
                              }
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className={`font-medium truncate ${isBlockedByCycle ? 'line-through text-red-700 dark:text-red-400' : ''}`}>
                                  {candidate.title}
                                </span>
                                {isBlockedByCycle && (
                                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-200 border border-red-300 dark:border-red-800 font-bold shrink-0 flex items-center gap-0.5">
                                    <RotateCcw className="w-2.5 h-2.5 animate-spin" />
                                    <span>Creates Cycle</span>
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-cream-200 dark:bg-dark-surface text-ink-600 dark:text-slate-300 shrink-0">
                                {candidate.status}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleAddDependency}
                  disabled={!selectedPrereqId || isAddingDep}
                  className="px-3.5 py-1.5 bg-terracotta hover:bg-terracotta-hover active:bg-terracotta-active disabled:bg-terracotta/40 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm shrink-0"
                >
                  {isAddingDep ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Checking DAG...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Add</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-[10px] text-ink-400 dark:text-slate-500 font-mono mt-1">
                Cycle defense: Circular prerequisite chains (A → B → A) are strictly rejected with 409 Conflict.
              </p>
            </div>
          </div>

          {/* 5. Status History Log */}
          <div>
            <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-400 dark:text-slate-400 mb-2 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-ink-500 dark:text-slate-400" />
              <span>Status & Column Activity Log</span>
            </h4>

            <div className="bg-white dark:bg-dark-card border border-warmgray-border dark:border-dark-border rounded-lg p-3.5 shadow-subtle divide-y divide-warmgray-border/50 dark:divide-dark-border text-xs font-mono">
              {historyLog.map((item) => (
                <div key={item.id} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-terracotta dark:bg-neon-orange shrink-0" />
                    <span className="text-ink-800 dark:text-slate-200 font-sans text-xs">{item.action}</span>
                  </div>
                  <div className="text-[10px] text-ink-400 dark:text-slate-500 flex items-center gap-1 shrink-0">
                    <span>by {item.author}</span>
                    <span>•</span>
                    <span>{item.timeAgo}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 6. Comments Section (Local Storage) */}
          <div>
            <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-400 dark:text-slate-400 mb-2 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-terracotta dark:text-neon-orange" />
              <span>Team Comments ({comments.length})</span>
            </h4>

            <div className="bg-white dark:bg-dark-card border border-warmgray-border dark:border-dark-border rounded-lg p-4 shadow-subtle space-y-3">
              {/* Existing Comments List */}
              <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                {comments.length === 0 ? (
                  <div className="text-center py-4 text-xs font-mono text-ink-400 dark:text-slate-500">
                    No comments yet. Leave a note for the team!
                  </div>
                ) : (
                  comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="p-2.5 rounded-lg bg-cream-50 dark:bg-dark-surface border border-warmgray-border/70 dark:border-dark-border text-xs flex items-start justify-between gap-2"
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-terracotta-light dark:bg-orange-950/40 text-terracotta dark:text-neon-orange border border-terracotta-border dark:border-orange-800/60 flex items-center justify-center font-bold text-[10px] shrink-0 font-sans">
                          {comment.avatar}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-[11px] font-mono text-ink-500 dark:text-slate-400">
                            <span className="font-semibold text-ink-800 dark:text-slate-100 font-sans">{comment.author}</span>
                            <span>•</span>
                            <span>{comment.timestamp}</span>
                          </div>
                          <p className="text-ink-800 dark:text-slate-200 mt-1 text-xs leading-relaxed font-sans">
                            {comment.text}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="p-1 text-ink-400 hover:text-badge-blocked transition-colors"
                        title="Delete comment"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Add Comment Input */}
              <form onSubmit={handleAddComment} className="pt-2 border-t border-warmgray-border dark:border-dark-border flex gap-2">
                <input
                  type="text"
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Add a team note or status update..."
                  className="flex-1 bg-cream-50 dark:bg-dark-surface border border-warmgray-border dark:border-dark-border rounded-lg px-3 py-1.5 text-xs text-ink-900 dark:text-slate-100 placeholder:text-ink-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-terracotta dark:focus:ring-neon-orange focus:border-terracotta dark:focus:border-neon-orange transition-colors"
                />
                <button
                  type="submit"
                  disabled={!newCommentText.trim()}
                  className="px-3 py-1.5 bg-terracotta hover:bg-terracotta-hover active:bg-terracotta-active disabled:bg-terracotta/40 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1 shadow-sm shrink-0"
                >
                  <Send className="w-3 h-3" />
                  <span>Post</span>
                </button>
              </form>
            </div>
          </div>

          {/* AI Suggestions Section (Maintained from Core Spec) */}
          <div className="pt-4 border-t border-warmgray-border dark:border-dark-border">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-terracotta dark:text-neon-orange" />
                  <span>AI Dependency Suggestions</span>
                </h4>
                <p className="text-[11px] text-ink-500 dark:text-slate-400 mt-0.5">
                  Human-in-the-loop: AI recommends likely prerequisites, but never applies them without approval.
                </p>
              </div>
              <button
                onClick={handleFetchSuggestions}
                disabled={isLoadingSuggestions}
                className="px-3 py-1.5 bg-terracotta-light dark:bg-orange-950/40 hover:bg-terracotta/15 dark:hover:bg-orange-900/50 border border-terracotta-border dark:border-orange-800/60 text-terracotta dark:text-neon-orange text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
              >
                {isLoadingSuggestions ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Suggest Prerequisites</span>
                  </>
                )}
              </button>
            </div>

            {/* AI Error / Notice */}
            {suggestionsError && (
              <div className="mb-3 p-3 rounded-lg bg-badge-blockedBg/80 dark:bg-red-950/40 border border-badge-blockedBorder dark:border-red-800/60 text-badge-blocked dark:text-red-300 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-badge-blocked dark:text-red-400" />
                <span className="flex-1 leading-snug">{typeof suggestionsError === 'string' ? suggestionsError : String((suggestionsError as any)?.message || JSON.stringify(suggestionsError))}</span>
                <button
                  onClick={() => setSuggestionsError(null)}
                  className="text-xs font-mono hover:underline"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Suggestions List */}
            {suggestions.length > 0 && (
              <div className="space-y-3">
                {suggestions.map((suggestion) => {
                  const prereqTask = allTasks.find(
                    (t) => t.id === suggestion.suggestedPrerequisiteId
                  );
                  const isProcessing = processingSuggestionId === suggestion.id;

                  const confidenceClass =
                    suggestion.confidence === 'HIGH'
                      ? 'bg-badge-readyBg dark:bg-emerald-950/40 text-badge-ready dark:text-emerald-300 border-badge-readyBorder dark:border-emerald-700/60'
                      : suggestion.confidence === 'MEDIUM'
                      ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-700/60'
                      : 'bg-cream-300 dark:bg-dark-surface text-ink-600 dark:text-slate-300 border-warmgray-border dark:border-dark-border';

                  return (
                    <div
                      key={suggestion.id}
                      className="bg-white dark:bg-dark-card border border-warmgray-border dark:border-dark-border rounded-lg p-3.5 shadow-subtle space-y-2 hover:border-terracotta-border dark:hover:border-neon-orange/60 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-medium text-ink-900 dark:text-slate-100 flex items-center gap-1.5 truncate">
                          <span className="text-ink-400 dark:text-slate-400">Prerequisite:</span>
                          <span className="font-semibold text-terracotta dark:text-neon-orange truncate">
                            {prereqTask ? prereqTask.title : `#${suggestion.suggestedPrerequisiteId}`}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-medium ${confidenceClass}`}
                        >
                          {suggestion.confidence} Confidence
                        </span>
                      </div>

                      <p className="text-xs text-ink-600 dark:text-slate-300 leading-relaxed font-normal bg-cream-100/60 dark:bg-dark-surface p-2.5 rounded border border-warmgray-border/60 dark:border-dark-border">
                        {suggestion.reason}
                      </p>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          onClick={() => handleRejectSuggestion(suggestion.id)}
                          disabled={isProcessing}
                          className="px-2.5 py-1 rounded border border-warmgray-border dark:border-dark-border text-xs text-ink-600 dark:text-slate-300 hover:text-ink-900 dark:hover:text-slate-100 hover:bg-cream-200 dark:hover:bg-dark-cardHover transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                          <Ban className="w-3 h-3 text-ink-400 dark:text-slate-500" />
                          <span>Reject</span>
                        </button>
                        <button
                          onClick={() => handleAcceptSuggestion(suggestion)}
                          disabled={isProcessing}
                          className="px-3 py-1 rounded bg-terracotta hover:bg-terracotta-hover active:bg-terracotta-active text-xs font-medium text-white transition-colors flex items-center gap-1 shadow-sm disabled:opacity-50"
                        >
                          {isProcessing ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3 stroke-[2.5]" />
                          )}
                          <span>Accept & Link</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
