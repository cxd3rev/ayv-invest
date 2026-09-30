const onPages = process.env.NEXT_PUBLIC_GITHUB_PAGES === "true";

function hosted(browserPath: string, absolute: string, path: string) {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  if (onPages || typeof window === "undefined") return `${absolute}${suffix}`;
  return `${browserPath}${suffix}`;
}

export function yahooUrl(path: string) {
  return hosted("/yahoo", "https://query1.finance.yahoo.com", path);
}

export function frankfurterUrl(path: string) {
  return hosted("/frankfurter", "https://api.frankfurter.app", path);
}
