import { Task } from '../types';

export interface DependencyScore {
  score: number; // 0 to 100
  tier: 'Keystone' | 'High' | 'Moderate' | 'Leaf';
  tierLabel: string;
  directDependentsCount: number;
  transitiveDependentsCount: number;
  unblocksPendingCount: number;
  isKeystone: boolean;
  isOrphaned: boolean;
}

export interface CycleAnalysis {
  hasCycle: boolean;
  cycleNodeIds: Set<string>;
  cycleEdgeKeys: Set<string>;
  cyclePaths: string[][];
  cycleWarning: string | null;
}

export interface EdgeImportance {
  weight: number;
  strokeWidth: number;
  label: string;
}

export interface DependencyAnalysisResult {
  scores: Map<string, DependencyScore>;
  orphanedTaskIds: Set<string>;
  criticalBlockerIds: Set<string>;
  cycleAnalysis: CycleAnalysis;
  edgeImportance: Map<string, EdgeImportance>;
}

/**
 * Checks if adding `newPrereqId` to `taskId` would introduce a circular reference loop.
 */
export function checkCycleOnAdd(
  tasks: Task[],
  taskId: string,
  newPrereqId: string
): { wouldCycle: boolean; path: string[] } {
  if (taskId === newPrereqId) {
    return { wouldCycle: true, path: [taskId, newPrereqId] };
  }

  // Build adjacency: prereq -> task
  const adjacency = new Map<string, string[]>();
  tasks.forEach((t) => {
    (t.prerequisiteIds || []).forEach((pId) => {
      const list = adjacency.get(pId) || [];
      list.push(t.id);
      adjacency.set(pId, list);
    });
  });

  // Hypothesize adding newPrereqId -> taskId
  const list = adjacency.get(newPrereqId) || [];
  list.push(taskId);
  adjacency.set(newPrereqId, list);

  // DFS from taskId to see if we can reach newPrereqId
  const visited = new Set<string>();
  const path: string[] = [];

  const dfs = (curr: string): boolean => {
    visited.add(curr);
    path.push(curr);

    if (curr === newPrereqId) return true;

    const neighbors = adjacency.get(curr) || [];
    for (const n of neighbors) {
      if (!visited.has(n)) {
        if (dfs(n)) return true;
      }
    }

    path.pop();
    return false;
  };

  if (dfs(taskId)) {
    return { wouldCycle: true, path };
  }

  return { wouldCycle: false, path: [] };
}

/**
 * Full topological dependency analysis for TaskFlow Pro:
 * 1. Cycle detection & path tracing (3-color DFS)
 * 2. Dependency score (0-100) per task
 * 3. Orphaned / Leaf tasks detection (0 dependents)
 * 4. Critical blockers / Keystones (unblocks multiple tasks)
 * 5. Edge importance weights for adaptive thickness
 */
