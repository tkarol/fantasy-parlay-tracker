/**
 * Which domain the Google sign-in handshake runs on.
 *
 * `signInWithRedirect` stashes its pending state in browser storage keyed to
 * `authDomain`, then reads it back after bouncing through Google. When
 * `authDomain` is a *different* origin from the page — the default, where the
 * app is served from `<project>.web.app` but `authDomain` is
 * `<project>.firebaseapp.com` — that write and that read land in two different
 * storage partitions on any browser that partitions third-party storage.
 * Safari has done so by default since 16.1, as has Chrome with third-party
 * cookies blocked. The state is never found and sign-in dies with "Unable to
 * process request due to missing initial state".
 *
 * It bites hardest on iPhones, which block pop-ups by default: the pop-up
 * flow is refused, the code falls back to a redirect, and the redirect is the
 * broken one. That combination is the factory setting, so it is close to every
 * new member rather than an edge case.
 *
 * Firebase Hosting serves the `/__/auth/handler` endpoint on every domain in
 * the project, so pointing `authDomain` at the domain already being viewed
 * keeps the whole handshake first-party and there is nothing to partition.
 */
export function resolveAuthDomain(
  hostname: string,
  projectId: string,
  configured: string,
): string {
  // Only the project's own Hosting domains. A preview channel or a custom
  // domain serves the handler too, but its redirect URI is not registered with
  // the OAuth client, so redirecting there would fail a different way.
  const hosted = [`${projectId}.web.app`, `${projectId}.firebaseapp.com`];
  return hosted.includes(hostname) ? hostname : configured;
}
