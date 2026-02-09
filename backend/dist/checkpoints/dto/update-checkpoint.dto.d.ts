import { CreateCheckpointDto } from './create-checkpoint.dto';
declare const UpdateCheckpointDto_base: import("@nestjs/mapped-types").MappedType<Partial<Omit<CreateCheckpointDto, "trail_id">>>;
export declare class UpdateCheckpointDto extends UpdateCheckpointDto_base {
}
export {};
