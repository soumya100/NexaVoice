import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { PermissionAction, SystemRole } from '@nexavoice/domain-types';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const PERMISSIONS_KEY = 'requiredPermissions';
export const RequirePermissions = (...permissions: PermissionAction[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const ROLES_KEY = 'requiredRoles';
export const RequireRoles = (...roles: SystemRole[]) =>
  SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    // Support both HTTP and GraphQL contexts
    const gqlCtx = GqlExecutionContext.create(context);
    const gqlReq = gqlCtx.getContext()?.req;
    if (gqlReq) {
      return gqlReq.user;
    }
    const httpReq = context.switchToHttp().getRequest();
    return httpReq.user;
  },
);

export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const gqlCtx = GqlExecutionContext.create(context);
    const gqlReq = gqlCtx.getContext()?.req;
    if (gqlReq) {
      return gqlReq.session;
    }
    const httpReq = context.switchToHttp().getRequest();
    return httpReq.session;
  },
);
