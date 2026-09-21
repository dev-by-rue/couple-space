/**
 * Re-export shared invitation schema from domain.
 * Nest keeps this path so controllers/services do not import package paths ad hoc.
 */
export {
  createInvitationSchema,
  type CreateInvitationInput,
} from "@couple-space/domain";
