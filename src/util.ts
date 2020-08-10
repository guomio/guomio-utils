import qs from 'qs';

/**
 * 延迟
 * @param time 单位：毫秒
 */
export const sleep = (time: number) => new Promise((resolve) => setTimeout(resolve, time));

/**
 * 判断一个路径是http或https或//
 * @param s url
 */
export function isHTTP(s = '') {
  return /^http[s]?.*/.test(s) || /^\/\//.test(s);
}

/**
 * 去除左侧指定内容
 * @param s 要格式化的字符串
 * @param reg 格式化规则，默认 /^\/+/
 */
export function trimLeft(s = '', reg = /^\/+/) {
  return s.replace(reg, '');
}

/**
 * 去除右侧指定内容
 * @param s 要格式化的字符串
 * @param reg 格式化规则，默认 /\/+$/
 */
export function trimRight(s = '', reg = /\/+$/) {
  return s.replace(reg, '');
}

/**
 * 去除字符串左右两侧的 /
 * @param s 要格式化的字符串
 */
export function trimSlash(s = '') {
  return trimRight(trimLeft(s));
}

/**
 * 拼接 URL
 * @param  baseURL 根地址
 * @param  relativeURL 要拼接的地址
 */
export function combineURLs(baseURL?: string, ...relativeURL: (string | undefined)[]): string {
  if (!isHTTP(baseURL)) {
    const httpIndex = relativeURL.findIndex(isHTTP);
    if (httpIndex !== -1) {
      baseURL = relativeURL[httpIndex];
      relativeURL = relativeURL.slice(httpIndex);
    }
  }

  relativeURL.filter((r) => !isHTTP(r)).map(trimSlash);
  return combineStrings(trimRight(baseURL), ...relativeURL)
    .replace(/\/\?/, '?')
    .replace(/=\//g, '=');
}

/**
 * 用 / 拼接字符串
 * @param  baseURL 根地址
 * @param  relativeURL 要拼接的地址
 */
export function combineStrings(baseURL?: string, ...relativeURL: (string | undefined)[]): string {
  return [trimRight(baseURL), ...relativeURL.map(trimSlash)].filter(Boolean).join('/');
}

type Nullable<T> = T extends null | undefined | '' ? T : never;

/**
 * 判断入参是否为 null | undefined | '' | {} | []
 * @param s 任意入参
 */
export function isEmpty<T>(s: T): s is Nullable<T> {
  if (null === s || undefined === s) {
    return true;
  }

  if (Array.isArray(s)) {
    return s.length === 0;
  }

  switch (typeof s) {
    case 'boolean':
    case 'function':
    case 'number':
      return false;
    case 'string':
      return !s.trim();
    case 'object':
      let counter = 0;
      for (let o in s) {
        if (s[o]) {
          counter++;
          break;
        }
      }
      return counter === 0;
    default:
      break;
  }

  return !!s;
}

/**
 * 获取入参 s 的 query 参数
 * @param s 入参 URL 字符串
 * @param options parse 配置
 */
export function query(s = '', options?: qs.IParseOptions): Record<string, string> {
  const searchs = s.split('?');
  if (!searchs[1]) return {};

  const queryObject = {};

  for (let i = 1; i < searchs.length; i++) {
    const queryString = searchs[i].split('#')[0];
    Object.assign(queryObject, qs.parse(queryString, options));
  }
  return queryObject;
}

/**
 * 生成带 query 的 URL
 * @param url URL  地址
 * @param query search 参数
 * @param options qs.stringify 配置
 */
export function genURL(
  url: string = '',
  query?: Record<string, any>,
  options?: qs.IStringifyOptions,
): string {
  if (isEmpty(query)) return url;
  return url + (url.includes('?') ? '&' : '?') + qs.stringify(query, options);
}

/**
 * 判断是否是浏览器环境
 */
export function isBrowser() {
  return (
    typeof window === 'object' &&
    typeof FormData === 'function' &&
    typeof document === 'object' &&
    typeof fetch === 'function' &&
    typeof XMLHttpRequest === 'function' &&
    document.createComment('') instanceof Comment
  );
}
