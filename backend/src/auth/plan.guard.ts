import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class PlanGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user;
    if (!user) return false;
    if (user.plan === 'free') {
      throw new ForbiddenException('This feature requires a Pro plan. Please upgrade.');
    }
    return true;
  }
}
