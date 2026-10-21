/**
 * Re-export shared push schemas from domain.
 * Nest keeps this path so controllers/services do not import package paths ad hoc.
 */
export {
  pushSubscriptionSchema,
  removePushSubscriptionSchema,
  type PushSubscriptionInput,
  type RemovePushSubscriptionInput,
} from "@couple-space/domain";
