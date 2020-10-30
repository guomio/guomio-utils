import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { isHTTP, combineURLs, isBrowser } from '../util';
import qs, { IStringifyOptions } from 'qs';
import { urlencodedParser, formParser } from './util';
import { ResponseHelper } from './response';
import { Cache } from './cache';
import jsonp from './jsonp';
import { DefaultAxiosInstance } from './axios';

const cache = new Cache<ResponseHelper<any>>();

export interface PostQuery<T extends Record<string, any>> {
  __query: T;
}

export type Method = AxiosRequestConfig['method'];

export type CustomOptions = {
  /**
   * 请求出错时用reject返回错误，需要设置捕获
   */
  withReject?: boolean;

  /**
   * 请求结果过期时间，缓存后下次请求将不被发起
   * 0 浏览器进程期间缓存(默认), >0 缓存时间(毫秒)
   */
  expire?: number;

  /**
   * 是否为 jsonp 请求
   */
  jsonp?: boolean;

  /**
   * x-www-form-urlencoded 提交
   * 对 FormData 使用时，不会转换 File 参数
   */
  urlencoded?: boolean;

  /**
   * multipart/form-data 提交
   */
  form?: boolean;

  /**
   * 返回值是否是二进制文件
   */
  blob?: boolean;
  /**
   * 返回值是否是二进制流
   */
  stream?: boolean;

  /**
   * 格式化 url 中数组规则 (default: 'repeat')
   */
  arrayFormat?: IStringifyOptions['arrayFormat'];
};

export interface ApiConfig extends AxiosRequestConfig {}

export type ApiInstance<T extends any = any> = (
  config: ApiConfig,
) => (options: AxiosRequestConfig) => Promise<AxiosResponse<T>>;

export class API<DataType = any> {
  public instance: ReturnType<ApiInstance>;
  private config: ApiConfig;

  constructor(config: ApiConfig = {}, instance: ApiInstance = DefaultAxiosInstance) {
    this.config = config;
    this.instance = instance(config);
  }

  /**
   * 自定义判断服务器返回值是否合法
   * @param data 服务器返回的值
   * @param options 请求参数
   * @param customOptions 请求自定义参数
   * @returns 返回 boolean 类型
   */
  async validate(
    data: DataType,
    options: AxiosRequestConfig,
    customOptions: CustomOptions,
    others: Omit<AxiosResponse, 'data'>,
  ) {
    return true;
  }
  /**
   * 格式化服务器返回结果
   * @param data 服务器返回的值
   * @param options 请求参数
   * @param customOptions 请求自定义参数
   */
  format?: (data: DataType, options: AxiosRequestConfig, customOptions: CustomOptions) => any;

  /**
   * 格式化服务器错误信息，在 catch 语句中被调用
   * @param responseHelper 返回值，可对 data,message,isValid 做修改
   * @param options 请求参数
   * @param customOptions 请求自定义参数
   */
  catch = (
    responseHelper: ResponseHelper<any>,
    options: AxiosRequestConfig,
    customOptions: CustomOptions,
  ) => responseHelper;
  /**
   * 格式化服务器错误信息，在 try 语句中被调用
   * @param data 服务器返回的值
   * @param options 请求参数
   * @param customOptions 请求自定义参数
   */
  error?: (
    data: DataType,
    options: AxiosRequestConfig,
    customOptions: CustomOptions,
  ) => Promise<string>;

  /**
   * 发送请求前处理参数
   * @param options axios参数
   * @param customOptions 自定义参数
   */
  async transformRequest(options: AxiosRequestConfig, customOptions: CustomOptions) {}

  /**
   * 预设每次请求用到的header
   */
  headers(): Record<string, any> {
    return {};
  }

  private getBaseURL = (...urls: (string | undefined)[]) => {
    const hasHttpURL = urls.find((u) => isHTTP(u));

    return combineURLs(hasHttpURL ? '' : this.config.baseURL, ...urls);
  };

  private getRequestOptions = (
    method: Method,
    url: string,
    param: any,
    option: AxiosRequestConfig = {},
    customOptions: CustomOptions = {},
  ) => {
    customOptions.arrayFormat = customOptions.arrayFormat || 'repeat';

    if (customOptions.jsonp) {
      option.adapter = jsonp;
    }

    if (customOptions.urlencoded) {
      option.transformRequest = urlencodedParser;
      option.headers = {
        ...option.headers,
        'Content-Type': 'application/x-www-form-urlencoded',
      };
    }

    if (customOptions.form) {
      option.transformRequest = formParser;
      option.headers = {
        ...option.headers,
        'Content-Type': 'multipart/form-data',
      };
    }

    if (customOptions.blob) {
      option.responseType = isBrowser() ? 'blob' : 'arraybuffer';
    }

    if (customOptions.stream) {
      option.responseType = 'stream';
    }

    if (customOptions.arrayFormat) {
      option.paramsSerializer = (params) =>
        qs.stringify(params, { arrayFormat: customOptions.arrayFormat });
    }

    const { headers, ...others } = option;
    const options: AxiosRequestConfig = {
      headers: {
        ...headers,
        ...this.headers(),
      },
      ...others,
      url,
      method,
    };

    if (typeof param === 'string') {
      options.url = this.getBaseURL(option.baseURL, url, param);
    } else {
      options.url = this.getBaseURL(option.baseURL, url);
    }

    if (param && typeof param !== 'string') {
      switch (method) {
        case 'PUT':
        case 'POST':
          options.data = param;
          if (param.__query) {
            options.params = param.__query;
            delete param.__query;
          }
          break;
        default:
          if (param.__query) {
            delete param.__query;
          }
          options.params = param;
      }
    }

    return options;
  };

