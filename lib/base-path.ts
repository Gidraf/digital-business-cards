/**
 * The cards app is mounted under a sub-path so it can share one domain with
 * Reactive Resume (RxResume owns the root; see deploy/nginx/cards.gidraf.dev.conf).
 *
 * Next applies `basePath` automatically to <Link>, the router and route
 * handlers — but NOT to raw fetch() URLs, next/image `src`, or hard
 * `window.location` assignments. Use withBase() for those.
 *
 * Must match `basePath` in next.config.ts.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "/cards";

/** Prefix an app-absolute path with the base path ("/login" → "/cards/login"). */
export function withBase(path: string): string {
	if (!path.startsWith("/")) return path;
	if (BASE_PATH && path.startsWith(`${BASE_PATH}/`)) return path;
	return `${BASE_PATH}${path}`;
}

/**
 * Links into the CV app, which sits at the domain root.
 *
 * They go through its SSO entry rather than straight to the page: that reads
 * the shared `cvpap_token` cookie, asks CVPAP who it belongs to and starts the
 * matching Reactive Resume session, so CVPAP stays the only login channel.
 * Use plain <a> for these — <Link> would prefix them with the base path.
 */
function ssoTo(path: string): string {
	return `/api/sso/cvpap?next=${encodeURIComponent(path)}`;
}

export const RESUME_APP = {
	dashboard: ssoTo("/dashboard"),
	builder: (resumeId: string) => ssoTo(`/builder/${resumeId}`),
	/** clears the Reactive Resume session, then returns to the cards login */
	logout: "/api/sso/logout",
} as const;
