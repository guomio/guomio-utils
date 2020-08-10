import { AxiosTransformer } from 'axios';
import { isBrowser } from '../util';

/**
 * 批量调用转换方法
 * @param data request body data
 * @param headers request headers
 * @param transformers 转换方法
 */
export function transformData<T>(
  data: T,
  headers?: any,
  ...transformers: (AxiosTransformer | AxiosTransformer[])[]
): T {
  if (!transformers.length) return data;

  function transform<T>(
    transformer: AxiosTransformer | AxiosTransformer[],
    transformerData: T,
    headers: any,
  ) {
    if (typeof transformer === 'function') return transformer(transformerData, headers);

    if (Array.isArray(transformer)) {
      return transformData(transformerData, headers, ...transformer);
    }
    return transformerData;
  }

  return transformers.reduce((d, f) => transform(f, d, headers), data);
}

function slash(k: string, v: any, s = '=') {
  return encodeURIComponent(k) + s + encodeURIComponent(String(v));
}

export function urlencodedParser(data: Record<string, any> | FormData) {
  function urlencodedParserNode(data: Record<string, any>) {
    const ret: string[] = [];
    for (const i in data) {
      ret.push(slash(i, data[i]));
    }
    return ret.join('&');
  }

  if (!isBrowser() || !(data instanceof FormData)) return urlencodedParserNode(data);

  const ret: string[] = [];

  data.forEach((v, k) => {
    if (!(v instanceof File)) {
      ret.push(slash(k, v));
    }
  });
  return ret.join('&');
}

export function formParser(data: Record<string, any> | FormData) {
  if (!isBrowser() || data instanceof FormData) return data;

  const form = new FormData();
  for (const i in data) {
    form.append(i, data[i]);
  }
  return form;
}
