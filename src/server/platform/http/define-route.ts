import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/server/platform/env";
import { BadRequestError, TooManyRequestsError, UnauthorizedError, toErrorResponse } from "./errors";

export type RouteAuth = "user" | "cron" | "public";
export type ThrottleTier = "standard";

export interface RouteOptions<A, B, Q, P> {
  name: string;
  auth: A;
  body?: z.ZodType<B> | null;
  query?: z.ZodType<Q>;
  params?: z.ZodType<P>;
  throttle?: ThrottleTier | null;
  status?: 200 | 201;
}

export interface RouteContext<A, B, Q, P> {
  request: Request;
  userId: A extends "user" ? string : undefined;
  body: B;
  query: Q;
  params: P;
}

export type DefinedRoute = ((
  request: Request,
  segment?: { params: Promise<Record<string, string>> }
) => Promise<Response>) & { definition: RouteOptions<RouteAuth, unknown, unknown, unknown> };

interface DefineRouteDeps {
  requireUserId: () => Promise<string>;
  limit: (identifier: string) => Promise<{ success: boolean }>;
}

export const idParams = z.object({ id: z.string() });

const sha256 = (value: string) => createHash("sha256").update(value).digest();

function assertCronAuthorized(request: Request): void {
  const provided = request.headers.get("authorization") ?? "";
  if (!timingSafeEqual(sha256(provided), sha256(`Bearer ${env.CRON_SECRET}`))) {
    throw new UnauthorizedError();
  }
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new BadRequestError("Invalid JSON body");
  }
}

export function createDefineRoute(deps: DefineRouteDeps) {
  return function defineRoute<
    A extends RouteAuth,
    B = undefined,
    Q = undefined,
    P = undefined,
    T = unknown,
  >(
    options: RouteOptions<A, B, Q, P>,
    handler: (ctx: RouteContext<A, B, Q, P>) => Promise<T | Response>
  ): DefinedRoute {
    const route = async (
      request: Request,
      segment?: { params: Promise<Record<string, string>> }
    ): Promise<Response> => {
      try {
        let userId: string | undefined;
        if (options.auth === "user") {
          userId = await deps.requireUserId();
          if (options.throttle === "standard") {
            const { success } = await deps.limit(userId);
            if (!success) throw new TooManyRequestsError();
          }
        } else if (options.auth === "cron") {
          assertCronAuthorized(request);
        }

        const rawParams = (await segment?.params) ?? {};
        const params = (options.params ? options.params.parse(rawParams) : undefined) as P;

        const rawQuery = Object.fromEntries(new URL(request.url).searchParams);
        const query = (options.query ? options.query.parse(rawQuery) : undefined) as Q;

        const body = (options.body ? options.body.parse(await readJsonBody(request)) : undefined) as B;

        const result = await handler({
          request,
          userId: userId as RouteContext<A, B, Q, P>["userId"],
          body,
          query,
          params,
        });
        if (result instanceof Response) return result;
        return NextResponse.json(result, { status: options.status ?? 200 });
      } catch (err) {
        return toErrorResponse(err, options.name);
      }
    };
    return Object.assign(route, {
      definition: options as RouteOptions<RouteAuth, unknown, unknown, unknown>,
    });
  };
}
