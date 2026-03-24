import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service.js';
import { ProjectsController } from './projects.controller.js';
import { ProjectsGateway } from './projects.gateway.js';

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectsGateway],
})
export class ProjectsModule {}
