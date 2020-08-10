/**
 * 回调函数类型
 */
interface ClassicFunctionParams<S extends any = any, F extends any = any> {
  success?: (arg: S) => any;
  fail?: (arg: F) => any;
}

/**
 * 允许传入空值
 */
type Parameters<T extends undefined | ((...args: any) => any)> = T extends (...args: infer P) => any
  ? P
  : never;

/**
 * 除去 success 和 fail 的其他类型
 */
type OmitedClassicFunctionParams<C extends ClassicFunctionParams> = {
  [K in keyof Omit<C, keyof ClassicFunctionParams>]: C[K];
};

/**
 * 入参回调函数类型
 */
type ClassicFunction<T extends ClassicFunctionParams> = (param: T) => void;

interface Success<F extends ClassicFunctionParams> {
  ok: true;
  data: Parameters<F['success']>[0];
}

interface Fail<F extends ClassicFunctionParams> {
  ok: false;
  data: Parameters<F['fail']>[0];
}

/**
 * 判断返回值是否执行成功
 * @param res 调用 promisify 返回的结果
 */
export function isSuccess<T extends ClassicFunctionParams>(
  res: Success<T> | Fail<T>,
): res is Success<T> {
  return res.ok;
}

/**
 * 转化回调为 promise 方法
 * @param fn 入参回调函数
 */
export function promisify<T extends ClassicFunctionParams>(fn: ClassicFunction<T>) {
  return (options: OmitedClassicFunctionParams<T>) =>
    new Promise<Success<T> | Fail<T>>((resolve) => {
      fn({
        ...(options as any),
        success(data) {
          resolve({ ok: true, data });
        },
        fail(data) {
          resolve({ ok: false, data });
        },
      });
    });
}
