export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? '/app').replace(/\/+$/, '');

export function apiUrl(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_PATH}${clean}`;
}

export function assetUrl(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_PATH}${clean}`;
}
