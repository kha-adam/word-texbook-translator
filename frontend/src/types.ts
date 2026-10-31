export type FileItem = {
  id: number;
  filename: string;
  size: number;
  mime_type: string;
  sha256: string;
  created_at: string;
};

export type FileListResponse = {
  items: FileItem[];
  limit: number;
  offset: number;
  total: number;
};

export type Point = {
  x: number;
  y: number;
  pressure: number;
};

export type Stroke = {
  id: string;
  points: Point[];
  color: string;
};

export type StrokeOut = {
  id: string;
  page: number;
  points: [number, number, number][];
  color: string;
};

export type AuthTokenResponse = {
  access_token: string;
  token_type: string;
};
