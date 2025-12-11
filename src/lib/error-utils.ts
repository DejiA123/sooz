import { toast } from "sonner";

export interface AppError extends Error {
  code?: string;
  userMessage?: string;
  technicalDetails?: string;
}

export const ErrorCodes = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  PERMISSION_ERROR: 'PERMISSION_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export const ErrorMessages = {
  [ErrorCodes.NETWORK_ERROR]: {
    title: 'Connection Error',
    message: 'Unable to connect to the server. Please check your internet connection and try again.',
  },
  [ErrorCodes.AUTH_ERROR]: {
    title: 'Authentication Error',
    message: 'Please sign in to continue.',
  },
  [ErrorCodes.PERMISSION_ERROR]: {
    title: 'Permission Denied',
    message: 'You don\'t have permission to perform this action.',
  },
  [ErrorCodes.VALIDATION_ERROR]: {
    title: 'Validation Error',
    message: 'Please check your input and try again.',
  },
  [ErrorCodes.NOT_FOUND_ERROR]: {
    title: 'Not Found',
    message: 'The requested content could not be found.',
  },
  [ErrorCodes.SERVER_ERROR]: {
    title: 'Server Error',
    message: 'Something went wrong on our end. Please try again later.',
  },
  [ErrorCodes.UNKNOWN_ERROR]: {
    title: 'Something went wrong',
    message: 'An unexpected error occurred. Please try again.',
  },
} as const;

export function createError(error: unknown, code?: string): AppError {
  if (error instanceof Error) {
    return {
      ...error,
      name: 'AppError',
      code: code || ErrorCodes.UNKNOWN_ERROR,
      userMessage: ErrorMessages[code as keyof typeof ErrorMessages]?.message || error.message,
      technicalDetails: error.stack,
    };
  }
  
  return {
    name: 'AppError',
    message: 'An unknown error occurred',
    code: code || ErrorCodes.UNKNOWN_ERROR,
    userMessage: ErrorMessages[ErrorCodes.UNKNOWN_ERROR].message,
  };
}

export function handleError(error: unknown, context?: string): AppError {
  const appError = createError(error);
  
  // Log to console for debugging
  console.error(`Error in ${context || 'unknown context'}:`, error);
  
  // Show user-friendly toast
  const errorMessage = ErrorMessages[appError.code as keyof typeof ErrorMessages];
  if (errorMessage) {
    toast.error(errorMessage.title, {
      description: errorMessage.message,
    });
  } else {
    toast.error('Error', {
      description: appError.userMessage || 'Something went wrong',
    });
  }
  
  return appError;
}

export function handleSupabaseError(error: any, context?: string): AppError {
  let code: keyof typeof ErrorCodes = 'UNKNOWN_ERROR';
  
  if (error?.code === 'PGRST116') {
    code = 'NOT_FOUND_ERROR';
  } else if (error?.code === '23505') {
    code = 'VALIDATION_ERROR';
  } else if (error?.code === '42501') {
    code = 'PERMISSION_ERROR';
  } else if (error?.message?.includes('JWT')) {
    code = 'AUTH_ERROR';
  } else if (error?.message?.includes('fetch')) {
    code = 'NETWORK_ERROR';
  }
  
  return handleError(error, context || ErrorCodes[code]);
}