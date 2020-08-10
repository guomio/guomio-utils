import { AxiosRequestConfig } from 'axios';
import { sleep } from '../util';
import { CustomOptions } from './index';

type Retry<T> = (
  opts?: AxiosRequestConfig,
  customOpts?: CustomOptions,
) => Promise<ResponseHelper<T>>;

export class ResponseHelper<T extends any = any> {
  options: AxiosRequestConfig;
  /**
   * 获取返回值
   */
  data: T;
  /**
   * 重试
   */
  retry?: Retry<T>;
  /**
   * 判断返回值是否合法
   */
  isValid = false;
  /**
   * 错误信息
   */
  message = '';

  constructor(options: AxiosRequestConfig, data: T, retry?: Retry<T>) {
    this.options = options || {};
    this.data = data;
    this.retry = retry;
  }

  /**
   * 判断返回值是否不合法
   */
  get isNotValid() {
    return !this.isValid;
  }

  /**
   * 重试多次
   */
  retryUtil = async (times: number = 2, timeout: number = 2000): Promise<ResponseHelper<T>> => {
    if (!this.retry) return this;

    while (times > 0) {
      await sleep(timeout);
      times--;
      const res = await this.retry();
      if (res.isValid) {
        return res;
      }
    }
    return this;
  };
}
