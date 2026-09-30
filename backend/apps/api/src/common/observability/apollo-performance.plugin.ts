import { ApolloServerPlugin, GraphQLRequestListener } from '@apollo/server';
import { Plugin } from '@nestjs/apollo';
import { RequestPerformanceContext } from './request-performance.context';

@Plugin()
export class ApolloPerformancePlugin implements ApolloServerPlugin {
  async requestDidStart(requestContext: any): Promise<GraphQLRequestListener<any>> {
    const rawReq = requestContext.contextValue?.req;
    const rawRes = requestContext.contextValue?.res;

    const opName = requestContext.request.operationName || 'AnonymousOperation';
    let perf = RequestPerformanceContext.current();

    if (!perf) {
      perf = new RequestPerformanceContext('/graphql', opName, 'POST', rawReq?.headers?.['x-request-id']);
      if (rawReq) {
        rawReq._perf = perf;
      }
    } else {
      perf.operation = opName;
    }

    return {
      async willSendResponse(_resContext: any) {
        const perfCtx = RequestPerformanceContext.current() || rawReq?._perf;
        if (perfCtx) {
          perfCtx.finalize(rawRes);
        }
      },
    };
  }
}
