import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateCheckpointDto } from './create-checkpoint.dto';

export class UpdateCheckpointDto extends PartialType(
  OmitType(CreateCheckpointDto, ['trail_id'] as const),
) {}
