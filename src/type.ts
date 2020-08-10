/**
 * Construct a type with the properties of T except for those in type K.
 */
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

/**
 * Obtain the return type of a promise function type
 */
export type ReturnPromiseType<T> = T extends (...args: any) => Promise<infer P> ? P : never;

/**
 * From T, pick a set of values types
 */
export type ValueOf<T extends Record<string, any>> = keyof T extends infer K
  ? K extends keyof T
    ? T[K]
    : never
  : never;

/**
 * Exclude from T those types that are assignable to function or E
 */
export type NonFunctionProperties<
  T extends Record<string, any>,
  E extends keyof T = never
> = keyof T extends infer K
  ? K extends keyof T
    ? T[K] extends (...arg: any) => any
      ? never
      : K extends E
      ? never
      : K
    : never
  : never;

/**
 * Exclude from F those types that are assignable to function or E
 */
export type OmitFunctionProperties<F extends Record<string, any>, E extends keyof F = never> = {
  [K in NonFunctionProperties<F, E>]: F[K];
};

/**
 * From T, pick a set of properties whose values are assignable to function
 */
export type FunctionProperties<T extends Record<string, any>> = keyof T extends infer K
  ? K extends keyof T
    ? T[K] extends (...arg: any) => any
      ? K
      : never
    : never
  : never;

/**
 * Pick from T those types that are assignable to function
 */
export type PickFunctionProperties<F extends Record<string, any>> = {
  [K in FunctionProperties<F>]: F[K];
};
