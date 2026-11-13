import { PickType } from '@nestjs/mapped-types';
import { SignupDto } from './signup.dto';

/** Same password rules as sign-up. */
export class UpdatePasswordDto extends PickType(SignupDto, [
  'password',
] as const) {}
