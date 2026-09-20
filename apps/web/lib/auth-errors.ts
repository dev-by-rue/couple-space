const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "Invalid email or password.",
  email_taken: "An account with this email already exists.",
  dev_auth_disabled:
    "Account created, but email verification is unavailable. Try logging in.",
  resend_rate_limited:
    "Too many verification emails sent. Please wait before trying again.",
  invalid_or_expired_token:
    "This verification link has expired or is invalid.",
};

export function friendlyAuthErrorMessage(message: string | undefined): string {
  if (!message) {
    return "Something went wrong. Please try again.";
  }

  for (const [reason, friendly] of Object.entries(AUTH_ERROR_MESSAGES)) {
    if (message.includes(reason)) {
      return friendly;
    }
  }

  return message;
}
