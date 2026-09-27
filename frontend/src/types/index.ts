export type TaskStatus = 'BACKLOG' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  blocked: boolean;
  blockedReason: string | null;
  boardPosition: number;
  startDate: string;
  endDate: string;
  prerequisiteIds: string[];
}

export type Confidence = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Suggestion {
  id: string;
  taskId: string;
  suggestedPrerequisiteId: string;
  reason: string;
  confidence: Confidence;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
}

export interface ApiErrorResponse {
  error?: string;
  message?: string;
  status?: number;
}

export interface AffectedTask {
  taskId: string;
  newStartDate: string;
  newEndDate: string;
}

export interface PreviewDelayRequest {
  durationDays?: number;
  earliestStart?: string;
}

export interface PreviewDelayResponse {
  affectedTasks: AffectedTask[];
}