export function analyzeDependencies(
  tasks: Task[],
  criticalNodeIds: Set<string> = new Set(),
  criticalEdgeKeys: Set<string> = new Set()
): DependencyAnalysisResult {
  const taskMap = new Map<string, Task>();
  tasks.forEach((t) => taskMap.set(t.id, t));

  const dependentsMap = new Map<string, string[]>();
  tasks.forEach((t) => {
    (t.prerequisiteIds || []).forEach((pId) => {
      const list = dependentsMap.get(pId) || [];
      list.push(t.id);
      dependentsMap.set(pId, list);
    });
  });

  // 1. Cycle Detection (3-color DFS)
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  tasks.forEach((t) => color.set(t.id, WHITE));

  const cycleNodeIds = new Set<string>();
  const cycleEdgeKeys = new Set<string>();
  const cyclePaths: string[][] = [];
  const currentPath: string[] = [];

  const dfsCycle = (u: string) => {
    color.set(u, GRAY);
    currentPath.push(u);

    const neighbors = dependentsMap.get(u) || [];
    for (const v of neighbors) {
      const vColor = color.get(v) || WHITE;
      if (vColor === GRAY) {
        // Cycle found: extract loop from currentPath
        const cycleStartIndex = currentPath.indexOf(v);
        if (cycleStartIndex !== -1) {
          const loop = [...currentPath.slice(cycleStartIndex), v];
          cyclePaths.push(loop);

          for (let i = 0; i < loop.length - 1; i++) {
            cycleNodeIds.add(loop[i]);
            cycleEdgeKeys.add(`${loop[i]}->${loop[i + 1]}`);
          }
        }
      } else if (vColor === WHITE) {
        dfsCycle(v);
      }
    }

    currentPath.pop();
    color.set(u, BLACK);
  };

  tasks.forEach((t) => {
    if ((color.get(t.id) || WHITE) === WHITE) {
      dfsCycle(t.id);
    }
  });

  const hasCycle = cyclePaths.length > 0;
  let cycleWarning: string | null = null;
  if (hasCycle) {
    const firstCycle = cyclePaths[0];
    const titles = firstCycle.map((id) => taskMap.get(id)?.title || id).join(' ➔ ');
    cycleWarning = `Cyclic dependency detected: ${titles}. Circular loops cause deadlocks and must be resolved.`;
  }

  // 2. Transitive Reach & Dependency Scoring
  const scores = new Map<string, DependencyScore>();
  const orphanedTaskIds = new Set<string>();
  const criticalBlockerIds = new Set<string>();

  tasks.forEach((t) => {
    const directDependents = dependentsMap.get(t.id) || [];
    const directCount = directDependents.length;

    // Transitive reach (downstream DFS)
    const reachable = new Set<string>();
    const queue = [...directDependents];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (!reachable.has(curr)) {
        reachable.add(curr);
        const next = dependentsMap.get(curr) || [];
        next.forEach((n) => {
          if (!reachable.has(n)) queue.push(n);
        });
      }
    }
    const transitiveCount = reachable.size;

    // Count how many currently blocked or pending tasks depend on this
    let unblocksPendingCount = 0;
    reachable.forEach((rId) => {
      const target = taskMap.get(rId);
      if (target && (target.blocked || target.status !== 'DONE')) {
        unblocksPendingCount++;
      }
    });

    const isCritical = criticalNodeIds.has(t.id);
    const isOrphaned = directCount === 0;
    const isKeystone = directCount >= 2 || (directCount >= 1 && transitiveCount >= 3);

    if (isOrphaned) {
      orphanedTaskIds.add(t.id);
    }
    if (isKeystone) {
      criticalBlockerIds.add(t.id);
    }

    // Formula: direct reach (30 max) + transitive reach (40 max) + critical bonus (20) + pending unblock bonus (10)
    const directPts = Math.min(30, directCount * 12);
    const transitivePts = Math.min(40, transitiveCount * 10);
    const criticalBonus = isCritical ? 20 : 0;
    const pendingBonus = unblocksPendingCount > 0 ? 10 : 0;

    let score = directPts + transitivePts + criticalBonus + pendingBonus;
    score = Math.max(5, Math.min(100, score));

    // Determine Tier
    let tier: 'Keystone' | 'High' | 'Moderate' | 'Leaf' = 'Moderate';
    let tierLabel = 'Moderate Impact';

    if (score >= 70 || isKeystone) {
      tier = 'Keystone';
      tierLabel = 'Keystone Blocker';
    } else if (score >= 40) {
      tier = 'High';
      tierLabel = 'High Impact';
    } else if (isOrphaned) {
      tier = 'Leaf';
      tierLabel = 'Leaf Task';
    }

    scores.set(t.id, {
      score,
      tier,
      tierLabel,
      directDependentsCount: directCount,
      transitiveDependentsCount: transitiveCount,
      unblocksPendingCount,
      isKeystone,
      isOrphaned,
    });
  });

  // 3. Edge Importance & Adaptive Stroke Thickness
  const edgeImportance = new Map<string, EdgeImportance>();

  tasks.forEach((targetTask) => {
    (targetTask.prerequisiteIds || []).forEach((sourceId) => {
      const edgeKey = `${sourceId}->${targetTask.id}`;
      const isCritical = criticalEdgeKeys.has(edgeKey);
      const isCycleEdge = cycleEdgeKeys.has(edgeKey);
      const sourceScore = scores.get(sourceId)?.score || 20;

      if (isCycleEdge) {
        edgeImportance.set(edgeKey, {
          weight: 100,
          strokeWidth: 4.5,
          label: 'Circular Loop',
        });
      } else if (isCritical) {
        edgeImportance.set(edgeKey, {
          weight: 90,
          strokeWidth: 4.5,
          label: 'Critical Path',
        });
      } else if (sourceScore >= 70) {
        edgeImportance.set(edgeKey, {
          weight: 75,
          strokeWidth: 3.8,
          label: 'Keystone Dependency',
        });
      } else if (sourceScore >= 40) {
        edgeImportance.set(edgeKey, {
          weight: 50,
          strokeWidth: 2.8,
          label: 'High Impact',
        });
      } else {
        edgeImportance.set(edgeKey, {
          weight: 20,
          strokeWidth: 1.8,
          label: 'Standard',
        });
      }
    });
  });

  return {
    scores,
    orphanedTaskIds,
    criticalBlockerIds,
    cycleAnalysis: {
      hasCycle,
      cycleNodeIds,
      cycleEdgeKeys,
      cyclePaths,
      cycleWarning,
    },
    edgeImportance,
  };
}
