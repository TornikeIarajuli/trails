import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** The bearer token AuthGuard / AdminGuard verified for this request. */
export const AccessToken = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.accessToken;
  },
);
