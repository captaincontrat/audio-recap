import { z } from "zod";

import { MIN_PASSWORD_LENGTH } from "./password";

// Shared schemas used by both server-side services (authoritative validation)
// and `react-hook-form` + `@hookform/resolvers/zod` on the browser for
// immediate UX feedback. Keeping them in one module prevents the client and
// server from drifting out of sync.

export const emailSchema = z.string().trim().min(1, "Email is required").email("Enter a valid email address");

export const passwordSchema = z.string().min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);

export const signUpInputSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().max(120, "Name is too long").optional(),
});

export const signInInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordInputSchema = z.object({
  email: emailSchema,
});

export const resetPasswordInputSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: passwordSchema,
});

export const verifyEmailInputSchema = z.object({
  token: z.string().min(1, "Verification token is required"),
});

export const resendVerificationInputSchema = z.object({
  email: emailSchema.optional(),
});

export type SignUpInput = z.infer<typeof signUpInputSchema>;
export type SignInInput = z.infer<typeof signInInputSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordInputSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordInputSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailInputSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationInputSchema>;
