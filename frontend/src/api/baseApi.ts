import { createSuccessResponse } from './apiResponse';
import { ApiResponse } from './apiResponse';
import { createErrorResponse } from './apiResponse';

export abstract class BaseApi {
  protected async handleRequest<T>(
    request: () => Promise<Response>
  ): Promise<ApiResponse<T>> {
    try {
      const response = await request();
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const message =
          errorData?.message?.message ||
          errorData?.error ||
          'Something went wrong.';
        switch (response.status) {
          case 401:
            return createErrorResponse(
              message || 'Your session has expired. Please log in again.'
            );
          case 403:
            return createErrorResponse(
              message || 'You do not have permission to perform this action.'
            );
          case 400:
            return createErrorResponse(message || 'Invalid request data.');
          case 404:
            return createErrorResponse(message || 'Resource not found.');
          case 500:
            return createErrorResponse(
              message || 'Server error. Please try again later.'
            );
          default:
            return createErrorResponse(message);
        }
      }

      const data: T = await response.json();
      return createSuccessResponse(data);
    } catch (error: any) {
      console.log(error);
      return createErrorResponse(
        error.message || 'Network error. Please check connection.'
      );
    }
  }
}
