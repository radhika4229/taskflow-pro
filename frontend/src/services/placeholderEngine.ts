import { Task, TaskStatus, Suggestion } from '../types';

const INITIAL_TASKS: Task[] = [
  {
    id: 'task-1',
    title: 'Database Schema Design',
    description: 'PostgreSQL schema modeling, migration scripts, and entity relationships.',
    status: 'DONE',
    blocked: false,
    blockedReason: null,
    boardPosition: 0,
    prerequisiteIds: [],
    startDate: '2026-09-20',
    endDate: '2026-09-23',
  },
  {
    id: 'task-2',
    title: 'User Authentication Service',
    description: 'JWT token issuance, refresh token rotation, and password hashing service.',
    status: 'IN_PROGRESS',
    blocked: false,
    blockedReason: null,
    boardPosition: 0,
    prerequisiteIds: ['task-1'],
    startDate: '2026-09-24',
    endDate: '2026-09-27',
  },
  {
    id: 'task-3',
    title: 'Backend Core REST API',
    description: 'Spring Boot endpoints for task CRUD, status transitions, and topological validation.',
    status: 'IN_PROGRESS',
    blocked: false,
    blockedReason: null,
    boardPosition: 1,
    prerequisiteIds: ['task-1'],
    startDate: '2026-09-24',
    endDate: '2026-09-28',
  },
  {
    id: 'task-4',
    title: 'Frontend Layout & Navigation',
    description: 'Vite React application scaffold, sidebar views, routing, and design system tokens.',
    status: 'DONE',
    blocked: false,
    blockedReason: null,
    boardPosition: 1,
    prerequisiteIds: [],
    startDate: '2026-09-22',
    endDate: '2026-09-25',
  },
  {
    id: 'task-5',
    title: 'Integration Tests Suite',
    description: 'Automated Testcontainers E2E suite verifying DAG dependency constraints and cycle defense.',
    status: 'BACKLOG',
    blocked: true,
    blockedReason: 'Prerequisites "User Authentication Service" and "Backend Core REST API" are not completed.',
    boardPosition: 0,
    prerequisiteIds: ['task-2', 'task-3'],
    startDate: '2026-09-29',
    endDate: '2026-10-02',
  },
  {
    id: 'task-6',
    title: 'Client Dashboard UI',
    description: 'Interactive Kanban board, drag and drop, and critical path timeline display.',
    status: 'IN_PROGRESS',
    blocked: false,
    blockedReason: null,
    boardPosition: 2,
    prerequisiteIds: ['task-4'],
    startDate: '2026-09-25',
    endDate: '2026-09-30',
  },
  {
    id: 'task-7',
    title: 'End-to-End Pipeline QA',
    description: 'Comprehensive smoke tests across frontend and backend prior to deployment.',
    status: 'BACKLOG',
    blocked: true,
    blockedReason: 'Prerequisites "Integration Tests Suite" and "Client Dashboard UI" are not completed.',
    boardPosition: 1,
    prerequisiteIds: ['task-5', 'task-6'],
    startDate: '2026-10-03',
    endDate: '2026-10-06',
  },
  {
    id: 'task-8',
    title: 'Production Deployment',
    description: 'Container packaging, reverse proxy SSL configuration, and production launch.',
    status: 'BACKLOG',
    blocked: true,
    blockedReason: 'Prerequisite "End-to-End Pipeline QA" is not completed.',
    boardPosition: 2,
    prerequisiteIds: ['task-7'],
    startDate: '2026-10-07',
    endDate: '2026-10-08',
  },
  {
    id: 'task-9',
    title: 'User Documentation & Runbook',
    description: 'Architecture diagrams, API specification, and operational troubleshooting runbook.',
    status: 'REVIEW',
    blocked: false,
    blockedReason: null,
    boardPosition: 0,
    prerequisiteIds: [],
    startDate: '2026-09-26',
    endDate: '2026-09-29',
  },
];

const STORAGE_KEY = 'taskflow_placeholder_tasks_v2';

