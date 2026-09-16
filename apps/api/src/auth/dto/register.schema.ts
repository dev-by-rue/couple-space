/**
 * Re-export shared register schema from domain.
 * Single source of truth for password policy + profile fields.
 */
export {
  registerSchema,
  type RegisterInput,
} from "@couple-space/domain";
