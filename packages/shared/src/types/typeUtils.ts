/**
 * Shared compile-time assertion utilities for schema validation.
 *
 * Used across all schema files to verify bidirectional type compatibility
 * between hand-written interfaces and Zod schema outputs.
 */

/** Causes a compile error if T is not `true`. */
export type Expect<T extends true> = T;

/**
 * Recursively strips `readonly` from all properties.
 * Needed because hand-written types use `readonly` arrays/properties,
 * but Zod `.infer` produces mutable types. Without this, the reverse
 * direction check (`Interface extends ZodOutput`) fails on readonly arrays.
 */
export type Mutable<T> = T extends ReadonlyMap<infer K, infer V>
  ? Map<Mutable<K>, Mutable<V>>
  : T extends ReadonlySet<infer U>
    ? Set<Mutable<U>>
    : T extends readonly (infer U)[]
      ? Mutable<U>[]
      : T extends object
        ? { -readonly [K in keyof T]: Mutable<T[K]> }
        : T;
