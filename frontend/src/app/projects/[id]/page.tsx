'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { api, ProjectDetail, Task } from '@/lib/api';
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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = Number(params.id);
  const { token, userId, logout, isAuthenticated } = useAuth();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');

  // Drag & drop state
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const draggedTaskId = useRef<number | null>(null);

  const loadProject = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.projects.getOne(token, projectId);
      setProject(data);
    } catch {
      setError('Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [token, projectId]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    loadProject();
  }, [isAuthenticated, router, loadProject]);

  useSocket({
    onTaskCreated: (data) => {
      if (data.projectId !== projectId) return;
      setProject((prev) => {
        if (!prev) return prev;
        if (prev.tasks.some((t) => t.id === data.id)) return prev;
        const newTask: Task = {
          id: data.id,
          title: data.title ?? '',
          description: data.description ?? null,
          status: (data.status as Task['status']) ?? 'TODO',
          userId: data.userId ?? 0,
          projectId: data.projectId ?? null,
          createdAt: data.createdAt ?? data.timestamp,
          updatedAt: data.updatedAt ?? data.timestamp,
          user: { email: data.userEmail ?? 'unknown' },
        };
        return { ...prev, tasks: [newTask, ...prev.tasks] };
      });
    },
    onTaskUpdated: (data) => {
      setProject((prev) => {
        if (!prev) return prev;
        const idx = prev.tasks.findIndex((t) => t.id === data.id);
        if (idx === -1) return prev;
        const updated = { ...prev.tasks[idx] };
        if (data.status) updated.status = data.status as Task['status'];
        if (data.title) updated.title = data.title;
        if (data.description !== undefined) updated.description = data.description ?? null;
        const tasks = [...prev.tasks];
        tasks[idx] = updated;
        return { ...prev, tasks };
      });
    },
    onTaskDeleted: (data) => {
      setProject((prev) => {
        if (!prev) return prev;
        return { ...prev, tasks: prev.tasks.filter((t) => t.id !== data.id) };
      });
    },
    onProjectUpdated: (data) => {
      if (data.id !== projectId) return;
      setProject((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          name: (data.name as string) ?? prev.name,
          description:
            data.description !== undefined ? (data.description as string | null) : prev.description,
        };
      });
    },
    onProjectDeleted: (data) => {
      if (data.id === projectId) {
        router.push('/projects');
      }
    },
    onJoinRequested: (data) => {
      if (data.projectId !== projectId) return;
      setProject((prev) => {
        if (!prev) return prev;
        if (prev.joinRequests.some((r) => r.id === data.requestId)) return prev;
        return {
          ...prev,
          joinRequests: [
            ...prev.joinRequests,
            {
              id: data.requestId,
              status: 'PENDING' as const,
              createdAt: data.timestamp,
              userId: data.userId,
              projectId: data.projectId,
              user: { id: data.userId, email: data.userEmail ?? 'unknown' },
            },
          ],
        };
      });
    },
    onJoinAccepted: (data) => {
      if (data.projectId !== projectId) return;
      setProject((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          joinRequests: prev.joinRequests.filter((r) => r.id !== data.requestId),
          members: [
            ...prev.members,
            {
              id: Date.now(),
              role: 'MEMBER' as const,
              joinedAt: data.timestamp,
              userId: data.userId,
              projectId,
              user: { id: data.userId, email: data.userEmail ?? 'unknown' },
            },
          ],
        };
      });
    },
    onJoinRejected: (data) => {
      if (data.projectId !== projectId) return;
      setProject((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          joinRequests: prev.joinRequests.filter((r) => r.id !== data.requestId),
        };
      });
    },
    onMemberRemoved: (data) => {
      if (data.projectId !== projectId) return;
      if (data.userId === userId) {
        router.push('/projects');
        return;
      }
      setProject((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          members: prev.members.filter((m) => m.user.id !== data.userId),
        };
      });
    },
  });

  const isMember = project?.members.some((m) => m.user.id === userId);
  const isOwner = project?.members.some((m) => m.user.id === userId && m.role === 'OWNER');

  async function handleCreateTask() {
    if (!token || !newTitle.trim()) return;
    setError('');
    try {
      await api.tasks.create(token, {
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        projectId,
      });
      setNewTitle('');
      setNewDescription('');
      setShowTaskForm(false);
      loadProject();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    }
  }

  async function handleStatusChange(taskId: number, status: TaskStatus) {
    if (!token || !project) return;
    // Optimistic
    setProject({
      ...project,
      tasks: project.tasks.map((t) => (t.id === taskId ? { ...t, status } : t)),
    });
    try {
      await api.tasks.update(token, taskId, { status });
    } catch {
      loadProject();
    }
  }

  async function handleDeleteTask(taskId: number) {
    if (!token || !project) return;
    setProject({
      ...project,
      tasks: project.tasks.filter((t) => t.id !== taskId),
    });
    try {
      await api.tasks.delete(token, taskId);
    } catch {
      loadProject();
    }
  }

  async function handleAcceptRequest(requestId: number) {
    if (!token) return;
    try {
      await api.projects.acceptRequest(token, requestId);
      loadProject();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept');
    }
  }

  async function handleRejectRequest(requestId: number) {
    if (!token) return;
    try {
      await api.projects.rejectRequest(token, requestId);
      loadProject();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    }
  }

  async function handleRemoveMember(memberId: number) {
    if (!token) return;
    try {
      await api.projects.removeMember(token, projectId, memberId);
      loadProject();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    }
  }

  async function handleDeleteProject() {
    if (!token) return;
    try {
      await api.projects.delete(token, projectId);
      router.push('/projects');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
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
      const el = document.getElementById(`ptask-${taskId}`);
      if (el) el.style.opacity = '0.4';
    });
  }

  function handleDragEnd(taskId: number) {
    draggedTaskId.current = null;
    setDragOverColumn(null);
    const el = document.getElementById(`ptask-${taskId}`);
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
    if (taskId === null || !project) return;
    const task = project.tasks.find((t) => t.id === taskId);
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

  if (!project) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-zinc-950 min-h-screen">
        <p className="text-zinc-500">Project not found</p>
      </div>
    );
  }

  const columns: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE'];

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-zinc-950 min-h-screen">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/projects"
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 19.5 8.25 12l7.5-7.5"
                />
              </svg>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{project.name}</h1>
              {project.description && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {project.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isMember && (
              <button
                onClick={() => setShowTaskForm(!showTaskForm)}
                className="px-4 py-2 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium rounded-lg transition-colors">
                + New Task
              </button>
            )}
            {isOwner && (
              <button
                onClick={handleDeleteProject}
                className="px-4 py-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium rounded-lg transition-colors">
                Delete Project
              </button>
            )}
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 text-sm font-medium transition-colors">
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto w-full px-6 py-6 flex-1">
        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 ml-4">
              ✕
            </button>
          </div>
        )}

        <div className="flex gap-6">
          {/* Main content — Kanban */}
          <div className="flex-1 min-w-0">
            {/* Create task form */}
            {showTaskForm && (
              <div className="mb-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                  New Task
                </h3>
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
                      onClick={handleCreateTask}
                      disabled={!newTitle.trim()}
                      className="px-5 py-2 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-40 text-white dark:text-zinc-900 text-sm font-medium rounded-xl transition-colors">
                      Create
                    </button>
                    <button
                      onClick={() => setShowTaskForm(false)}
                      className="px-5 py-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 text-sm font-medium transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Kanban Columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {columns.map((status) => {
                const columnTasks = project.tasks.filter((t) => t.status === status);
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
                      className={`flex-1 rounded-xl p-2 space-y-2 min-h-[120px] transition-all duration-150 ${
                        isOver
                          ? 'bg-zinc-200/60 dark:bg-zinc-800/60 ring-2 ring-zinc-300 dark:ring-zinc-600'
                          : 'bg-zinc-100/50 dark:bg-zinc-900/30'
                      }`}>
                      {columnTasks.length === 0 && (
                        <p className="text-center text-xs text-zinc-400 dark:text-zinc-600 py-8">
                          {isOver ? 'Drop here' : 'Empty'}
                        </p>
                      )}
                      {columnTasks.map((task) => {
                        const isOwn = task.userId === userId;
                        const email = task.user?.email ?? 'unknown';
                        return (
                          <div
                            id={`ptask-${task.id}`}
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
                                  onClick={() => handleDeleteTask(task.id)}
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
                              <span className="text-[10px] text-zinc-300 dark:text-zinc-700 ml-auto">
                                {timeAgo(task.createdAt)}
                              </span>
                            </div>
                            {/* Quick status buttons */}
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

          {/* Sidebar */}
          <div className="w-72 shrink-0 space-y-4">
            {/* Members */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                Members
                <span className="ml-2 text-xs font-normal text-zinc-400">
                  {project.members.length}
                </span>
              </h3>
              <div className="space-y-2">
                {project.members.map((m) => (
                  <div key={m.id} className="flex items-center gap-2.5 group">
                    <span
                      className={`${getAvatarColor(m.user.email)} w-7 h-7 rounded-full flex items-center justify-center shrink-0`}>
                      <span className="text-[10px] font-bold text-white leading-none">
                        {getInitials(m.user.email)}
                      </span>
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-900 dark:text-zinc-100 truncate">
                        {m.user.email.split('@')[0]}
                      </p>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">
                        {m.role}
                      </p>
                    </div>
                    {isOwner && m.role !== 'OWNER' && (
                      <button
                        onClick={() => handleRemoveMember(m.user.id)}
                        className="opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400 transition-all text-xs">
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Join Requests (owner only) */}
            {isOwner && project.joinRequests.length > 0 && (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                  Join Requests
                  <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full">
                    {project.joinRequests.length}
                  </span>
                </h3>
                <div className="space-y-3">
                  {project.joinRequests.map((req) => (
                    <div key={req.id} className="flex items-center gap-2.5">
                      <span
                        className={`${getAvatarColor(req.user.email)} w-7 h-7 rounded-full flex items-center justify-center shrink-0`}>
                        <span className="text-[10px] font-bold text-white leading-none">
                          {getInitials(req.user.email)}
                        </span>
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-900 dark:text-zinc-100 truncate">
                          {req.user.email.split('@')[0]}
                        </p>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                          {timeAgo(req.createdAt)}
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleAcceptRequest(req.id)}
                          className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center transition-colors"
                          title="Accept">
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="m4.5 12.75 6 6 9-13.5"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleRejectRequest(req.id)}
                          className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500 dark:text-red-400 flex items-center justify-center transition-colors"
                          title="Reject">
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6 18 18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Project Info */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">About</h3>
              <div className="space-y-2 text-xs text-zinc-500 dark:text-zinc-400">
                <div className="flex justify-between">
                  <span>Tasks</span>
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    {project.tasks.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Members</span>
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    {project.members.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Created</span>
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    {new Date(project.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
