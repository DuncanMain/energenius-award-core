export type ApiResponse<T> = {
  data: T | null;
  error: string | null;
  success: boolean;
};

export const createSuccessResponse = <T>(data: T): ApiResponse<T> => ({
  data,
  error: null,
  success: true,
});

export const createErrorResponse = <T>(error: string): ApiResponse<T> => ({
  data: null,
  error,
  success: false,
});
