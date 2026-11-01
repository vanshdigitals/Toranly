import type { TaskItem } from './plan';

/**
 * Calculates due date string (YYYY-MM-DD) from eventDate and offsetDays (days before event).
 */
export function calculateDueDate(eventDateStr: string, offsetDays: number): string {
  try {
    const d = new Date(eventDateStr);
    if (isNaN(d.getTime())) return eventDateStr;
    d.setDate(d.getDate() - offsetDays);
    return d.toISOString().split('T')[0];
  } catch {
    return eventDateStr;
  }
}

/**
 * Check if a task is overdue relative to today (Asia/Kolkata or local ISO date).
 */
export function isTaskOverdue(dueDate?: string, status: string = 'open'): boolean {
  if (status === 'done' || !dueDate) return false;
  const today = new Date().toISOString().split('T')[0];
  return dueDate < today;
}

export interface DateChangePreviewItem {
  id: string;
  title: string;
  oldDueDate: string;
  newDueDate: string;
  offsetDays?: number;
  becomesOverdue: boolean;
}

export interface FixedDateWarningItem {
  id: string;
  title: string;
  dueDate?: string;
}

export interface DateChangePreviewResult {
  oldEventDate: string;
  newEventDate: string;
  deltaDays: number;
  relativeTasksShifted: DateChangePreviewItem[];
  fixedTasksUnchanged: FixedDateWarningItem[];
  overdueCount: number;
}

/**
 * Preview impact of changing the event date on timeline tasks (D-03).
 */
export function previewDateChange(
  tasks: TaskItem[],
  oldEventDate: string,
  newEventDate: string
): DateChangePreviewResult {
  const oldDate = new Date(oldEventDate);
  const newDate = new Date(newEventDate);
  const diffMs = newDate.getTime() - oldDate.getTime();
  const deltaDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const today = new Date().toISOString().split('T')[0];

  const relativeTasksShifted: DateChangePreviewItem[] = [];
  const fixedTasksUnchanged: FixedDateWarningItem[] = [];
  let overdueCount = 0;

  for (const task of tasks) {
    if (task.dateMode === 'fixed') {
      fixedTasksUnchanged.push({
        id: task.id,
        title: task.title,
        dueDate: task.dueDate,
      });
      continue;
    }

    const offset = task.offsetDays ?? 0;
    const oldDue = task.dueDate || calculateDueDate(oldEventDate, offset);
    const newDue = calculateDueDate(newEventDate, offset);
    const becomesOverdue = task.status === 'open' && newDue < today;

    if (becomesOverdue) {
      overdueCount++;
    }

    relativeTasksShifted.push({
      id: task.id,
      title: task.title,
      oldDueDate: oldDue,
      newDueDate: newDue,
      offsetDays: offset,
      becomesOverdue,
    });
  }

  return {
    oldEventDate,
    newEventDate,
    deltaDays,
    relativeTasksShifted,
    fixedTasksUnchanged,
    overdueCount,
  };
}

export interface CycleDetectionResult {
  hasCycle: boolean;
  cycleTaskIds?: string[];
}

/**
 * Detects circular dependencies using Kahn's topological sort algorithm.
 */
export function detectTaskCycle(tasks: TaskItem[]): CycleDetectionResult {
  const taskMap = new Map<string, TaskItem>();
  for (const t of tasks) {
    taskMap.set(t.id, t);
  }

  // inDegree: how many dependencies this task has
  const inDegree = new Map<string, number>();
  // adjList: dependency -> dependent tasks that wait on it
  const adj = new Map<string, string[]>();

  for (const t of tasks) {
    inDegree.set(t.id, 0);
    adj.set(t.id, []);
  }

  for (const t of tasks) {
    const validDeps = (t.dependsOn || []).filter((depId) => taskMap.has(depId));
    inDegree.set(t.id, validDeps.length);

    for (const depId of validDeps) {
      adj.get(depId)!.push(t.id);
    }
  }

  // Enqueue tasks with in-degree 0
  const queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(id);
    }
  }

  let processedCount = 0;
  while (queue.length > 0) {
    const curr = queue.shift()!;
    processedCount++;

    for (const neighbor of adj.get(curr) || []) {
      const newDeg = inDegree.get(neighbor)! - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) {
        queue.push(neighbor);
      }
    }
  }

  if (processedCount < tasks.length) {
    // Tasks remaining with inDegree > 0 are part of or blocked by a cycle
    const cycleTaskIds = tasks.filter((t) => (inDegree.get(t.id) || 0) > 0).map((t) => t.id);
    return {
      hasCycle: true,
      cycleTaskIds,
    };
  }

  return { hasCycle: false };
}

export interface TaskCompletionGate {
  canComplete: boolean;
  blockingTasks: TaskItem[];
}

/**
 * Completion gating: A task cannot be completed if any task it depends on is still open.
 */
export function checkTaskCompletionGate(task: TaskItem, allTasks: TaskItem[]): TaskCompletionGate {
  if (!task.dependsOn || task.dependsOn.length === 0) {
    return { canComplete: true, blockingTasks: [] };
  }

  const taskMap = new Map<string, TaskItem>();
  for (const t of allTasks) {
    taskMap.set(t.id, t);
  }

  const blockingTasks: TaskItem[] = [];
  for (const depId of task.dependsOn) {
    const dep = taskMap.get(depId);
    if (dep && dep.status !== 'done') {
      blockingTasks.push(dep);
    }
  }

  return {
    canComplete: blockingTasks.length === 0,
    blockingTasks,
  };
}
