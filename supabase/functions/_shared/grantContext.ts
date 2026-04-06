/**
 * _shared/grantContext.ts
 * Re-export barrel -- all named exports from the focused sub-modules below.
 *
 * Existing imports continue to work unchanged. New code should import directly
 * from the sub-module for better traceability:
 *
 *   import { buildProfileContext }   from "../_shared/profile.ts"
 *   import { buildCriteriaBlock }     from "../_shared/criteria.ts"
 *   import { crawlUrl }               from "../_shared/crawl.ts"
 *   import { getSemanticVaultBlock }  from "../_shared/vault.ts"
 *   import { getCompanyBlock, ... }   from "../_shared/grantData.ts"
 */

export * from "./profile.ts";
export * from "./criteria.ts";
export * from "./crawl.ts";
export * from "./vault.ts";
export * from "./grantData.ts";
