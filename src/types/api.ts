export interface MesResponse<T> {
  trace_id: string;
  status_code: number;
  message: string;
  data: T;
}

export interface ApiError {
  trace_id?: string;
  status_code?: number;
  message: string;
  errors?: Array<{
    type?: string;
    loc?: (string | number)[];
    msg?: string;
  }>;
}