  private requestPromise = <T>(options: AxiosRequestConfig, customOptions: CustomOptions = {}) =>
    new Promise<ResponseHelper<T>>(async (resolve, reject) => {
      await this.transformRequest(options, customOptions);

      const cacheKey = JSON.stringify({ ...options, ...customOptions });
      const ready2cache = typeof customOptions.expire === 'number' && customOptions.expire >= 0;
      if (ready2cache) {
        const response = cache.get(cacheKey, resolve);
        // 已添加缓存,等待数据返回
        if (response === true) {
          return;
        }
        // 取到缓存,直接返回
        if (response && typeof response !== 'boolean' && response.data.isValid) {
          return resolve(response.data);
        }
      }

      // 失败重试,可配置入参
      const retry = (opts?: AxiosRequestConfig, customOpts?: CustomOptions) =>
        this.requestPromise<T>({ ...options, ...opts }, { ...customOptions, ...customOpts });

      this.instance(options)
        .then(async ({ data, ...others }) => {
          const isValid = await this.validate(data, options, customOptions, others);
          const responseHelper = new ResponseHelper<T>(
            options,
            this.format && !customOptions.blob ? this.format(data, options, customOptions) : data,
            retry,
          );
          responseHelper.isValid = isValid;

          if (!isValid && this.error) {
            responseHelper.message = await this.error(data, options, customOptions);
          }

          if (ready2cache) {
            cache.set(cacheKey, responseHelper, customOptions.expire);
          }

          resolve(responseHelper);
        })
        .catch(async (err) => {
          let responseHelper = new ResponseHelper<any>(options, null, retry);
          responseHelper.message = err;
          responseHelper.isValid = false;

          responseHelper = this.catch(responseHelper, options, customOptions);

          cache.resolve(cacheKey, responseHelper);

          (customOptions && customOptions.withReject ? reject : resolve)(responseHelper);
        });
    });

  private request = <R, T>(
    url: string,
    method: Method,
    customOptions?: CustomOptions,
    options?: AxiosRequestConfig,
  ) => (param: T, extraOptions?: AxiosRequestConfig) => {
    const opts = this.getRequestOptions(
      method,
      url,
      param,
      { ...options, ...extraOptions },
      customOptions,
    );
    return this.requestPromise<R>(opts, customOptions);
  };

  private restfulRequest = <R, T>(
    url: string,
    method: Method,
    customOptions?: CustomOptions,
    options?: AxiosRequestConfig,
  ) => (id: string, param: T, extraOptions?: AxiosRequestConfig) => {
    const opts = this.getRequestOptions(
      method,
      combineURLs(url, id),
      param,
      { ...options, ...extraOptions },
      customOptions,
    );
    return this.requestPromise<R>(opts, customOptions);
  };

  /**
   * GET 请求
   * R: 返回类型定义
   * T: 输入类型定义
   */
  GET = <R, T>(url: string, customOptions?: CustomOptions, options?: AxiosRequestConfig) =>
    this.request<R, T>(url, 'GET', customOptions, options);

  /**
   * POST 请求
   * R: 返回类型定义
   * T: 输入类型定义
   */
  POST = <R, T>(url: string, customOptions?: CustomOptions, options?: AxiosRequestConfig) =>
    this.request<R, T>(url, 'POST', customOptions, options);

  /**
   * PUT 请求
   * R: 返回类型定义
   * T: 输入类型定义
   */
  PUT = <R, T>(url: string, customOptions?: CustomOptions, options?: AxiosRequestConfig) =>
    this.request<R, T>(url, 'PUT', customOptions, options);

  /**
   * DELETE 请求
   * R: 返回类型定义
   * T: 输入类型定义
   */
  DELETE = <R, T>(url: string, customOptions?: CustomOptions, options?: AxiosRequestConfig) =>
    this.request<R, T>(url, 'DELETE', customOptions, options);

  /**
   * GET 请求，入参为2个参数，第一个参数为 restful id 值
   * R: 返回类型定义
   * T: 输入类型定义
   */
  GETR = <R, T>(url: string, customOptions?: CustomOptions, options?: AxiosRequestConfig) =>
    this.restfulRequest<R, T>(url, 'GET', customOptions, options);

  /**
   * POST 请求，入参为2个参数，第一个参数为 restful id 值
   * R: 返回类型定义
   * T: 输入类型定义
   */
  POSTR = <R, T>(url: string, customOptions?: CustomOptions, options?: AxiosRequestConfig) =>
    this.restfulRequest<R, T>(url, 'POST', customOptions, options);

  /**
   * PUT 请求，入参为2个参数，第一个参数为 restful id 值
   * R: 返回类型定义
   * T: 输入类型定义
   */
  PUTR = <R, T>(url: string, customOptions?: CustomOptions, options?: AxiosRequestConfig) =>
    this.restfulRequest<R, T>(url, 'PUT', customOptions, options);

  /**
   * DELETE 请求，入参为2个参数，第一个参数为 restful id 值
   * R: 返回类型定义
   * T: 输入类型定义
   */
  DELETER = <R, T>(url: string, customOptions?: CustomOptions, options?: AxiosRequestConfig) =>
    this.restfulRequest<R, T>(url, 'DELETE', customOptions, options);

  /**
   * 返回给定参数的 url 值
   * T: 输入类型定义
   */
  URL = <T>(url: string) => (arg: T, customOptions?: CustomOptions, options?: AxiosRequestConfig) =>
    this.getRequestOptions('GET', url, arg, options, customOptions).url!;
}
