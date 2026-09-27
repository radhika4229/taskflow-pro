import React, { useState, useMemo, useRef } from 'react';
import { Task } from '../types';
import { ToggleSwitch } from './ToggleSwitch';
import { calculateCriticalPath } from '../utils/criticalPath';
import { analyzeDependencies, EdgeImportance } from '../utils/dependencyAnalysis';
import {
  Network,
  Zap,
  Flame,
  ZoomIn,
  ZoomOut,
  Maximize2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  FolderTree,
  Copy,
  ChevronDown,
  Code2,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';

interface DependencyGraphViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

export const DependencyGraphView: React.FC<DependencyGraphViewProps> = ({
  tasks,
  onTaskClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Interaction States
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<{ sourceId: string; targetId: string } | null>(null);
  const [showCriticalPath, setShowCriticalPath] = useState(true);
  const [showPulses, setShowPulses] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Simplified Dependency View (Text-based Tree) for Mobile
  const [viewMode, setViewMode] = useState<'graph' | 'tree'>(() => {
    return typeof window !== 'undefined' ? (window.innerWidth < 768 ? 'tree' : 'graph') : 'graph';
  });
  const [showAsciiRaw, setShowAsciiRaw] = useState(false);
  const [copiedAscii, setCopiedAscii] = useState(false);
  const [collapsedTreeNodes, setCollapsedTreeNodes] = useState<Set<string>>(new Set());

  const toggleCollapseTreeNode = (taskId: string) => {
    setCollapsedTreeNodes((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  // Simulated circular loop state for validating cycle defense
  const [simulateCycle, setSimulateCycle] = useState(false);

  // Effective tasks (if simulateCycle is active, creates a synthetic cycle loop from the last task to the first task)
  const effectiveTasks = useMemo(() => {
    if (!simulateCycle || tasks.length < 2) return tasks;
    const firstTask = tasks[0];
    const lastTask = tasks[tasks.length - 1];
    return tasks.map((t) => {
      if (t.id === firstTask.id) {
        const prereqs = t.prerequisiteIds || [];
        if (!prereqs.includes(lastTask.id)) {
          return { ...t, prerequisiteIds: [...prereqs, lastTask.id] };
        }
      }
      return t;
    });
  }, [tasks, simulateCycle]);

  // Node & Layout Constants
  const NODE_WIDTH = 220;
  const NODE_HEIGHT = 84;
  const LAYER_GAP = 300;
  const NODE_GAP = 120;
  const PADDING_X = 80;
  const PADDING_Y = 80;

  // 1. Build lookup tables
  const taskMap = useMemo(() => {
    const map = new Map<string, Task>();
    effectiveTasks.forEach((t) => map.set(t.id, t));
    return map;
  }, [effectiveTasks]);

  const dependentsMap = useMemo(() => {
    const map = new Map<string, string[]>();
    effectiveTasks.forEach((t) => {
      (t.prerequisiteIds || []).forEach((prereqId) => {
        const list = map.get(prereqId) || [];
        list.push(t.id);
        map.set(prereqId, list);
      });
    });
    return map;
  }, [effectiveTasks]);

  // 2. Compute Topological Ranks (Layer assignment for left-to-right DAG layout)
  const nodeRanks = useMemo(() => {
    const ranks = new Map<string, number>();
    effectiveTasks.forEach((t) => ranks.set(t.id, 0));

    // Multi-pass relaxation to find maximum rank (topological depth) with cycle bound protection
    for (let iter = 0; iter < effectiveTasks.length; iter++) {
      let changed = false;
      effectiveTasks.forEach((t) => {
        const myRank = ranks.get(t.id) || 0;
        (t.prerequisiteIds || []).forEach((pId) => {
          const pRank = ranks.get(pId) || 0;
          if (myRank <= pRank) {
            ranks.set(t.id, Math.min(effectiveTasks.length, pRank + 1));
            changed = true;
          }
        });
      });
      if (!changed) break;
    }
    return ranks;
  }, [effectiveTasks]);

  // 3. Compute Node Coordinates & SVG ViewBox
  const { nodePositions, svgWidth, svgHeight } = useMemo(() => {
    const layers = new Map<number, Task[]>();
    let maxR = 0;

    effectiveTasks.forEach((t) => {
      const r = nodeRanks.get(t.id) || 0;
      if (r > maxR) maxR = r;
      const list = layers.get(r) || [];
      list.push(t);
      layers.set(r, list);
    });

    const positions = new Map<string, { x: number; y: number }>();
    let maxNodesInLayer = 0;

    layers.forEach((layerTasks) => {
      if (layerTasks.length > maxNodesInLayer) {
        maxNodesInLayer = layerTasks.length;
      }
    });

    const totalCalculatedHeight = Math.max(
      540,
      maxNodesInLayer * NODE_GAP + PADDING_Y * 2
    );

    layers.forEach((layerTasks, rank) => {
      const x = PADDING_X + rank * LAYER_GAP;
      const layerHeight = layerTasks.length * NODE_GAP;
      const startY = (totalCalculatedHeight - layerHeight) / 2 + NODE_GAP / 2 - NODE_HEIGHT / 2;

      layerTasks.forEach((task, index) => {
        const y = startY + index * NODE_GAP;
        positions.set(task.id, { x, y });
      });
    });

    const calculatedWidth = Math.max(960, PADDING_X * 2 + (maxR + 1) * LAYER_GAP);

    return {
      nodePositions: positions,
      maxLayers: maxR + 1,
      svgWidth: calculatedWidth,
      svgHeight: totalCalculatedHeight,
    };
  }, [effectiveTasks, nodeRanks]);

  // 4. Compute Critical Path (Longest chain in the DAG)
  const criticalPath = useMemo(() => calculateCriticalPath(effectiveTasks), [effectiveTasks]);
  const { criticalPathNodeIds, criticalPathEdgeKeys } = criticalPath;

  // 5. Compute Full Dependency Analysis (Cycles, Keystones, Orphans, Scores, Edge Importance)
  const dependencyAnalysis = useMemo(
    () => analyzeDependencies(effectiveTasks, criticalPathNodeIds, criticalPathEdgeKeys),
    [effectiveTasks, criticalPathNodeIds, criticalPathEdgeKeys]
  );

  // 6. Compute Selected Node's Upstream and Downstream Sets (Click-to-Select)
  const { upstreamSet, downstreamSet, activeEdgeKeys } = useMemo(() => {
    const upstream = new Set<string>();
    const downstream = new Set<string>();
    const activeEdges = new Set<string>();

    if (!selectedTaskId) {
      return { upstreamSet: upstream, downstreamSet: downstream, activeEdgeKeys: activeEdges };
    }

    // DFS Upstream (Prerequisites)
    const traverseUpstream = (id: string) => {
      const t = taskMap.get(id);
      if (!t) return;
      (t.prerequisiteIds || []).forEach((pId) => {
        activeEdges.add(`${pId}->${id}`);
        if (!upstream.has(pId)) {
          upstream.add(pId);
          traverseUpstream(pId);
        }
      });
    };

    // DFS Downstream (Dependents)
    const traverseDownstream = (id: string) => {
      const deps = dependentsMap.get(id) || [];
      deps.forEach((dId) => {
        activeEdges.add(`${id}->${dId}`);
        if (!downstream.has(dId)) {
          downstream.add(dId);
          traverseDownstream(dId);
        }
      });
    };

    traverseUpstream(selectedTaskId);
    traverseDownstream(selectedTaskId);

    return { upstreamSet: upstream, downstreamSet: downstream, activeEdgeKeys: activeEdges };
  }, [selectedTaskId, taskMap, dependentsMap]);

  // 7. Build All Edges
  interface EdgeData {
    sourceId: string;
    targetId: string;
    sourceTask: Task;
    targetTask: Task;
    sourcePos: { x: number; y: number };
    targetPos: { x: number; y: number };
    pathData: string;
    isCritical: boolean;
    isCycleEdge: boolean;
    edgeImportance: EdgeImportance | undefined;
    isFlowing: boolean; // Source is DONE and target is READY
    isHighlighted: boolean;
  }

  const edges: EdgeData[] = useMemo(() => {
    const list: EdgeData[] = [];

    effectiveTasks.forEach((targetTask) => {
      const targetPos = nodePositions.get(targetTask.id);
      if (!targetPos) return;

      (targetTask.prerequisiteIds || []).forEach((sourceId) => {
        const sourceTask = taskMap.get(sourceId);
        const sourcePos = nodePositions.get(sourceId);
        if (!sourceTask || !sourcePos) return;

        const x1 = sourcePos.x + NODE_WIDTH;
        const y1 = sourcePos.y + NODE_HEIGHT / 2;
        const x2 = targetPos.x;
        const y2 = targetPos.y + NODE_HEIGHT / 2;

        const dx = Math.max(40, (x2 - x1) / 2);
        const pathData = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

        const edgeKey = `${sourceId}->${targetTask.id}`;
        const isCritical = criticalPathEdgeKeys.has(edgeKey);
        const isCycleEdge = dependencyAnalysis.cycleAnalysis.cycleEdgeKeys.has(edgeKey);
        const edgeImportance = dependencyAnalysis.edgeImportance.get(edgeKey);

        // Data flow: source is DONE and target is READY (or in progress)
        const isTargetReady = !targetTask.blocked && targetTask.status !== 'DONE';
        const isFlowing = sourceTask.status === 'DONE' && isTargetReady;

        const isHighlighted =
          selectedTaskId !== null
            ? activeEdgeKeys.has(edgeKey)
            : hoveredTaskId !== null
            ? targetTask.id === hoveredTaskId || sourceId === hoveredTaskId
            : hoveredEdge !== null
            ? hoveredEdge.sourceId === sourceId && hoveredEdge.targetId === targetTask.id
            : false;

        list.push({
          sourceId,
          targetId: targetTask.id,
          sourceTask,
          targetTask,
          sourcePos,
          targetPos,
          pathData,
          isCritical,
          isCycleEdge,
          edgeImportance,
          isFlowing,
          isHighlighted,
        });
      });
    });

    return list;
  }, [
    effectiveTasks,
    taskMap,
    nodePositions,
    criticalPathEdgeKeys,
    dependencyAnalysis,
    selectedTaskId,
    activeEdgeKeys,
    hoveredTaskId,
    hoveredEdge,
  ]);

  // Color Coding Helper: Green (Done) -> Yellow (Ready) -> Red (Blocked)
  const getNodeColorConfig = (task: Task) => {
    if (task.status === 'DONE') {
      return {
        bg: 'bg-[#F0FDF4] dark:bg-dark-card',
        border: 'border-[#22C55E] dark:border-slate-700',
        badgeBg: 'bg-[#DCFCE7] dark:bg-slate-800',
        badgeText: 'text-[#15803D] dark:text-slate-300',
        badgeBorder: 'border-[#86EFAC] dark:border-slate-700',
        label: 'Done',
        dotColor: '#16A34A',
      };
    }
    if (task.blocked) {
      return {
        bg: 'bg-[#FEF2F2] dark:bg-red-950/30',
        border: 'border-[#EF4444] dark:neon-glow-red',
        badgeBg: 'bg-[#FEE2E2] dark:bg-red-900/40',
        badgeText: 'text-[#B91C1C] dark:text-red-300',
        badgeBorder: 'border-[#FCA5A5] dark:border-red-700/60',
        label: 'Blocked',
        dotColor: '#EF4444',
      };
    }
    // Ready (not blocked and not done)
    return {
      bg: 'bg-[#FEFCE8] dark:bg-emerald-950/20',
      border: 'border-[#EAB308] dark:neon-glow-green',
      badgeBg: 'bg-[#FEF9C3] dark:bg-emerald-900/40',
      badgeText: 'text-[#A16207] dark:text-emerald-300',
      badgeBorder: 'border-[#FDE047] dark:border-emerald-700/60',
      label: 'Ready',
      dotColor: '#10B981',
    };
  };

  const selectedTask = selectedTaskId ? taskMap.get(selectedTaskId) || null : null;
  const hoveredTask = hoveredTaskId ? taskMap.get(hoveredTaskId) || null : null;

  // Root tasks for tree rendering (tasks with 0 prerequisites)
  const rootTasks = useMemo(() => {
    const list = effectiveTasks.filter((t) => (t.prerequisiteIds || []).length === 0);
    return list.length > 0 ? list : effectiveTasks;
  }, [effectiveTasks]);

  // Generate clean ASCII dependency tree string
  const asciiTreeString = useMemo(() => {
    if (effectiveTasks.length === 0) return 'No tasks available.';

    const lines: string[] = ['TaskFlow Pro — Dependency Tree', '================================'];
    const visited = new Set<string>();

    const traverse = (taskId: string, prefix: string, isLast: boolean) => {
      const task = taskMap.get(taskId);
      if (!task) return;

      const connector = isLast ? '└── ' : '├── ';
      const statusLabel = task.status === 'DONE' ? '[DONE]' : task.blocked ? '[BLOCKED]' : '[READY]';
      const critTag = criticalPathNodeIds.has(task.id) ? ' 🔥 CRITICAL' : '';
      const blockersTag = task.blocked && task.blockedReason ? ` (${task.blockedReason})` : '';

      lines.push(`${prefix}${connector}${statusLabel} ${task.title} (#${task.id.slice(0, 6)})${critTag}${blockersTag}`);

      const dependents = dependentsMap.get(taskId) || [];
      const newPrefix = prefix + (isLast ? '    ' : '│   ');

      dependents.forEach((depId, idx) => {
        const edgeKey = `${taskId}->${depId}`;
        if (!visited.has(edgeKey)) {
          visited.add(edgeKey);
          traverse(depId, newPrefix, idx === dependents.length - 1);
        }
      });
    };

    rootTasks.forEach((root, idx) => {
      traverse(root.id, '', idx === rootTasks.length - 1);
    });

    return lines.join('\n');
  }, [effectiveTasks, taskMap, dependentsMap, criticalPathNodeIds, rootTasks]);

  const handleCopyAscii = async () => {
    try {
      await navigator.clipboard.writeText(asciiTreeString);
      setCopiedAscii(true);
      setTimeout(() => setCopiedAscii(false), 2000);
    } catch {
      // fallback
    }
  };

  // Recursive tree node renderer for simplified text-based view
  const renderTreeNode = (taskId: string, depth: number = 0, chainPath: string = ''): React.ReactNode => {
    const task = taskMap.get(taskId);
    if (!task) return null;
    const currentPath = `${chainPath}->${taskId}`;

    if (chainPath.includes(taskId)) {
      return (
        <div key={currentPath} className="text-[10px] text-badge-blocked dark:text-red-400 font-mono italic pl-4">
          ⚠️ Cyclic loop detected: {task.title}
        </div>
      );
    }

    const isDone = task.status === 'DONE';
    const isBlocked = task.blocked;
    const isCrit = criticalPathNodeIds.has(task.id);
    const isCycle = dependencyAnalysis.cycleAnalysis.cycleNodeIds.has(task.id);
    const isKeystone = dependencyAnalysis.criticalBlockerIds.has(task.id);
    const isLeaf = dependencyAnalysis.orphanedTaskIds.has(task.id);
    const score = dependencyAnalysis.scores.get(task.id);
    const dependents = dependentsMap.get(taskId) || [];
    const isCollapsed = collapsedTreeNodes.has(taskId);

    return (
      <div key={currentPath} className="relative group text-xs font-mono">
        <div className={`flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white dark:bg-dark-card border shadow-2xs transition-colors ${
          isCycle
            ? 'border-red-500 ring-2 ring-red-400/50 bg-red-50/20'
            : 'border-warmgray-border dark:border-dark-border hover:border-terracotta dark:hover:border-neon-orange'
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            {dependents.length > 0 ? (
              <button
                type="button"
                onClick={() => toggleCollapseTreeNode(taskId)}
                className="p-1 rounded hover:bg-cream-200 dark:hover:bg-dark-surface text-ink-500 dark:text-slate-400 shrink-0"
                title={isCollapsed ? 'Expand dependents' : 'Collapse dependents'}
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
              </button>
            ) : (
              <span className="w-5 text-center text-ink-300 dark:text-slate-600 font-mono text-xs">•</span>
            )}

            {isDone ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : isBlocked ? (
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            ) : (
              <Clock className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-ink-900 dark:text-slate-100 truncate">
                  {task.title}
                </span>
                <span className="text-[10px] text-ink-400 dark:text-slate-500">
                  #{task.id.slice(0, 6)}
                </span>
                {isCrit && (
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-terracotta dark:bg-neon-orange text-white font-bold flex items-center gap-0.5">
                    <Flame className="w-2.5 h-2.5" /> CP
                  </span>
                )}
                {isCycle && (
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-red-600 text-white font-bold animate-pulse flex items-center gap-0.5" title="Cycle Loop">
                    <RotateCcw className="w-2.5 h-2.5" /> Loop
                  </span>
                )}
                {isKeystone && task.status !== 'DONE' && (
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-purple-100 dark:bg-purple-950 text-purple-900 dark:text-purple-200 border border-purple-300 dark:border-purple-800 font-bold flex items-center gap-0.5" title={`Keystone Blocker: Unblocks ${score?.directDependentsCount || 2} tasks`}>
                    <Zap className="w-2.5 h-2.5 text-purple-600 fill-current" /> Keystone
                  </span>
                )}
                {isLeaf && task.status !== 'DONE' && (
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 font-medium" title="Leaf task: 0 dependents">
                    🍃 Leaf
                  </span>
                )}
                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-cream-200 dark:bg-dark-surface text-ink-600 dark:text-slate-400 border border-warmgray-border dark:border-dark-border" title="Dependency Importance Score">
                  Score: {score?.score || 10}
                </span>
              </div>

              {isBlocked && task.blockedReason && (
                <p className="text-[10px] text-badge-blocked dark:text-red-300 font-mono truncate mt-0.5">
                  ⛔ {task.blockedReason}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-medium ${
              isDone
                ? 'bg-[#DCFCE7] dark:bg-emerald-950/40 text-[#15803D] dark:text-emerald-300 border-[#86EFAC] dark:border-emerald-700/60'
                : isBlocked
                ? 'bg-[#FEE2E2] dark:bg-red-950/40 text-[#B91C1C] dark:text-red-300 border-[#FCA5A5] dark:border-red-800/60'
                : 'bg-[#FEF9C3] dark:bg-amber-950/40 text-[#A16207] dark:text-amber-300 border-[#FDE047] dark:border-amber-700/60'
            }`}>
              {isDone ? 'Done' : isBlocked ? 'Blocked' : 'Ready'}
            </span>

            <button
              type="button"
              onClick={() => onTaskClick(task)}
              className="p-1 rounded text-ink-400 hover:text-terracotta dark:hover:text-neon-orange transition-colors"
              title="Open task details"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {!isCollapsed && dependents.length > 0 && (
          <div className="ml-5 pl-3 border-l-2 border-warmgray-border/80 dark:border-dark-border mt-2 space-y-2">
            {dependents.map((depId) => renderTreeNode(depId, depth + 1, currentPath))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-cream-100/70 dark:bg-dark-surface/90 rounded-xl border border-warmgray-border dark:border-dark-border p-6 shadow-subtle flex flex-col transition-colors duration-300">
      {/* View Header with Controls & Legend */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-4 border-b border-warmgray-border dark:border-dark-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Network className="w-5 h-5 text-terracotta dark:text-neon-orange" />
            <h3 className="font-display text-2xl font-medium text-ink-900 dark:text-slate-100 tracking-tight">
              Topological Dependency Graph
            </h3>
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-cream-200 dark:bg-dark-card border border-warmgray-border dark:border-dark-border text-ink-700 dark:text-slate-300">
              {effectiveTasks.length} Nodes • {edges.length} Edges
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap text-xs text-ink-500 dark:text-slate-400 font-mono">
            {dependencyAnalysis.cycleAnalysis.hasCycle ? (
              <span className="px-2 py-0.5 rounded bg-red-100 dark:bg-red-950/70 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 font-bold flex items-center gap-1 animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                <span>Cyclic Deadlock: {dependencyAnalysis.cycleAnalysis.cyclePaths.length} Loop(s)</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Cycle Defense: Validated (0 Loops)</span>
              </span>
            )}
            <span className="text-ink-400 dark:text-slate-500">
              • {dependencyAnalysis.criticalBlockerIds.size} Keystones • {dependencyAnalysis.orphanedTaskIds.size} Leaves
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* View Mode Segmented Control: Graph Canvas vs Simplified Text Tree */}
          <div className="flex items-center bg-cream-200 dark:bg-dark-surface rounded-lg p-0.5 border border-warmgray-border dark:border-dark-border">
            <button
              type="button"
              onClick={() => setViewMode('graph')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                viewMode === 'graph'
                  ? 'bg-white dark:bg-dark-card text-ink-900 dark:text-slate-100 shadow-2xs font-semibold'
                  : 'text-ink-600 dark:text-slate-400 hover:text-ink-900 dark:hover:text-slate-200'
              }`}
            >
              <Network className="w-3.5 h-3.5 text-terracotta dark:text-neon-orange" />
              <span>Interactive Graph</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('tree')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                viewMode === 'tree'
                  ? 'bg-white dark:bg-dark-card text-ink-900 dark:text-slate-100 shadow-2xs font-semibold'
                  : 'text-ink-600 dark:text-slate-400 hover:text-ink-900 dark:hover:text-slate-200'
              }`}
            >
              <FolderTree className="w-3.5 h-3.5 text-terracotta dark:text-neon-orange" />
              <span>Text-Based Tree</span>
            </button>
          </div>

          {/* Cycle Defense Simulation Toggle */}
          <div
            onClick={() => setSimulateCycle(!simulateCycle)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-2 border cursor-pointer select-none ${
              simulateCycle
                ? 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800 shadow-2xs'
                : 'bg-white dark:bg-dark-card text-ink-700 dark:text-slate-300 border-warmgray-border dark:border-dark-border hover:bg-cream-200 dark:hover:bg-dark-cardHover'
            }`}
            title="Simulate a circular loop (A → B → C → A) to test cyclic dependency defense, warnings, and highlighting"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${simulateCycle ? 'animate-spin text-red-600 dark:text-red-400' : 'text-ink-400 dark:text-slate-500'}`} />
            <span className="text-[11px] font-medium">{simulateCycle ? 'Loop Sim: ON' : 'Cycle Defense'}</span>
            <ToggleSwitch
              size="sm"
              checked={simulateCycle}
              onChange={setSimulateCycle}
              activeColor="red"
              ariaLabel="Toggle Cycle Defense Simulation"
            />
          </div>

          {/* Critical Path Toggle */}
          <div
            onClick={() => setShowCriticalPath(!showCriticalPath)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 border cursor-pointer select-none ${
              showCriticalPath
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-700/60 shadow-2xs'
                : 'bg-white dark:bg-dark-card text-ink-600 dark:text-slate-400 border-warmgray-border dark:border-dark-border hover:bg-cream-200 dark:hover:bg-dark-cardHover'
            }`}
            title="Highlight the longest prerequisite chain that determines project completion"
          >
            <Flame className={`w-3.5 h-3.5 ${showCriticalPath ? 'text-amber-500 animate-pulse' : 'text-ink-400 dark:text-slate-500'}`} />
            <span className="text-[11px] font-mono">Critical Path ({criticalPathNodeIds.size})</span>
            <ToggleSwitch
              size="sm"
              checked={showCriticalPath}
              onChange={setShowCriticalPath}
              activeColor="amber"
              ariaLabel="Toggle Critical Path"
            />
          </div>

          {/* Data Flow Pulse Toggle */}
          <div
            onClick={() => setShowPulses(!showPulses)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 border cursor-pointer select-none ${
              showPulses
                ? 'bg-terracotta-light dark:bg-orange-950/40 text-terracotta dark:text-neon-orange border-terracotta-border dark:border-orange-700/60 shadow-2xs'
                : 'bg-white dark:bg-dark-card text-ink-600 dark:text-slate-400 border-warmgray-border dark:border-dark-border hover:bg-cream-200 dark:hover:bg-dark-cardHover'
            }`}
            title="Toggle animated data flow pulses traveling from Done to Ready tasks"
          >
            <Zap className={`w-3.5 h-3.5 ${showPulses ? 'text-terracotta dark:text-neon-orange animate-bounce' : 'text-ink-400 dark:text-slate-500'}`} />
            <span className="text-[11px] font-mono">Flow Pulses</span>
            <ToggleSwitch
              size="sm"
              checked={showPulses}
              onChange={setShowPulses}
              activeColor="terracotta"
              ariaLabel="Toggle Flow Pulses"
            />
          </div>

          {/* Zoom controls */}
          <div className="flex items-center bg-white border border-warmgray-border rounded-lg p-0.5 shadow-2xs">
            <button
              onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.15))}
              className="p-1.5 text-ink-600 hover:text-ink-900 hover:bg-cream-200 rounded"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono px-2 text-ink-600">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(1.5, z + 0.15))}
              className="p-1.5 text-ink-600 hover:text-ink-900 hover:bg-cream-200 rounded"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel(1)}
              className="p-1.5 text-ink-600 hover:text-ink-900 hover:bg-cream-200 rounded border-l border-warmgray-border/60 ml-0.5"
              title="Reset Zoom"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Reset selection if any */}
          {selectedTaskId && (
            <button
              onClick={() => setSelectedTaskId(null)}
              className="px-2.5 py-1.5 bg-cream-200 hover:bg-cream-300 text-ink-700 rounded-lg text-xs font-mono transition-colors"
            >
              Clear Selection ✕
            </button>
          )}
        </div>
      </div>

      {/* High-Visibility Cyclic Dependency Warning Alert Banner */}
      {dependencyAnalysis.cycleAnalysis.hasCycle && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-950/60 border-2 border-red-500 dark:border-red-600 text-red-900 dark:text-red-200 shadow-md animate-pulse">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <div className="font-bold uppercase tracking-wider text-red-700 dark:text-red-300 mb-1 flex items-center gap-2">
                <span>⚠️ Cyclic Dependency Deadlock Detected</span>
                <span className="px-2 py-0.5 rounded bg-red-200 dark:bg-red-900 text-red-800 dark:text-red-100 text-[10px] font-mono">
                  {dependencyAnalysis.cycleAnalysis.cyclePaths.length} Circular Loop(s)
                </span>
              </div>
              <p className="font-mono text-red-800 dark:text-red-200 leading-relaxed font-semibold">
                {dependencyAnalysis.cycleAnalysis.cycleWarning}
              </p>
              <p className="text-[11px] text-red-600 dark:text-red-400 mt-1 font-mono">
                Circular loops break DAG topological sorting and cause execution deadlocks where tasks wait on each other infinitely.
              </p>
              {simulateCycle && (
                <button
                  type="button"
                  onClick={() => setSimulateCycle(false)}
                  className="mt-2.5 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-mono font-semibold transition-colors shadow-2xs"
                >
                  Turn Off Simulation (Restore Clean DAG)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Legend Bar: Status & Edge Thickness = Importance */}
      <div className="flex flex-col gap-2 mb-4 p-3 bg-white/80 dark:bg-dark-card/80 border border-warmgray-border/80 dark:border-dark-border rounded-lg text-xs font-mono">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-ink-400 dark:text-slate-500 font-semibold uppercase text-[10px]">
              Status Legend:
            </span>
            <span className="inline-flex items-center gap-1.5 text-[#15803D] dark:text-emerald-400">
              <span className="w-3 h-3 rounded-full bg-[#DCFCE7] border border-[#22C55E]" />
              Green: Done
            </span>
            <span className="inline-flex items-center gap-1.5 text-[#A16207] dark:text-amber-400">
              <span className="w-3 h-3 rounded-full bg-[#FEF9C3] border border-[#EAB308]" />
              Yellow: Ready
            </span>
            <span className="inline-flex items-center gap-1.5 text-[#B91C1C] dark:text-red-400">
              <span className="w-3 h-3 rounded-full bg-[#FEE2E2] border border-[#EF4444]" />
              Red: Blocked
            </span>
          </div>

          <div className="text-[11px] text-ink-400 dark:text-slate-500">
            Click any task node to highlight its full dependency chain
          </div>
        </div>

        {/* Edge Thickness = Importance Legend */}
        <div className="flex items-center gap-4 flex-wrap pt-2 border-t border-warmgray-border/50 dark:border-dark-border text-xs">
          <span className="text-ink-400 dark:text-slate-500 font-semibold uppercase text-[10px]">
            Edge Thickness = Importance:
          </span>
          <span className="inline-flex items-center gap-1.5 text-terracotta dark:text-neon-orange" title="Critical path edge (determines project completion deadline)">
            <span className="w-5 h-1 rounded bg-[#EA580C] inline-block" />
            4.5px Critical Path
          </span>
          <span className="inline-flex items-center gap-1.5 text-purple-700 dark:text-purple-300" title="Keystone dependency (source task dependency score >= 70)">
            <span className="w-5 h-1 rounded bg-[#9333EA] inline-block" />
            3.8px Keystone Blocker
          </span>
          <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-300" title="High impact dependency (source task dependency score >= 40)">
            <span className="w-5 h-0.75 rounded bg-[#D97748] inline-block" />
            2.8px High Impact
          </span>
          <span className="inline-flex items-center gap-1.5 text-ink-500 dark:text-slate-400" title="Standard dependency">
            <span className="w-5 h-0.5 rounded bg-[#D5CEC4] inline-block" />
            1.8px Standard
          </span>
          <span className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-400" title="Circular reference edge (causes deadlock)">
            <span className="w-5 h-1 border-t-2 border-dashed border-red-500 inline-block" />
            4.5px Cycle Loop
          </span>
          <span className="inline-flex items-center gap-1.5 text-ink-600 dark:text-slate-300">
            <span className="w-4 h-1 border-t-2 border-dashed border-emerald-500 inline-block animate-pulse" />
            Active Flow
          </span>
        </div>
      </div>

      {/* Main Interactive Diagram Canvas Area */}
      {viewMode === 'tree' ? (
        <div className="bg-white dark:bg-dark-card border border-warmgray-border dark:border-dark-border rounded-xl p-4 sm:p-6 shadow-inner flex flex-col min-h-[500px]">
          {/* Tree sub-toolbar */}
          <div className="flex items-center justify-between gap-3 pb-3 mb-4 border-b border-warmgray-border dark:border-dark-border flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold text-ink-700 dark:text-slate-300">
                {rootTasks.length} Root Pipelines • {tasks.length} Total Nodes
              </span>
              <span className="text-[11px] text-ink-400 dark:text-slate-500 font-mono hidden sm:inline">
                (Prerequisite hierarchy)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAsciiRaw(!showAsciiRaw)}
                className={`px-2.5 py-1 text-xs font-mono rounded-lg border transition-colors flex items-center gap-1.5 ${
                  showAsciiRaw
                    ? 'bg-cream-200 dark:bg-dark-surface border-terracotta dark:border-neon-orange text-terracotta dark:text-neon-orange font-semibold'
                    : 'bg-white dark:bg-dark-surface border-warmgray-border dark:border-dark-border text-ink-600 dark:text-slate-300 hover:bg-cream-100'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>{showAsciiRaw ? 'Interactive Tree' : 'Raw ASCII'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyAscii}
                className="px-2.5 py-1 text-xs font-mono rounded-lg border border-warmgray-border dark:border-dark-border bg-white dark:bg-dark-surface text-ink-700 dark:text-slate-300 hover:bg-cream-100 dark:hover:bg-dark-cardHover transition-colors flex items-center gap-1.5 shadow-2xs"
                title="Copy ASCII Dependency Tree to clipboard"
              >
                {copiedAscii ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-ink-500 dark:text-slate-400" />
                    <span>Copy ASCII</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Tree Content: Raw ASCII or Interactive Hierarchical Nodes */}
          {showAsciiRaw ? (
            <div className="relative">
              <pre className="p-4 bg-cream-50 dark:bg-dark-surface font-mono text-xs text-ink-800 dark:text-slate-200 overflow-x-auto rounded-lg border border-warmgray-border dark:border-dark-border whitespace-pre leading-relaxed select-text">
                {asciiTreeString}
              </pre>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[600px] pr-1">
              {rootTasks.map((root) => renderTreeNode(root.id, 0, ''))}
            </div>
          )}
        </div>
      ) : (
        <div
          ref={containerRef}
          onClick={() => {
            // Click background to deselect
            setSelectedTaskId(null);
          }}
          className="relative w-full h-[620px] overflow-auto bg-[#FAF7F2] dark:bg-dark-surface/80 border border-warmgray-border dark:border-dark-border rounded-xl shadow-inner cursor-grab active:cursor-grabbing select-none"
        >
        <div
          style={{
            width: `${svgWidth * zoomLevel}px`,
            height: `${svgHeight * zoomLevel}px`,
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'top left',
            transition: 'transform 0.1s ease-out',
          }}
          className="relative"
        >
          {/* SVG Connector & Animation Layer */}
          <svg
            width={svgWidth}
            height={svgHeight}
            className="absolute inset-0 pointer-events-none overflow-visible"
          >
            <defs>
              {/* Arrow markers */}
              <marker
                id="arrow-default"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 9 5 L 0 9 z" fill="#B0A89C" />
              </marker>

              <marker
                id="arrow-critical"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="8"
                markerHeight="8"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 9 5 L 0 9 z" fill="#EA580C" />
              </marker>

              <marker
                id="arrow-active"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 9 5 L 0 9 z" fill="#D97748" />
              </marker>

              <marker
                id="arrow-upstream"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 9 5 L 0 9 z" fill="#3B82F6" />
              </marker>

              {/* Arrow cycle (red) */}
              <marker
                id="arrow-cycle"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="8"
                markerHeight="8"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 9 5 L 0 9 z" fill="#EF4444" />
              </marker>

              {/* Arrow keystone (purple) */}
              <marker
                id="arrow-keystone"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 9 5 L 0 9 z" fill="#9333EA" />
              </marker>
            </defs>

            {/* Render Directed Edges with Adaptive Stroke Thickness based on Importance */}
            {edges.map((edge) => {
              const edgeKey = `${edge.sourceId}->${edge.targetId}`;
              const isSelectedChain = activeEdgeKeys.has(edgeKey);
              const isCriticalEdge = showCriticalPath && edge.isCritical;
              const isCycleEdge = edge.isCycleEdge;
              const importance = edge.edgeImportance;
              const isDimmed =
                selectedTaskId !== null
                  ? !isSelectedChain
                  : hoveredTaskId !== null
                  ? edge.sourceId !== hoveredTaskId && edge.targetId !== hoveredTaskId
                  : false;

              let strokeColor = '#D5CEC4';
              let strokeWidth = importance?.strokeWidth || 1.8;
              let strokeDasharray: string | undefined = undefined;
              let markerEnd = 'url(#arrow-default)';

              if (isCycleEdge) {
                strokeColor = '#EF4444';
                strokeWidth = 4.5;
                strokeDasharray = '6 3';
                markerEnd = 'url(#arrow-cycle)';
              } else if (isCriticalEdge) {
                strokeColor = '#EA580C';
                strokeWidth = 4.5;
                markerEnd = 'url(#arrow-critical)';
              } else if (isSelectedChain) {
                strokeColor = '#3B82F6';
                strokeWidth = 3.5;
                markerEnd = 'url(#arrow-upstream)';
              } else if (importance && importance.weight >= 70) {
                strokeColor = '#9333EA';
                strokeWidth = 3.8;
                markerEnd = 'url(#arrow-keystone)';
              } else if (edge.isHighlighted || (importance && importance.weight >= 40)) {
                strokeColor = '#D97748';
                strokeWidth = 2.8;
                markerEnd = 'url(#arrow-active)';
              }

              return (
                <g
                  key={edgeKey}
                  className="transition-opacity duration-200 pointer-events-auto cursor-pointer"
                  onMouseEnter={() => setHoveredEdge({ sourceId: edge.sourceId, targetId: edge.targetId })}
                  onMouseLeave={() => setHoveredEdge(null)}
                >
                  {/* Invisible wider hit area for easy hover */}
                  <path
                    d={edge.pathData}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={18}
                    strokeLinecap="round"
                  />

                  {/* Base edge curve with adaptive thickness */}
                  <path
                    d={edge.pathData}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDasharray}
                    strokeLinecap="round"
                    markerEnd={markerEnd}
                    opacity={isDimmed ? 0.15 : 1}
                    className={isCriticalEdge ? 'animate-critical-glow' : isCycleEdge ? 'animate-pulse' : ''}
                  />

                  {/* Animated data flow pulse (Done -> Ready) */}
                  {showPulses && edge.isFlowing && !isDimmed && !isCycleEdge && (
                    <path
                      d={edge.pathData}
                      fill="none"
                      stroke="#22C55E"
                      strokeWidth={3}
                      strokeLinecap="round"
                      className="animate-data-flow"
                      opacity={0.85}
                    />
                  )}

                  {/* Traveling particle along data flow path */}
                  {showPulses && edge.isFlowing && !isDimmed && !isCycleEdge && (
                    <circle r="3.5" fill="#16A34A">
                      <animateMotion
                        dur="2.2s"
                        repeatCount="indefinite"
                        path={edge.pathData}
                      />
                    </circle>
                  )}
                </g>
              );
            })}
          </svg>

          {/* DOM Interactive Task Nodes Layer */}
          {effectiveTasks.map((task) => {
            const pos = nodePositions.get(task.id);
            if (!pos) return null;

            const isSelected = selectedTaskId === task.id;
            const isUpstream = upstreamSet.has(task.id);
            const isDownstream = downstreamSet.has(task.id);
            const isCritical = showCriticalPath && criticalPathNodeIds.has(task.id);
            const isHovered = hoveredTaskId === task.id;

            const score = dependencyAnalysis.scores.get(task.id);
            const isCycleMember = dependencyAnalysis.cycleAnalysis.cycleNodeIds.has(task.id);
            const isKeystone = dependencyAnalysis.criticalBlockerIds.has(task.id);
            const isOrphan = dependencyAnalysis.orphanedTaskIds.has(task.id);

            const isDimmed =
              selectedTaskId !== null
                ? !isSelected && !isUpstream && !isDownstream
                : hoveredTaskId !== null
                ? !isHovered &&
                  !(task.prerequisiteIds || []).includes(hoveredTaskId) &&
                  !(dependentsMap.get(hoveredTaskId) || []).includes(task.id)
                : false;

            const colorConfig = getNodeColorConfig(task);

            return (
              <div
                key={task.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedTaskId(task.id === selectedTaskId ? null : task.id);
                }}
                onMouseEnter={() => setHoveredTaskId(task.id)}
                onMouseLeave={() => setHoveredTaskId(null)}
                style={{
                  left: `${pos.x}px`,
                  top: `${pos.y}px`,
                  width: `${NODE_WIDTH}px`,
                  height: `${NODE_HEIGHT}px`,
                }}
                className={`absolute rounded-xl border-2 p-2.5 transition-all cursor-pointer flex flex-col justify-between shadow-subtle ${
                  colorConfig.bg
                } ${colorConfig.border} ${
                  isDimmed ? 'opacity-25 scale-95' : 'opacity-100 scale-100'
                } ${
                  isCycleMember
                    ? 'ring-4 ring-red-500/80 border-red-600 bg-red-50 dark:bg-red-950/40 animate-pulse z-30 shadow-xl'
                    : isSelected
                    ? 'ring-4 ring-terracotta ring-offset-2 shadow-xl z-30 scale-105'
                    : isHovered
                    ? 'shadow-lg z-20 scale-102'
                    : isKeystone
                    ? 'border-purple-500 shadow-md ring-2 ring-purple-400/60 z-10'
                    : isCritical
                    ? 'border-orange-500 shadow-xl ring-2 ring-orange-400/80 animate-critical-glow z-10'
                    : 'hover:shadow-card'
                }`}
              >
                {/* Node Header: ID, Status Badge & Issue Badges */}
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: isCycleMember ? '#EF4444' : colorConfig.dotColor }}
                    />
                    <span className="text-[10px] font-mono text-ink-500 font-semibold">
                      #{task.id.slice(0, 6)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 flex-wrap">
                    {/* Cycle Member Alert */}
                    {isCycleMember && (
                      <span
                        className="text-[9px] font-mono px-1 py-0.2 rounded bg-red-600 text-white font-bold animate-pulse flex items-center gap-0.5 shadow-2xs"
                        title="Deadlock Loop: Circular dependency detected involving this task!"
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                        <span>Loop</span>
                      </span>
                    )}

                    {/* Critical Path Badge */}
                    {isCritical && !isCycleMember && (
                      <span
                        className="text-[9px] font-mono px-1 py-0.2 rounded bg-terracotta text-white font-semibold flex items-center gap-0.5"
                        title="This task is on critical path - any delay affects deadline"
                      >
                        <Flame className="w-2.5 h-2.5 fill-current" />
                        <span>CP</span>
                      </span>
                    )}

                    {/* Keystone Blocker Badge */}
                    {isKeystone && task.status !== 'DONE' && !isCycleMember && (
                      <span
                        className="text-[9px] font-mono px-1 py-0.2 rounded bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200 border border-purple-300 dark:border-purple-800 font-bold flex items-center gap-0.5 shadow-2xs"
                        title={`Keystone Blocker: Unblocks ${score?.directDependentsCount || 2} downstream activities`}
                      >
                        <Zap className="w-2.5 h-2.5 text-purple-600 fill-current" />
                        <span>Key</span>
                      </span>
                    )}

                    {/* Orphaned Leaf Badge */}
                    {isOrphan && task.status !== 'DONE' && !isKeystone && !isCycleMember && (
                      <span
                        className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 font-medium"
                        title="Orphaned Leaf Task: 0 downstream tasks depend on this. Safe to defer."
                      >
                        🍃
                      </span>
                    )}

                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-semibold uppercase border ${colorConfig.badgeBg} ${colorConfig.badgeText} ${colorConfig.badgeBorder}`}
                    >
                      {colorConfig.label}
                    </span>
                  </div>
                </div>

                {/* Node Title */}
                <h4 className="text-xs font-semibold text-ink-900 dark:text-slate-100 leading-snug line-clamp-2">
                  {task.title}
                </h4>

                {/* Node Footer: Prereqs, Role, Score & Outputs */}
                <div className="flex items-center justify-between text-[10px] font-mono text-ink-500 dark:text-slate-400 pt-1 border-t border-black/5 dark:border-white/5">
                  <span title={`${task.prerequisiteIds?.length || 0} inputs`}>
                    ← {task.prerequisiteIds?.length || 0}
                  </span>

                  {/* Chain role if selected, or Dependency Score */}
                  {isSelected ? (
                    <span className="text-terracotta dark:text-neon-orange font-semibold font-sans text-[10px]">
                      Selected
                    </span>
                  ) : isUpstream ? (
                    <span className="text-blue-600 font-semibold font-sans text-[10px]">
                      ▲ Prereq
                    </span>
                  ) : isDownstream ? (
                    <span className="text-amber-700 font-semibold font-sans text-[10px]">
                      ▼ Dependent
                    </span>
                  ) : (
                    <span
                      className={`px-1 py-0.2 rounded font-semibold text-[9px] ${
                        (score?.score || 0) >= 70
                          ? 'bg-purple-100 text-purple-900 border border-purple-200'
                          : (score?.score || 0) >= 40
                          ? 'bg-amber-100 text-amber-900 border border-amber-200'
                          : 'bg-cream-200 text-ink-600'
                      }`}
                      title={`Dependency Score: ${score?.score}/100 (${score?.tierLabel})`}
                    >
                      Scr: {score?.score}
                    </span>
                  )}

                  <span title={`${(dependentsMap.get(task.id) || []).length} outputs`}>
                    {(dependentsMap.get(task.id) || []).length} →
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Hover Inspector Tooltip Floating Panel */}
        {hoveredTask && (
          <div className="fixed bottom-10 left-80 z-40 bg-white/95 dark:bg-dark-card/95 backdrop-blur-sm border border-warmgray-border dark:border-dark-border rounded-xl p-3.5 shadow-xl max-w-sm pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-150 text-ink-900 dark:text-slate-100">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-[10px] font-mono font-semibold text-ink-400 dark:text-slate-500">
                TASK INSPECTOR #{hoveredTask.id}
              </span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold uppercase ${
                  hoveredTask.status === 'DONE'
                    ? 'bg-badge-readyBg text-badge-ready'
                    : hoveredTask.blocked
                    ? 'bg-badge-blockedBg text-badge-blocked'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {hoveredTask.status}
              </span>
            </div>

            <h5 className="text-sm font-semibold text-ink-900 dark:text-slate-100 leading-tight mb-1">
              {hoveredTask.title}
            </h5>

            {/* Dependency Score Breakdown */}
            {(() => {
              const hScore = dependencyAnalysis.scores.get(hoveredTask.id);
              if (!hScore) return null;
              return (
                <div className="my-2 p-2 rounded-lg bg-cream-100 dark:bg-dark-surface border border-warmgray-border dark:border-dark-border text-[11px] font-mono space-y-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-ink-600 dark:text-slate-400">Dependency Score:</span>
                    <span className="text-purple-700 dark:text-purple-300 font-bold">{hScore.score}/100 ({hScore.tierLabel})</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-ink-500 dark:text-slate-400">
                    <span>Unblocks: {hScore.directDependentsCount} direct, {hScore.transitiveDependentsCount} transitive</span>
                    {hScore.isOrphaned ? <span className="text-slate-500 font-medium">🍃 Leaf (0 deps)</span> : null}
                    {hScore.isKeystone ? <span className="text-purple-600 font-bold">⚡ Keystone</span> : null}
                  </div>
                </div>
              );
            })()}

            {/* Blocked, Loop, or Ready Explanation */}
            {dependencyAnalysis.cycleAnalysis.cycleNodeIds.has(hoveredTask.id) ? (
              <div className="mt-1.5 text-xs text-red-600 dark:text-red-400 flex items-start gap-1 font-mono font-bold">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>Deadlock: Trapped in a circular dependency loop!</span>
              </div>
            ) : hoveredTask.blocked ? (
              <div className="mt-1.5 text-xs text-badge-blocked flex items-start gap-1 font-mono">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>Blocked by: {hoveredTask.blockedReason || 'Prerequisites pending'}</span>
              </div>
            ) : hoveredTask.status === 'DONE' ? (
              <div className="mt-1.5 text-xs text-badge-ready flex items-start gap-1 font-mono">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>Completed — downstream prerequisites unlocked</span>
              </div>
            ) : (
              <div className="mt-1.5 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-1 font-mono">
                <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>Ready — all prerequisite conditions satisfied</span>
              </div>
            )}
          </div>
        )}

        {/* Hover Inspector Tooltip for Directed Edges with Importance Breakdown */}
        {hoveredEdge && !hoveredTask && (
          <div className="fixed bottom-10 left-80 z-40 bg-white/95 dark:bg-dark-card/95 backdrop-blur-sm border border-warmgray-border dark:border-dark-border rounded-xl p-3.5 shadow-xl max-w-sm pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-150 text-ink-900 dark:text-slate-100">
            <div className="flex items-center gap-1.5 text-[10px] font-mono font-semibold text-terracotta dark:text-neon-orange mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-terracotta dark:bg-neon-orange" />
              <span>PREREQUISITE RELATIONSHIP</span>
            </div>
            <div className="text-xs font-semibold text-ink-900 dark:text-slate-100 flex items-center gap-2">
              <span className="truncate">{taskMap.get(hoveredEdge.sourceId)?.title}</span>
              <span className="text-terracotta dark:text-neon-orange shrink-0 font-mono">➔</span>
              <span className="truncate">{taskMap.get(hoveredEdge.targetId)?.title}</span>
            </div>

            {/* Edge Importance Metric & Weight */}
            {(() => {
              const eKey = `${hoveredEdge.sourceId}->${hoveredEdge.targetId}`;
              const imp = dependencyAnalysis.edgeImportance.get(eKey);
              const srcScore = dependencyAnalysis.scores.get(hoveredEdge.sourceId);
              return (
                <div className="mt-2 pt-2 border-t border-warmgray-border/60 dark:border-dark-border space-y-1 text-[11px] font-mono">
                  <div className="flex items-center justify-between text-ink-600 dark:text-slate-300">
                    <span>Edge Importance:</span>
                    <span className="font-semibold text-ink-900 dark:text-slate-100">
                      {imp?.label || 'Standard'} ({imp?.weight || 20}/100)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-ink-600 dark:text-slate-300">
                    <span>Stroke Thickness:</span>
                    <span className="font-semibold text-ink-900 dark:text-slate-100">{imp?.strokeWidth || 1.8}px</span>
                  </div>
                  {srcScore && (
                    <div className="flex items-center justify-between text-ink-600 dark:text-slate-300">
                      <span>Source Dependency Score:</span>
                      <span className="font-semibold text-purple-700 dark:text-purple-300">{srcScore.score}/100</span>
                    </div>
                  )}
                </div>
              );
            })()}

            <p className="text-[11px] text-ink-600 dark:text-slate-400 font-mono mt-2">
              {taskMap.get(hoveredEdge.sourceId)?.status === 'DONE'
                ? '✓ Completed prerequisite — unlocks downstream task'
                : '⛔ Active blocker — must finish before target task can start'}
            </p>
          </div>
        )}
      </div>
      )}

      {/* Selected Task Inspector Drawer / Footer Details */}
      {selectedTask && (
        <div className="mt-4 p-4 rounded-xl bg-white dark:bg-dark-card border border-warmgray-border dark:border-dark-border shadow-subtle flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in duration-200 text-ink-900 dark:text-slate-100">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-mono font-semibold text-terracotta bg-terracotta-light border border-terracotta-border px-2 py-0.5 rounded">
                Selected Node
              </span>
              <span className="text-xs text-ink-400 dark:text-slate-500 font-mono">#{selectedTask.id}</span>
              <span className="text-ink-300">•</span>
              <span className="text-xs font-medium text-ink-700 dark:text-slate-300">
                {upstreamSet.size} Upstream Prerequisites, {downstreamSet.size} Downstream Dependents
              </span>
              {(() => {
                const s = dependencyAnalysis.scores.get(selectedTask.id);
                if (!s) return null;
                return (
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-300">
                    Dependency Score: {s.score}/100 ({s.tierLabel})
                  </span>
                );
              })()}
            </div>

            <h4 className="text-base font-semibold text-ink-900 dark:text-slate-100 font-display">
              {selectedTask.title}
            </h4>

            {selectedTask.blocked && (
              <p className="text-xs text-badge-blocked font-mono mt-1">
                ⛔ Blocked Reason: {selectedTask.blockedReason}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onTaskClick(selectedTask)}
              className="px-3.5 py-2 bg-terracotta hover:bg-terracotta-hover text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <span>Manage Dependencies & AI</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setSelectedTaskId(null)}
              className="px-3 py-2 border border-warmgray-border dark:border-dark-border hover:bg-cream-200 dark:hover:bg-dark-cardHover text-ink-600 dark:text-slate-300 text-xs rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
