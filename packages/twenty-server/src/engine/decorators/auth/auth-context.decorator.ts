import {
  type ExecutionContext,
  ForbiddenException,
  createParamDecorator,
} from '@nestjs/common';

import { getRequest } from 'src/utils/extract-request';
import { type AuthContextType } from 'src/engine/types/auth-context.type';

interface DecoratorOptions {
  allowUndefined?: boolean;
}

export const AuthContext = createParamDecorator(
  (options: DecoratorOptions | undefined, ctx: ExecutionContext) => {
    const request = getRequest(ctx);

    // Build the auth context from the request object
    const authContext: AuthContextType = {
      user: request.user,
      apiKey: request.apiKey,
      workspace: request.workspace,
      application: request.application,
      userWorkspaceId: request.userWorkspaceId,
      workspaceMemberId: request.workspaceMemberId,
      userWorkspace: request.userWorkspace,
      workspaceMember: request.workspaceMember,
      authProvider: request.authProvider,
      impersonationContext: request.impersonationContext,
    };

    if (!options?.allowUndefined && !authContext.workspace) {
      throw new ForbiddenException(
        "You're not authorized to do this. No workspace context found.",
      );
    }

    return authContext;
  },
);
