/**
 * Header middleware.ts forwards to the root layout so it knows the request
 * pathname. Root layouts render for every route and get no pathname prop of
 * their own — this header is how a standalone campaign microsite (e.g.
 * /raffle/*) can opt out of the Academy shop chrome. Kept in its own file
 * (rather than middleware.ts) so app/layout.tsx doesn't need to import
 * next/server just to read one constant.
 */
export const PATHNAME_HEADER = "x-livapon-pathname";
