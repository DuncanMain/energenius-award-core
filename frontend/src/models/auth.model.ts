export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  user: User;
}

export interface CurrentUserResponse {
  id: string;
  name: string;
  email: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
}