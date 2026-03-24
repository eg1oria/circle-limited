import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { TasksService } from './tasks.service.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { TasksGateway } from './tasks.gateway.js';

@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly tasksGateway: TasksGateway,
  ) {}

  @Get()
  findAll(@CurrentUser() user: { id: number }) {
    return this.tasksService.findAll(user.id);
  }

  @Get('board')
  findBoard() {
    return this.tasksService.findAllBoard();
  }

  @Post()
  async create(
    @CurrentUser() user: { id: number },
    @Body() dto: CreateTaskDto,
  ) {
    const task = await this.tasksService.create(user.id, dto);
    this.tasksGateway.emitTaskCreated(task);
    return task;
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number },
    @Body() dto: UpdateTaskDto,
  ) {
    const task = await this.tasksService.update(id, user.id, dto);
    this.tasksGateway.emitTaskUpdated(task);
    return task;
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number },
  ) {
    const result = await this.tasksService.remove(id, user.id);
    this.tasksGateway.emitTaskDeleted(id);
    return result;
  }
}
