import { IsNumber, Max, Min, ValidateIf } from 'class-validator';
import { IsLooseUuid } from '../../common/validators/is-loose-uuid';

export class SosDto {
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-180)
  @Max(180)
  lng: number;
}

export class EmergencyContactDto {
  /** A user id, or an explicit `null` to remove the contact. */
  @ValidateIf((_, value) => value !== null)
  @IsLooseUuid()
  contact_user_id: string | null;
}
