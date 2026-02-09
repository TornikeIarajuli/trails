"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateCheckpointDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_checkpoint_dto_1 = require("./create-checkpoint.dto");
class UpdateCheckpointDto extends (0, mapped_types_1.PartialType)((0, mapped_types_1.OmitType)(create_checkpoint_dto_1.CreateCheckpointDto, ['trail_id'])) {
}
exports.UpdateCheckpointDto = UpdateCheckpointDto;
//# sourceMappingURL=update-checkpoint.dto.js.map