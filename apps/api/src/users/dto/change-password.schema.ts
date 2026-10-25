/**
 * Re-export shared change-password schema from domain.
 * Uses the same password policy as register.
 */
export {
  changePasswordSchema,
  type ChangePasswordInput,
} from "@couple-space/domain";
