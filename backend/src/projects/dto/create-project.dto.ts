import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty({ message: 'Project name cannot be empty' })
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;
}
