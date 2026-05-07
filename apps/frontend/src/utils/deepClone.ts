/**
 * Deep clone utility using JSON serialization.
 *
 * Note: This approach loses circular references, undefined values, Dates, and Functions.
 * For our use case (dashboard state serialization), this is acceptable since:
 * - Dashboard state is acyclic
 * - Undefined values should be cleaned up anyway
 * - Dates are serialized to ISO strings
 * - Functions have no place in persisted state
 *
 * If deep structural cloning of complex nested objects with non-JSON types is needed,
 * consider using a library like lodash.cloneDeep.
 */
export const deepClone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
