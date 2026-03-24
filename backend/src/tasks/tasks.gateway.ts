import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { Task } from '@prisma/client';

type TaskWithUser = Task & { user: { email: string } };

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class TasksGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private logger = new Logger('TasksGateway');

  afterInit() {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  emitTaskCreated(task: TaskWithUser) {
    this.server.emit('task:created', {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      userId: task.userId,
      userEmail: task.user.email,
      projectId: task.projectId,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      timestamp: new Date().toISOString(),
    });
  }

  emitTaskUpdated(task: TaskWithUser) {
    this.server.emit('task:updated', {
      id: task.id,
      status: task.status,
      title: task.title,
      description: task.description,
      userId: task.userId,
      userEmail: task.user.email,
      projectId: task.projectId,
      timestamp: new Date().toISOString(),
    });
  }

  emitTaskDeleted(taskId: number) {
    this.server.emit('task:deleted', {
      id: taskId,
      timestamp: new Date().toISOString(),
    });
  }
}
