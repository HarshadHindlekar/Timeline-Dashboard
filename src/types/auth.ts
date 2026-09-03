export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface UserProfile {
  id: string;
  username: string;
  name: string;
  email: string;
  customer_id?: string;
  customer_name?: string;
  roles: string[];
  status?: string;
  designation_id?: string;
  designation_name?: string;
  department_id?: string;
  department_name?: string;
}

export interface AuthContextType {
  token: string | null;
  user: UserProfile | null;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

