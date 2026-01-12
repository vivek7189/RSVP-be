export interface RSVP {
  id: number;
  name: string;
  email: string;
  token: string;
  created_at: Date;
  updated_at: Date;
}

export interface RSVPPublic {
  id: number;
  name: string;
  email: string;
  created_at: Date;
}

export interface CreateRSVPRequest {
  name: string;
  email: string;
}

export interface UpdateRSVPRequest {
  name?: string;
  email?: string;
}

export interface DeleteRSVPRequest {
  token: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
