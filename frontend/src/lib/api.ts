const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface FetchOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

async function request<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${res.status}`);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return res.json();
}

export interface AuthResponse {
  accessToken: string;
}

export interface RegisterResponse {
  id: number;
  email: string;
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  createdAt: string;
  updatedAt: string;
  userId: number;
  projectId: number | null;
  user: { email: string };
}

export interface ProjectMember {
  id: number;
  role: 'OWNER' | 'MEMBER';
  joinedAt: string;
  userId: number;
  projectId: number;
  user: { id: number; email: string };
}

export interface JoinRequest {
  id: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
  userId: number;
  projectId: number;
  user: { id: number; email: string };
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  members: ProjectMember[];
  _count: { tasks: number; members: number };
}

export interface ProjectDetail extends Project {
  tasks: Task[];
  joinRequests: JoinRequest[];
}

export const api = {
  auth: {
    register(email: string, password: string) {
      return request<RegisterResponse>('/auth/register', {
        method: 'POST',
        body: { email, password },
      });
    },
    login(email: string, password: string) {
      return request<AuthResponse>('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
    },
  },

  tasks: {
    getAll(token: string) {
      return request<Task[]>('/tasks', { token });
    },
    getBoard(token: string) {
      return request<Task[]>('/tasks/board', { token });
    },
    create(token: string, data: { title: string; description?: string; projectId?: number }) {
      return request<Task>('/tasks', { method: 'POST', body: data, token });
    },
    update(
      token: string,
      id: number,
      data: { title?: string; description?: string; status?: string },
    ) {
      return request<Task>(`/tasks/${id}`, { method: 'PATCH', body: data, token });
    },
    delete(token: string, id: number) {
      return request<{ deleted: boolean }>(`/tasks/${id}`, { method: 'DELETE', token });
    },
  },

  projects: {
    getAll(token: string) {
      return request<Project[]>('/projects', { token });
    },
    getMy(token: string) {
      return request<Project[]>('/projects/my', { token });
    },
    getOne(token: string, id: number) {
      return request<ProjectDetail>(`/projects/${id}`, { token });
    },
    create(token: string, data: { name: string; description?: string }) {
      return request<Project>('/projects', { method: 'POST', body: data, token });
    },
    update(token: string, id: number, data: { name?: string; description?: string }) {
      return request<Project>(`/projects/${id}`, { method: 'PATCH', body: data, token });
    },
    delete(token: string, id: number) {
      return request<{ deleted: boolean }>(`/projects/${id}`, { method: 'DELETE', token });
    },
    requestJoin(token: string, projectId: number) {
      return request<JoinRequest>(`/projects/${projectId}/join`, { method: 'POST', token });
    },
    acceptRequest(token: string, requestId: number) {
      return request<{ accepted: boolean }>(`/projects/requests/${requestId}/accept`, {
        method: 'POST',
        token,
      });
    },
    rejectRequest(token: string, requestId: number) {
      return request<{ rejected: boolean }>(`/projects/requests/${requestId}/reject`, {
        method: 'POST',
        token,
      });
    },
    removeMember(token: string, projectId: number, memberId: number) {
      return request<{ removed: boolean }>(`/projects/${projectId}/members/${memberId}`, {
        method: 'DELETE',
        token,
      });
    },
  },
};
