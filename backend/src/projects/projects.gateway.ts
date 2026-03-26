import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ProjectsGateway {
  @WebSocketServer()
  server!: Server;

  private logger = new Logger('ProjectsGateway');

  emitProjectCreated(project: Record<string, unknown>) {
    this.logger.log(`project:created id=${project.id}`);
    this.server.emit('project:created', {
      ...project,
      timestamp: new Date().toISOString(),
    });
  }

  emitProjectUpdated(project: Record<string, unknown>) {
    this.logger.log(`project:updated id=${project.id}`);
    this.server.emit('project:updated', {
      ...project,
      timestamp: new Date().toISOString(),
    });
  }

  emitProjectDeleted(projectId: number) {
    this.logger.log(`project:deleted id=${projectId}`);
    this.server.emit('project:deleted', {
      id: projectId,
      timestamp: new Date().toISOString(),
    });
  }

  emitJoinRequested(data: {
    projectId: number;
    requestId: number;
    userId: number;
    userEmail: string;
  }) {
    this.logger.log(
      `project:join-requested project=${data.projectId} user=${data.userId}`,
    );
    this.server.emit('project:join-requested', {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  emitJoinAccepted(data: {
    projectId: number;
    requestId: number;
    userId: number;
    userEmail: string;
  }) {
    this.logger.log(
      `project:join-accepted project=${data.projectId} user=${data.userId}`,
    );
    this.server.emit('project:join-accepted', {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  emitJoinRejected(data: {
    projectId: number;
    requestId: number;
    userId: number;
  }) {
    this.logger.log(
      `project:join-rejected project=${data.projectId} request=${data.requestId}`,
    );
    this.server.emit('project:join-rejected', {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  emitMemberRemoved(data: { projectId: number; userId: number }) {
    this.logger.log(
      `project:member-removed project=${data.projectId} user=${data.userId}`,
    );
    this.server.emit('project:member-removed', {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }
}
