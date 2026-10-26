import { z } from "zod";

export const DEFAULT_PAGE_LIMIT = 5;
export const MAX_PAGE_LIMIT = 50;

export const paginationQuery = z
  .object({
    limit: z.string().optional(),
    page: z.string().optional(),
  })
  .transform(({ limit, page }) => {
    const parsedLimit = parseInt(limit ?? "", 10);
    const parsedPage = parseInt(page ?? "", 10);
    return {
      limit: Number.isNaN(parsedLimit) || parsedLimit < 1 ? DEFAULT_PAGE_LIMIT : Math.min(parsedLimit, MAX_PAGE_LIMIT),
      page: Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage,
    };
  });

export type PaginationQuery = z.output<typeof paginationQuery>;

export interface PaginatedResponse<T> {
  data: T[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}
