import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { isBrowser, genURL } from '../util';

let cid = 1;

export default function jsonpAdapter(config: AxiosRequestConfig) {
  return new Promise<AxiosResponse<any>>(function (resolve, reject) {
    if (!isBrowser()) return reject('Unsupported platform');

    const script = document.createElement('script');

    script.async = true;

    const jsonp = 'axiosJsonpCallback' + cid++;
    const old = window[jsonp];
    let isAbort = false;

    window[jsonp] = function (responseData: any) {
      window[jsonp] = old;

      if (isAbort) return;

      resolve({
        data: responseData,
        status: 200,
        statusText: 'ok',
        config,
        headers: config.headers,
      });
    };

    script.onload = function () {
      script.parentNode?.removeChild(script);
    };

    if (config.cancelToken) {
      config.cancelToken.promise.then(function (cancel) {
        if (!script) return;

        isAbort = true;
        reject(cancel);
      });
    }

    script.src = genURL(config.url, { ...config.params, _: new Date().getTime(), callback: jsonp });

    document.head.appendChild(script);
  });
}
