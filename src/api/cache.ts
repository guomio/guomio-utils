export interface CacheConfig {
  /**
   * 每次取值后刷新时间
   */
  fresh?: boolean;
}

interface CacheMap<T extends any = any> {
  created: number;
  expire: number;
  data: T;
}

type Resolver = (...arg: any) => any;

export class Cache<T extends any = any> {
  private cache = new Map<string, CacheMap<T>>();
  private resolver = new Map<string, Resolver[]>();

  private config: CacheConfig = {};

  constructor(config?: CacheConfig) {
    this.config = { ...this.config, ...config };
  }

  get = (key: string, resolve: Resolver): boolean | CacheMap<T> => {
    const response = this.cache.get(key);
    if (response) {
      const now = Date.now();
      if (response.expire === 0 || now - response.created < response.expire) {
        if (this.config.fresh) {
          response.created = now;
        }
        this.cache.set(key, response);
        return response;
      }
      // 过期删除缓存
      this.cache.delete(key);
    }

    // 未取得缓存,存储 resolver, 等待 set 对应资源后再取出返回
    const resolvers = this.resolver.get(key);
    this.resolver.set(key, [...(resolvers || []), resolve]);
    return !!resolvers;
  };

  set = (key: string, data: any, expire = 0) => {
    this.cache.set(key, {
      created: Date.now(),
      data,
      expire,
    });
    this.resolve(key, data);
  };

  resolve = (key: string, data: any) => {
    const resolvers = this.resolver.get(key);
    if (resolvers) {
      resolvers.forEach((resolve) => resolve(data));
      this.resolver.delete(key);
    }
  };
}
