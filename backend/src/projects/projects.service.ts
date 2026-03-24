import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  /** All projects the user is a member of */
  async findMyProjects(userId: number) {
    return this.prisma.project.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: { include: { user: { select: { id: true, email: true } } } },
        _count: { select: { tasks: true, members: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** All public projects (for discovery / browse) */
  async findAll() {
    return this.prisma.project.findMany({
      include: {
        members: { include: { user: { select: { id: true, email: true } } } },
        _count: { select: { tasks: true, members: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        members: {
          include: { user: { select: { id: true, email: true } } },
          orderBy: { joinedAt: 'asc' },
        },
        tasks: {
          include: { user: { select: { email: true } } },
          orderBy: { createdAt: 'desc' },
        },
        joinRequests: {
          where: { status: 'PENDING' },
          include: { user: { select: { id: true, email: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async create(userId: number, dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        members: {
          create: { userId, role: 'OWNER' },
        },
      },
      include: {
        members: { include: { user: { select: { id: true, email: true } } } },
        _count: { select: { tasks: true, members: true } },
      },
    });
  }

  async update(id: number, userId: number, dto: UpdateProjectDto) {
    await this.assertOwner(id, userId);

    return this.prisma.project.update({
      where: { id },
      data: dto,
      include: {
        members: { include: { user: { select: { id: true, email: true } } } },
        _count: { select: { tasks: true, members: true } },
      },
    });
  }

  async remove(id: number, userId: number) {
    await this.assertOwner(id, userId);
    await this.prisma.project.delete({ where: { id } });
    return { deleted: true };
  }

  /* ─── Join Requests ─── */

  async requestJoin(projectId: number, userId: number) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Project not found');

    // Already a member?
    const existing = await this.prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    });
    if (existing) throw new ConflictException('Already a member');

    // Already requested?
    const existingReq = await this.prisma.joinRequest.findUnique({
      where: { userId_projectId: { userId, projectId } },
    });
    if (existingReq && existingReq.status === 'PENDING') {
      throw new ConflictException('Request already pending');
    }

    // upsert so rejected users can re-request
    return this.prisma.joinRequest.upsert({
      where: { userId_projectId: { userId, projectId } },
      update: { status: 'PENDING' },
      create: { userId, projectId, status: 'PENDING' },
      include: { user: { select: { id: true, email: true } } },
    });
  }

  async acceptRequest(requestId: number, ownerId: number) {
    const req = await this.prisma.joinRequest.findUnique({
      where: { id: requestId },
      include: { project: true, user: { select: { id: true, email: true } } },
    });

    if (!req) throw new NotFoundException('Request not found');
    await this.assertOwner(req.projectId, ownerId);

    await this.prisma.$transaction([
      this.prisma.joinRequest.update({
        where: { id: requestId },
        data: { status: 'ACCEPTED' },
      }),
      this.prisma.projectMember.create({
        data: { userId: req.userId, projectId: req.projectId, role: 'MEMBER' },
      }),
    ]);

    return { accepted: true, projectId: req.projectId, userId: req.userId, userEmail: req.user.email };
  }

  async rejectRequest(requestId: number, ownerId: number) {
    const req = await this.prisma.joinRequest.findUnique({
      where: { id: requestId },
      include: { project: true },
    });

    if (!req) throw new NotFoundException('Request not found');
    await this.assertOwner(req.projectId, ownerId);

    await this.prisma.joinRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED' },
    });

    return { rejected: true, projectId: req.projectId, userId: req.userId };
  }

  async removeMember(projectId: number, memberId: number, ownerId: number) {
    await this.assertOwner(projectId, ownerId);

    const member = await this.prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: memberId, projectId } },
    });
    if (!member) throw new NotFoundException('Member not found');
    if (member.role === 'OWNER') throw new ForbiddenException('Cannot remove owner');

    await this.prisma.projectMember.delete({
      where: { id: member.id },
    });

    return { removed: true };
  }

  /* ─── Helpers ─── */

  private async assertOwner(projectId: number, userId: number) {
    const membership = await this.prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    });

    if (!membership || membership.role !== 'OWNER') {
      throw new ForbiddenException('Only the project owner can do this');
    }
  }
}
