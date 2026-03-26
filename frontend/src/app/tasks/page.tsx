'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, Task } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useSocket } from '@/lib/use-socket';

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
};

const STATUS_DOT: Record<TaskStatus, string> = {
  TODO: 'bg-zinc-400',
  IN_PROGRESS: 'bg-blue-500',
  DONE: 'bg-emerald-500',
};

function getInitials(email: string): string {
  return email.split('@')[0].slice(0, 2).toUpperCase();
}

function getAvatarColor(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    'bg-violet-500',
    'bg-sky-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-teal-500',
    'bg-indigo-500',
    'bg-pink-500',
  ];
  return colors[Math.abs(hash) % colors.length];
}

export default function TasksPage() {
  const router = useRouter();
  const { token, userId, logout, isAuthenticated } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [error, setError] = useState('');
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const draggedTaskId = useRef<number | null>(null);

  const loadTasks = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.tasks.getBoard(token);
      setTasks(data);
    } catch {
      setError('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    loadTasks();
  }, [isAuthenticated, router, loadTasks]);

  useSocket({
    onTaskCreated: (data) => {
      setTasks((prev) => {
        if (prev.some((t) => t.id === data.id)) return prev;
        return [
          {
            id: data.id,
            title: data.title ?? '',
            description: data.description ?? null,
            status: (data.status as TaskStatus) ?? 'TODO',
            userId: data.userId ?? 0,
            projectId: null,
            user: { email: data.userEmail ?? '' },
            createdAt: data.createdAt ?? data.timestamp,
            updatedAt: data.updatedAt ?? data.timestamp,
          },
          ...prev,
        ];
      });
    },
    onTaskUpdated: (data) => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === data.id
            ? {
                ...t,
                status: (data.status as TaskStatus) ?? t.status,
                title: data.title ?? t.title,
                description:
                  data.description !== undefined ? (data.description ?? null) : t.description,
                updatedAt: data.timestamp,
              }
            : t,
        ),
      );
    },
    onTaskDeleted: (data) => {
      setTasks((prev) => prev.filter((t) => t.id !== data.id));
    },
  });

  async function handleCreate() {
    if (!token || !newTitle.trim()) return;
    setError('');
    const title = newTitle.trim();
    const description = newDescription.trim() || undefined;
    setNewTitle('');
    setNewDescription('');
    setShowForm(false);
    try {
      const task = await api.tasks.create(token, { title, description });
      setTasks((prev) => {
        if (prev.some((t) => t.id === task.id)) return prev;
        return [task, ...prev];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    }
  }

  async function handleStatusChange(taskId: number, status: TaskStatus) {
    if (!token) return;
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
    try {
      await api.tasks.update(token, taskId, { status });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task');
      loadTasks();
    }
  }

  async function handleDelete(taskId: number) {
    if (!token) return;
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    try {
      await api.tasks.delete(token, taskId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
      loadTasks();
    }
  }

  function handleLogout() {
    logout();
    router.push('/login');
  }

  /* ─── Drag & Drop ─── */
  function handleDragStart(e: React.DragEvent, taskId: number) {
    draggedTaskId.current = taskId;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(taskId));
    requestAnimationFrame(() => {
      const el = document.getElementById(`task-${taskId}`);
      if (el) el.style.opacity = '0.4';
    });
  }

  function handleDragEnd(taskId: number) {
    draggedTaskId.current = null;
    setDragOverColumn(null);
    const el = document.getElementById(`task-${taskId}`);
    if (el) el.style.opacity = '1';
  }

  function handleDragOver(e: React.DragEvent, status: TaskStatus) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(status);
  }

  function handleDragLeave(e: React.DragEvent, status: TaskStatus) {
    const related = e.relatedTarget as HTMLElement | null;
    const column = e.currentTarget as HTMLElement;
    if (!related || !column.contains(related)) {
      if (dragOverColumn === status) setDragOverColumn(null);
    }
  }

  function handleDrop(e: React.DragEvent, targetStatus: TaskStatus) {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = draggedTaskId.current;
    if (taskId === null) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === targetStatus) return;
    if (task.userId !== userId) {
      setError('You can only move your own tasks');
      return;
    }
    handleStatusChange(taskId, targetStatus);
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-zinc-950 min-h-screen">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-zinc-300 dark:border-zinc-600 border-t-zinc-600 dark:border-t-zinc-300 rounded-full animate-spin" />
          <p className="text-zinc-500">Loading...</p>
        </div>
      </div>
    );
  }

  const columns: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE'];

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-zinc-950 min-h-screen">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Circle</h1>
            <nav className="flex items-center gap-1">
              <Link
                href="/projects"
                className="px-3 py-1.5 text-sm font-medium rounded-lg text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                Projects
              </Link>
              <Link
                href="/tasks"
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
                Board
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium rounded-lg transition-colors">
              + New Task
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 text-sm font-medium transition-colors">
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-6">
        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 ml-4">
              ✕
            </button>
          </div>
        )}

        {/* New task form */}
        {showForm && (
          <div className="mb-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
              New Task
            </h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Task title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent text-sm"
              />
              <textarea
                placeholder="Description (optional)"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={2}
                className="w-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent resize-none text-sm"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleCreate}
                  disabled={!newTitle.trim()}
                  className="px-5 py-2 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-40 text-white dark:text-zinc-900 text-sm font-medium rounded-xl transition-colors">
                  Create
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-5 py-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 text-sm font-medium transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Kanban Board */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {columns.map((status) => {
            const columnTasks = tasks.filter((t) => t.status === status);
            const isOver = dragOverColumn === status;
            return (
              <div key={status} className="flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-2 h-2 rounded-full ${STATUS_DOT[status]}`} />
                  <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    {STATUS_LABELS[status]}
                  </h3>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500 ml-auto">
                    {columnTasks.length}
                  </span>
                </div>
                <div
                  onDragOver={(e) => handleDragOver(e, status)}
                  onDragLeave={(e) => handleDragLeave(e, status)}
                  onDrop={(e) => handleDrop(e, status)}
                  className={`flex-1 rounded-xl p-2 space-y-2 min-h-[200px] transition-all duration-150 ${
                    isOver
                      ? 'bg-zinc-200/60 dark:bg-zinc-800/60 ring-2 ring-zinc-300 dark:ring-zinc-600'
                      : 'bg-zinc-100/50 dark:bg-zinc-900/30'
                  }`}>
                  {columnTasks.length === 0 && (
                    <p className="text-center text-xs text-zinc-400 dark:text-zinc-600 py-8">
                      {isOver ? 'Drop here' : 'No tasks'}
                    </p>
                  )}
                  {columnTasks.map((task) => {
                    const isOwn = task.userId === userId;
                    const email = task.user?.email ?? 'unknown';
                    return (
                      <div
                        id={`task-${task.id}`}
                        key={task.id}
                        draggable={isOwn}
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        onDragEnd={() => handleDragEnd(task.id)}
                        className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 transition-all hover:shadow-sm ${
                          isOwn ? 'cursor-grab active:cursor-grabbing' : ''
                        }`}>
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 flex-1">
                            {task.title}
                          </h4>
                          {isOwn && (
                            <button
                              onClick={() => handleDelete(task.id)}
                              className="text-zinc-300 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400 transition-colors text-xs shrink-0"
                              title="Delete">
                              ✕
                            </button>
                          )}
                        </div>
                        {task.description && (
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
                            {task.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span
                            className={`${getAvatarColor(email)} w-5 h-5 rounded-full flex items-center justify-center`}
                            title={email}>
                            <span className="text-[9px] font-bold text-white leading-none">
                              {getInitials(email)}
                            </span>
                          </span>
                          <span className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">
                            {email.split('@')[0]}
                            {isOwn && (
                              <span className="ml-1 text-zinc-900 dark:text-zinc-100 font-medium">
                                (you)
                              </span>
                            )}
                          </span>
                        </div>
                        {isOwn && (
                          <div className="flex gap-1.5 mt-2">
                            {status !== 'TODO' && (
                              <button
                                onClick={() => handleStatusChange(task.id, 'TODO')}
                                className="text-[11px] px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 transition-colors">
                                To Do
                              </button>
                            )}
                            {status !== 'IN_PROGRESS' && (
                              <button
                                onClick={() => handleStatusChange(task.id, 'IN_PROGRESS')}
                                className="text-[11px] px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 transition-colors">
                                In Progress
                              </button>
                            )}
                            {status !== 'DONE' && (
                              <button
                                onClick={() => handleStatusChange(task.id, 'DONE')}
                                className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 transition-colors">
                                Done
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
