const APP_CHROME_HIDDEN_ROUTES = new Set(["/login", "/privacy", "/account-deletion"]);

export function isAppChromeHiddenRoute(pathname: string) {
  return APP_CHROME_HIDDEN_ROUTES.has(pathname);
}

