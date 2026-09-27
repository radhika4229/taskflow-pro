import { Task } from '../types';

export interface CriticalPathResult {
  criticalPathNodeIds: Set<string>;
  criticalPathEdgeKeys: Set<string>;
  orderedChain: Task[];
  chainText: string;
  shortChainText: string;
  totalDays: number;
  isBlocked: boolean;
  blockedTasksOnPath: Task[];
  criticalWarning: string | null;
}

/**
 * Calculates the Critical Path (longest prerequisite chain by duration/depth)
 * using the Critical Path Method (CPM) forward and backward passes.
 */
export function calculateCriticalPath(tasks: Task[]): CriticalPathResult {
  const nodeIds = new Set<string>();
  const edgeKeys = new Set<string>();

  if (!tasks || tasks.length === 0) {
    return {
      criticalPathNodeIds: nodeIds,
      criticalPathEdgeKeys: edgeKeys,
      orderedChain: [],
      chainText: 'None',
      shortChainText: 'None',
      totalDays: 0,
      isBlocked: false,
      blockedTasksOnPath: [],
      criticalWarning: null,
    };
  }

  const taskMap = new Map<string, Task>();
  tasks.forEach((t) => taskMap.set(t.id, t));

  // 1. Calculate duration for each task in days
  const durations = new Map<string, number>();
  tasks.forEach((t) => {
    if (t.startDate && t.endDate) {
      const diff =
        (new Date(t.endDate).getTime() - new Date(t.startDate).getTime()) /
        (1000 * 60 * 60 * 24);
      durations.set(t.id, Math.max(1, Math.round(diff) + 1));
    } else {
      durations.set(t.id, 2); // Default 2 days estimate
    }
  });

  // 2. Compute Topological Ranks (depth) to ensure topological ordering
  const ranks = new Map<string, number>();
  tasks.forEach((t) => ranks.set(t.id, 0));

  for (let iter = 0; iter < tasks.length; iter++) {
    let changed = false;
    tasks.forEach((t) => {
      const myRank = ranks.get(t.id) || 0;
      (t.prerequisiteIds || []).forEach((pId) => {
        const pRank = ranks.get(pId) || 0;
        if (myRank <= pRank) {
          ranks.set(t.id, pRank + 1);
          changed = true;
        }
      });
    });
    if (!changed) break;
  }

  const sortedTasks = [...tasks].sort(
    (a, b) => (ranks.get(a.id) || 0) - (ranks.get(b.id) || 0)
  );

  // 3. Forward Pass: Calculate Early Start (ES) and Early Finish (EF)
  const es = new Map<string, number>();
  const ef = new Map<string, number>();

  sortedTasks.forEach((t) => {
    const prereqs = t.prerequisiteIds || [];
    let maxPrereqEf = 0;
    prereqs.forEach((pId) => {
      const pEf = ef.get(pId) || 0;
      if (pEf > maxPrereqEf) maxPrereqEf = pEf;
    });
    es.set(t.id, maxPrereqEf);
    const dur = durations.get(t.id) || 2;
    ef.set(t.id, maxPrereqEf + dur);
  });

  // 4. Find the terminal task with the maximum Early Finish (EF)
  let maxEfNodeId = sortedTasks[0]?.id;
  let maxEfVal = 0;
  sortedTasks.forEach((t) => {
    const val = ef.get(t.id) || 0;
    if (val > maxEfVal) {
      maxEfVal = val;
      maxEfNodeId = t.id;
    }
  });

  // 5. Backtrack from terminal task along the critical chain
  const reversedChain: Task[] = [];
  let currId: string | undefined = maxEfNodeId;
  const visitedBacktrack = new Set<string>();

  while (currId && !visitedBacktrack.has(currId)) {
    visitedBacktrack.add(currId);
    nodeIds.add(currId);

    const currTask = taskMap.get(currId);
    if (currTask) {
      reversedChain.push(currTask);
    }

    const prereqs = currTask?.prerequisiteIds || [];
    if (prereqs.length === 0) break;

    const currEs = es.get(currId) || 0;
    // Look for predecessor where ef === currEs
    let bestPred: string | undefined;
    for (const pId of prereqs) {
      if ((ef.get(pId) || 0) === currEs) {
        bestPred = pId;
        break;
      }
    }

    // Fallback to highest EF predecessor if strict alignment missed
    if (!bestPred) {
      let highestPredEf = -1;
      for (const pId of prereqs) {
        const pEf = ef.get(pId) || 0;
        if (pEf > highestPredEf) {
          highestPredEf = pEf;
          bestPred = pId;
        }
      }
    }

    if (bestPred) {
      edgeKeys.add(`${bestPred}->${currId}`);
      currId = bestPred;
    } else {
      break;
    }
  }

  // Chronological order from root -> terminal
  const orderedChain = reversedChain.reverse();

  // Calculate total days on critical path
  const totalDays = orderedChain.reduce(
    (sum, t) => sum + (durations.get(t.id) || 2),
    0
  );

  // Shorten task titles for clean badge display
  const shortenTitle = (title: string): string => {
    if (title.length <= 14) return title;
    // Common shortcuts
    if (title.toLowerCase().includes('database')) return 'Database';
    if (title.toLowerCase().includes('backend')) return 'Backend';
    if (title.toLowerCase().includes('integration test') || title.toLowerCase().includes('tests')) return 'Tests';
    if (title.toLowerCase().includes('frontend')) return 'Frontend';
    if (title.toLowerCase().includes('pipeline') || title.toLowerCase().includes('qa')) return 'QA';
    if (title.toLowerCase().includes('deployment') || title.toLowerCase().includes('deploy')) return 'Deploy';
    if (title.toLowerCase().includes('dashboard')) return 'Dashboard';
    if (title.toLowerCase().includes('auth')) return 'Auth';
    return title.split(' ')[0] || title.slice(0, 10);
  };

  const chainText = orderedChain.map((t) => t.title).join(' → ');
  const shortChainText = orderedChain.map((t) => shortenTitle(t.title)).join(' → ');

  // Detect any tasks in critical path that are currently blocked
  const blockedTasksOnPath = orderedChain.filter((t) => t.blocked);
  const isBlocked = blockedTasksOnPath.length > 0;

  const criticalWarning = isBlocked
    ? `Critical path is blocked at "${blockedTasksOnPath[0].title}". Project completion cannot proceed until its prerequisites are completed.`
    : null;

  return {
    criticalPathNodeIds: nodeIds,
    criticalPathEdgeKeys: edgeKeys,
    orderedChain,
    chainText,
    shortChainText,
    totalDays,
    isBlocked,
    blockedTasksOnPath,
    criticalWarning,
  };
}
