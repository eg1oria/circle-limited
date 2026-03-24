'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';

export interface TaskEvent {
  id: number;
  status?: string;
  title?: string;
  description?: string;
  userId?: number;
  userEmail?: string;
  projectId?: number | null;
  createdAt?: string;
  updatedAt?: string;
  timestamp: string;
}

export interface ProjectEvent {
  id: number;
  name?: string;
  description?: string | null;
  members?: unknown[];
  _count?: { tasks: number; members: number };
  timestamp: string;
}

export interface JoinRequestEvent {
  projectId: number;
  requestId: number;
  userId: number;
  userEmail?: string;
  timestamp: string;
}

export interface MemberRemovedEvent {
  projectId: number;
  userId: number;
  timestamp: string;
}

interface UseSocketOptions {
  onTaskCreated?: (data: TaskEvent) => void;
  onTaskUpdated?: (data: TaskEvent) => void;
  onTaskDeleted?: (data: { id: number; timestamp: string }) => void;
  onProjectCreated?: (data: ProjectEvent) => void;
  onProjectUpdated?: (data: ProjectEvent) => void;
  onProjectDeleted?: (data: { id: number; timestamp: string }) => void;
  onJoinRequested?: (data: JoinRequestEvent) => void;
  onJoinAccepted?: (data: JoinRequestEvent) => void;
  onJoinRejected?: (data: JoinRequestEvent) => void;
  onMemberRemoved?: (data: MemberRemovedEvent) => void;
}

export function useSocket(options: UseSocketOptions) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    // Task events
    if (options.onTaskCreated) {
      socket.on('task:created', options.onTaskCreated);
    }
    if (options.onTaskUpdated) {
      socket.on('task:updated', options.onTaskUpdated);
    }
    if (options.onTaskDeleted) {
      socket.on('task:deleted', options.onTaskDeleted);
    }

    // Project events
    if (options.onProjectCreated) {
      socket.on('project:created', options.onProjectCreated);
    }
    if (options.onProjectUpdated) {
      socket.on('project:updated', options.onProjectUpdated);
    }
    if (options.onProjectDeleted) {
      socket.on('project:deleted', options.onProjectDeleted);
    }
    if (options.onJoinRequested) {
      socket.on('project:join-requested', options.onJoinRequested);
    }
    if (options.onJoinAccepted) {
      socket.on('project:join-accepted', options.onJoinAccepted);
    }
    if (options.onJoinRejected) {
      socket.on('project:join-rejected', options.onJoinRejected);
    }
    if (options.onMemberRemoved) {
      socket.on('project:member-removed', options.onMemberRemoved);
    }

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return socketRef;
}
