/**
 * Reading back what was saved on the device. A stored copy may come from an
 * older version, be cut short, or be edited by hand, so nothing in it is
 * trusted until a sanitizer has checked it field by field.
 */

/** A stored copy of a `T` before it is checked: every field may be missing or hold anything. */
export type Stored<T> = { readonly [K in keyof T]?: unknown };

/** Whether a stored value is an object at all: the first check on any stored copy. */
export function isObject(value: unknown): value is Readonly<Record<PropertyKey, unknown>> {
  return typeof value === 'object' && value !== null;
}
