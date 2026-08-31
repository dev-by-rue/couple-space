import type { CoupleStatus } from "./couple-status.js";
export type CanActivateCoupleInput = {
    coupleStatus: CoupleStatus;
    activeMemberships: Array<{
        emailVerified: boolean;
    }>;
};
export type CanActivateCoupleResult = {
    ok: true;
} | {
    ok: false;
    reason: string;
};
export declare function canActivateCouple(input: CanActivateCoupleInput): CanActivateCoupleResult;