class PlaceholderEngine {
  private tasks: Task[];

  constructor() {
    this.tasks = this.loadTasks();
    this.recomputeAll();
  }

  private loadTasks(): Task[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore localStorage errors
    }
    return JSON.parse(JSON.stringify(INITIAL_TASKS));
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tasks));
    } catch {
      // ignore
    }
  }

  /**
   * Recomputes blocked status for all tasks based on their prerequisites.
   * If any prerequisite is not DONE, the task is blocked.
   */
  public recomputeAll(): Task[] {
    const taskMap = new Map<string, Task>(this.tasks.map((t) => [t.id, t]));

    this.tasks = this.tasks.map((task) => {
      const prereqs = (task.prerequisiteIds || []).map((id) => taskMap.get(id)).filter(Boolean) as Task[];
      const uncompletedPrereqs = prereqs.filter((p) => p.status !== 'DONE');

      const isBlocked = uncompletedPrereqs.length > 0;
      let blockedReason: string | null = null;

      if (isBlocked) {
        const titles = uncompletedPrereqs.map((p) => `"${p.title}"`).join(', ');
        blockedReason = `Prerequisites not completed: ${titles}`;
      }

      return {
        ...task,
        blocked: isBlocked,
        blockedReason,
      };
    });

    this.persist();
    return [...this.tasks];
  }

  /**
   * Checks if adding dependency (taskId depends on prerequisiteId) would form a cycle.
   */
  public detectCycle(taskId: string, prerequisiteId: string): string[] | null {
    if (taskId === prerequisiteId) {
      return [taskId, prerequisiteId];
    }

    const adjacency = new Map<string, string[]>();
    for (const t of this.tasks) {
      adjacency.set(t.id, t.prerequisiteIds ? [...t.prerequisiteIds] : []);
    }

    // Temporarily add edge: taskId -> prerequisiteId
    const currentPrereqs = adjacency.get(taskId) || [];
    if (!currentPrereqs.includes(prerequisiteId)) {
      adjacency.set(taskId, [...currentPrereqs, prerequisiteId]);
    }

    // Detect cycle reachable from taskId using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (curr: string): boolean => {
      visited.add(curr);
      recursionStack.add(curr);
      path.push(curr);

      const neighbors = adjacency.get(curr) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          path.push(neighbor);
          return true;
        }
      }

      recursionStack.delete(curr);
      path.pop();
      return false;
    };

    if (dfs(taskId)) {
      return path;
    }

    return null;
  }

  public getTasks(): Task[] {
    return this.recomputeAll();
  }

  public updateTask(
    id: string,
    payload: { status?: TaskStatus; boardPosition?: number; title?: string; description?: string }
  ): Task {
    const idx = this.tasks.findIndex((t) => t.id === id);
    if (idx === -1) {
      throw new Error(`Task with id ${id} not found`);
    }

    const current = this.tasks[idx];

    // If task is currently blocked, it cannot be moved out of BACKLOG
    if (current.blocked && payload.status && payload.status !== 'BACKLOG') {
      throw new Error(
        `Task "${current.title}" is blocked by prerequisites and cannot be moved to ${payload.status}.`
      );
    }

    const updated: Task = {
      ...current,
      ...payload,
    };

    this.tasks[idx] = updated;
    this.recomputeAll();

    const refreshed = this.tasks.find((t) => t.id === id);
    return refreshed || updated;
  }

  public createTask(payload: {
    title: string;
    description: string;
    status: TaskStatus;
    startDate?: string;
    endDate?: string;
  }): Task {
    const newId = `task-${Date.now()}`;
    const newTask: Task = {
      id: newId,
      title: payload.title,
      description: payload.description,
      status: payload.status,
      blocked: false,
      blockedReason: null,
      boardPosition: this.tasks.filter((t) => t.status === payload.status).length,
      prerequisiteIds: [],
      startDate: payload.startDate || new Date().toISOString().split('T')[0],
      endDate:
        payload.endDate ||
        new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
    };

    this.tasks.push(newTask);
    this.recomputeAll();
    return newTask;
  }

  public createDependency(taskId: string, prerequisiteId: string): { success: boolean } {
    const cycle = this.detectCycle(taskId, prerequisiteId);
    if (cycle) {
      const taskTitleMap = new Map(this.tasks.map((t) => [t.id, t.title]));
      const formattedCycle = cycle.map((id) => taskTitleMap.get(id) || id).join(' → ');
      const err: any = new Error(
        `Circular dependency detected: ${formattedCycle}. DAG engine rejected this prerequisite to prevent deadlock.`
      );
      err.response = {
        status: 409,
        data: {
          error: `Circular dependency detected: ${formattedCycle}. Cannot create cyclical relationship in DAG.`,
        },
      };
      throw err;
    }

    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    const prereqs = task.prerequisiteIds || [];
    if (!prereqs.includes(prerequisiteId)) {
      task.prerequisiteIds = [...prereqs, prerequisiteId];
    }

    this.recomputeAll();
    return { success: true };
  }

  public deleteDependency(taskId: string, prerequisiteId: string): { success: boolean } {
    const task = this.tasks.find((t) => t.id === taskId);
    if (task && task.prerequisiteIds) {
      task.prerequisiteIds = task.prerequisiteIds.filter((id) => id !== prerequisiteId);
      this.recomputeAll();
    }
    return { success: true };
  }

  public getSuggestions(taskId: string): Suggestion[] {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return [];

    const existingPrereqs = new Set(task.prerequisiteIds || []);
    const suggestions: Suggestion[] = [];

    for (const candidate of this.tasks) {
      if (candidate.id === taskId || existingPrereqs.has(candidate.id)) continue;

      // Check if candidate would cause a cycle
      if (this.detectCycle(taskId, candidate.id)) continue;

      // Realistic AI heuristic matching
      const titleLower = task.title.toLowerCase();
      const candidateLower = candidate.title.toLowerCase();

      if (titleLower.includes('test') && candidateLower.includes('api')) {
        suggestions.push({
          id: `sug-${taskId}-${candidate.id}`,
          taskId,
          suggestedPrerequisiteId: candidate.id,
          reason: `Integration testing typically requires "${candidate.title}" to be stable and deployed first.`,
          confidence: 'HIGH',
          status: 'PENDING',
        });
      } else if (titleLower.includes('deployment') && (candidateLower.includes('qa') || candidateLower.includes('test'))) {
        suggestions.push({
          id: `sug-${taskId}-${candidate.id}`,
          taskId,
          suggestedPrerequisiteId: candidate.id,
          reason: `Production release gates require "${candidate.title}" verification before container promotion.`,
          confidence: 'HIGH',
          status: 'PENDING',
        });
      } else if (titleLower.includes('dashboard') && candidateLower.includes('auth')) {
        suggestions.push({
          id: `sug-${taskId}-${candidate.id}`,
          taskId,
          suggestedPrerequisiteId: candidate.id,
          reason: `Client dashboard interfaces consume authentication tokens and session state from "${candidate.title}".`,
          confidence: 'MEDIUM',
          status: 'PENDING',
        });
      }
    }

    // Default fallback suggestion if none matched
    if (suggestions.length === 0) {
      const candidate = this.tasks.find(
        (t) => t.id !== taskId && !existingPrereqs.has(t.id) && !this.detectCycle(taskId, t.id)
      );
      if (candidate) {
        suggestions.push({
          id: `sug-${taskId}-${candidate.id}`,
          taskId,
          suggestedPrerequisiteId: candidate.id,
          reason: `Logical prerequisite pattern detected based on project timeline and dependencies.`,
          confidence: 'MEDIUM',
          status: 'PENDING',
        });
      }
    }

    return suggestions;
  }

  public resetToDefault() {
    this.tasks = JSON.parse(JSON.stringify(INITIAL_TASKS));
    this.recomputeAll();
  }
}

export const placeholderEngine = new PlaceholderEngine();
