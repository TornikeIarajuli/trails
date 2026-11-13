import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

// Same shapes the Expo server SDK accepts: ExponentPushToken[...], ExpoPushToken[...]
// or a bare UUID (legacy). Anything else would only make the push request fail later.
export const EXPO_PUSH_TOKEN =
  /^(?:Expo(?:nent)?PushToken\[[^[\]\s]{1,200}\]|[a-zA-Z\d]{8}-[a-zA-Z\d]{4}-[a-zA-Z\d]{4}-[a-zA-Z\d]{4}-[a-zA-Z\d]{12})$/;

export class RegisterTokenDto {
  @IsString()
  @MaxLength(255)
  @Matches(EXPO_PUSH_TOKEN, { message: 'token must be an Expo push token' })
  token: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  platform?: string;
}

export class RemoveTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  token: string;
}
