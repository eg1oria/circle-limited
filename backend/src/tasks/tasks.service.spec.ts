import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from './tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('TasksService', () => {
  let service: TasksService;
  let prisma: {
    task: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      task: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [TasksService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return tasks for the user', async () => {
      const tasks = [{ id: 1, title: 'Test', userId: 1 }];
      prisma.task.findMany.mockResolvedValue(tasks);

      const result = await service.findAll(1);
      expect(result).toEqual(tasks);
      expect(prisma.task.findMany).toHaveBeenCalledWith({
        where: { userId: 1 },
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { email: true } } },
      });
    });
  });

  describe('create', () => {
    it('should create a task', async () => {
      const dto = { title: 'New Task', description: 'Desc' };
      const created = { id: 1, ...dto, userId: 1, status: 'TODO' };
      prisma.task.create.mockResolvedValue(created);

      const result = await service.create(1, dto);
      expect(result).toEqual(created);
    });
  });

  describe('update', () => {
    it('should throw NotFoundException if task not found', async () => {
      prisma.task.findUnique.mockResolvedValue(null);
      await expect(service.update(99, 1, { title: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user does not own task', async () => {
      prisma.task.findUnique.mockResolvedValue({ id: 1, userId: 2 });
      await expect(service.update(1, 1, { title: 'X' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should update the task', async () => {
      prisma.task.findUnique.mockResolvedValue({ id: 1, userId: 1 });
      prisma.task.update.mockResolvedValue({
        id: 1,
        title: 'Updated',
        userId: 1,
      });

      const result = await service.update(1, 1, { title: 'Updated' });
      expect(result.title).toBe('Updated');
    });
  });

  describe('remove', () => {
    it('should throw NotFoundException if task not found', async () => {
      prisma.task.findUnique.mockResolvedValue(null);
      await expect(service.remove(99, 1)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user does not own task', async () => {
      prisma.task.findUnique.mockResolvedValue({ id: 1, userId: 2 });
      await expect(service.remove(1, 1)).rejects.toThrow(ForbiddenException);
    });

    it('should delete task', async () => {
      prisma.task.findUnique.mockResolvedValue({ id: 1, userId: 1 });
      prisma.task.delete.mockResolvedValue({ id: 1 });

      const result = await service.remove(1, 1);
      expect(result).toEqual({ deleted: true });
    });
  });
});
