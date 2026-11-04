/** Expected business-rule violation; message is safe to show to users. */
export class BusinessError extends Error {}
/** Authentication / authorization failure; message is safe to show to users. */
export class AuthError extends Error {}
