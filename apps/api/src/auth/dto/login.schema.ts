/**
 * Re-export shared login schema from domain.
 * Nest keeps this path so controllers/services do not import package paths ad hoc.
 */
export {
  loginSchema,
  type LoginInput,
} from "@couple-space/domain";
