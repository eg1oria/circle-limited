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
import { ProjectsService } from './projects.service.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ProjectsGateway } from './projects.gateway.js';

@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly projectsGateway: ProjectsGateway,
  ) {}

  /** Browse all projects */
  @Get()
  findAll() {
    return this.projectsService.findAll();
  }

  /** Projects the current user belongs to */
  @Get('my')
  findMy(@CurrentUser() user: { id: number }) {
    return this.projectsService.findMyProjects(user.id);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.findOne(id);
  }

  @Post()
  async create(
    @CurrentUser() user: { id: number },
    @Body() dto: CreateProjectDto,
  ) {
    const project = await this.projectsService.create(user.id, dto);
    this.projectsGateway.emitProjectCreated(project as unknown as Record<string, unknown>);
    return project;
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number },
    @Body() dto: UpdateProjectDto,
  ) {
    const project = await this.projectsService.update(id, user.id, dto);
    this.projectsGateway.emitProjectUpdated(project as unknown as Record<string, unknown>);
    return project;
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number },
  ) {
    const result = await this.projectsService.remove(id, user.id);
    this.projectsGateway.emitProjectDeleted(id);
    return result;
  }

  /* ─── Join Requests ─── */

  @Post(':id/join')
  async requestJoin(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number; email: string },
  ) {
    const req = await this.projectsService.requestJoin(id, user.id);
    this.projectsGateway.emitJoinRequested({
      projectId: id,
      requestId: req.id,
      userId: user.id,
      userEmail: user.email,
    });
    return req;
  }

  @Post('requests/:requestId/accept')
  async acceptRequest(
    @Param('requestId', ParseIntPipe) requestId: number,
    @CurrentUser() user: { id: number },
  ) {
    const result = await this.projectsService.acceptRequest(requestId, user.id);
    this.projectsGateway.emitJoinAccepted({
      projectId: result.projectId,
      requestId,
      userId: result.userId,
      userEmail: result.userEmail,
    });
    return { accepted: true };
  }

  @Post('requests/:requestId/reject')
  async rejectRequest(
    @Param('requestId', ParseIntPipe) requestId: number,
    @CurrentUser() user: { id: number },
  ) {
    const result = await this.projectsService.rejectRequest(requestId, user.id);
    this.projectsGateway.emitJoinRejected({
      projectId: result.projectId,
      requestId,
      userId: result.userId,
    });
    return { rejected: true };
  }

  @Delete(':id/members/:memberId')
  async removeMember(
    @Param('id', ParseIntPipe) id: number,
    @Param('memberId', ParseIntPipe) memberId: number,
    @CurrentUser() user: { id: number },
  ) {
    const result = await this.projectsService.removeMember(id, memberId, user.id);
    this.projectsGateway.emitMemberRemoved({ projectId: id, userId: memberId });
    return result;
  }
}
