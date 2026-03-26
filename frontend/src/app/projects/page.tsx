'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, Project } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useSocket } from '@/lib/use-socket';

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

export default function ProjectsPage() {
  const router = useRouter();
  const { token, userId, logout, isAuthenticated } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'all' | 'my'>('all');

  const loadProjects = useCallback(async () => {
    if (!token) return;
    try {
      const data =
        tab === 'my' ? await api.projects.getMy(token) : await api.projects.getAll(token);
      setProjects(data);
    } catch {
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [token, tab]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    setLoading(true);
    loadProjects();
  }, [isAuthenticated, router, loadProjects]);

  // Real-time updates
  useSocket({
    onProjectCreated: (data) => {
      setProjects((prev) => {
        if (prev.some((p) => p.id === data.id)) return prev;
        return [data as unknown as Project, ...prev];
      });
    },
    onProjectUpdated: (data) => {
      setProjects((prev) =>
        prev.map((p) => (p.id === data.id ? ({ ...p, ...data } as unknown as Project) : p)),
      );
    },
    onProjectDeleted: (data) => {
      setProjects((prev) => prev.filter((p) => p.id !== data.id));
    },
    onJoinAccepted: () => {
      loadProjects();
    },
    onMemberRemoved: () => {
      loadProjects();
    },
  });

  async function handleCreate() {
    if (!token || !name.trim()) return;
    setError('');
    try {
      const project = await api.projects.create(token, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setProjects((prev) => [project, ...prev]);
      setName('');
      setDescription('');
      setShowCreate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    }
  }

  async function handleJoin(projectId: number) {
    if (!token) return;
    try {
      await api.projects.requestJoin(token, projectId);
      setError('');
      // Re-fetch to update state
      loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send request');
    }
  }

  function handleLogout() {
    logout();
    router.push('/login');
  }

  function isMember(project: Project) {
    return project.members.some((m) => m.user.id === userId);
  }

  function isOwner(project: Project) {
    return project.members.some((m) => m.user.id === userId && m.role === 'OWNER');
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-zinc-300 dark:border-zinc-600 border-t-zinc-600 dark:border-t-zinc-300 rounded-full animate-spin" />
          <p className="text-zinc-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 dark:bg-zinc-950 min-h-screen">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Circle</h1>
            <nav className="flex items-center gap-1">
              <Link
                href="/projects"
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
                Projects
              </Link>
              <Link
                href="/tasks"
                className="px-3 py-1.5 text-sm font-medium rounded-lg text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                Board
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="px-4 py-2 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium rounded-lg transition-colors">
              + New Project
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 text-sm font-medium transition-colors">
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto w-full px-6 py-8">
        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 ml-4">
              ✕
            </button>
          </div>
        )}

        {/* Create form */}
        {showCreate && (
          <div className="mb-8 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Create Project
            </h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Project name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent text-sm"
              />
              <textarea
                placeholder="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent resize-none text-sm"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleCreate}
                  disabled={!name.trim()}
                  className="px-5 py-2.5 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-40 text-white dark:text-zinc-900 text-sm font-medium rounded-xl transition-colors">
                  Create
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-5 py-2.5 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 text-sm font-medium transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl p-1 w-fit">
          <button
            onClick={() => setTab('all')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === 'all'
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}>
            All Projects
          </button>
          <button
            onClick={() => setTab('my')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === 'my'
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}>
            My Projects
          </button>
        </div>

        {/* Projects Grid */}
        {projects.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-zinc-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z"
                />
              </svg>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">
              {tab === 'my' ? "You haven't joined any projects yet" : 'No projects yet'}
            </p>
            <p className="text-zinc-400 dark:text-zinc-500 text-xs mt-1">
              Create one to get started
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => {
              const member = isMember(project);
              const owner = isOwner(project);
              const ownerMember = project.members.find((m) => m.role === 'OWNER');

              return (
                <div
                  key={project.id}
                  className="group bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all hover:shadow-md">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      {member ? (
                        <Link
                          href={`/projects/${project.id}`}
                          className="text-base font-semibold text-zinc-900 dark:text-zinc-100 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors truncate block">
                          {project.name}
                        </Link>
                      ) : (
                        <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100 truncate block">
                          {project.name}
                        </span>
                      )}
                    </div>
                    {owner && (
                      <span className="ml-2 shrink-0 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-md">
                        Owner
                      </span>
                    )}
                    {member && !owner && (
                      <span className="ml-2 shrink-0 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-md">
                        Member
                      </span>
                    )}
                  </div>

                  {project.description && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 line-clamp-2">
                      {project.description}
                    </p>
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-4 mb-4 text-xs text-zinc-400 dark:text-zinc-500">
                    <span className="flex items-center gap-1">
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
                        />
                      </svg>
                      {project._count.members}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z"
                        />
                      </svg>
                      {project._count.tasks}
                    </span>
                  </div>

                  {/* Members avatars */}
                  <div className="flex items-center justify-between">
                    <div className="flex -space-x-2">
                      {project.members.slice(0, 5).map((m) => (
                        <span
                          key={m.id}
                          className={`${getAvatarColor(m.user.email)} w-7 h-7 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-zinc-900`}
                          title={m.user.email}>
                          <span className="text-[10px] font-bold text-white leading-none">
                            {getInitials(m.user.email)}
                          </span>
                        </span>
                      ))}
                      {project.members.length > 5 && (
                        <span className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center ring-2 ring-white dark:ring-zinc-900">
                          <span className="text-[10px] font-medium text-zinc-500">
                            +{project.members.length - 5}
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Action */}
                    {member ? (
                      <Link
                        href={`/projects/${project.id}`}
                        className="px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors">
                        Open
                      </Link>
                    ) : (
                      <button
                        onClick={() => handleJoin(project.id)}
                        className="px-3 py-1.5 text-xs font-medium text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors">
                        Request to Join
                      </button>
                    )}
                  </div>

                  {/* Created by */}
                  {ownerMember && (
                    <p className="mt-3 text-[11px] text-zinc-400 dark:text-zinc-600">
                      Created by {ownerMember.user.email}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
