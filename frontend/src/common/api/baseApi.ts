// import { AxiosError } from 'axios';
// import {
//   ApiResponse,
//   createErrorResponse,
//   createSuccessResponse,
// } from './apiResponse';
// import { HttpStatus } from '../enums/ErrorTypeEnum';

// export class BaseApi {
//   constructor() {}

//   protected async handleRequest<T>(
//     request: () => Promise<T>
//   ): Promise<ApiResponse<T>> {
//     try {
//       const data = await request();
//       return createSuccessResponse(data);
//     } catch (error: any) {
//       let backendMessage = 'An unexpected error occurred.';

//       if ((error as AxiosError).isAxiosError) {
//         const axiosError = error as AxiosError;

//         if (!axiosError.response) {
//           backendMessage =
//             axiosError.message ||
//             'Network error. Please check your connection.';
//         } else {
//           const status = axiosError.response.status;
//           const data = axiosError.response.data as any;

//           backendMessage = data?.message || data?.error || backendMessage;

//           switch (status) {
//             case HttpStatus.UNAUTHORIZED:
//               return createErrorResponse(
//                 data?.message ||
//                   'Your session has expired. Please log in again.'
//               );
//             case HttpStatus.FORBIDDEN:
//               return createErrorResponse(
//                 data?.message ||
//                   'You do not have permission to perform this action.'
//               );
//             case HttpStatus.BAD_REQUEST:
//               return createErrorResponse(
//                 data?.message || 'Invalid request data.'
//               );
//             case HttpStatus.NOT_FOUND:
//               return createErrorResponse(
//                 data?.message || 'Resource not found.'
//               );
//             case 412:
//               return createErrorResponse(
//                 data?.message || 'Precondition failed.'
//               );
//             case HttpStatus.INTERNAL_SERVER_ERROR:
//               return createErrorResponse(
//                 data?.message || 'Server error. Please try again later.'
//               );
//             default:
//               return createErrorResponse(backendMessage);
//           }
//         }
//       }

//       return createErrorResponse(backendMessage);
//     }
//   }
// }