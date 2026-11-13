import { IsEmail, MaxLength } from 'class-validator';

export class EmailDto {
  @IsEmail()
  @MaxLength(254)
  email: string;
}
