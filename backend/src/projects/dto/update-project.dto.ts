import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class UpdateProjectDto {
  @IsString()
  @IsNotEmpty({ message: 'Project name cannot be empty' })
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
