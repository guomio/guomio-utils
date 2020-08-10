import fs from 'fs';
import { API } from '../index';
import { isHTTP, isEmpty } from '../../util';
import { MockDictionary, PropertyDictionary } from './index';

interface ApiResponse {
  errcode: number;
  errmsg: string;
  data?: any;
}

export interface Config {
  baseURL: string;
  token: string;
  catName?: string;
}

const conf = {
  baseURL: '',
  token: '',
  catName: 'guomio-extract-api',
};

function createYapi(config?: Config) {
  config = { ...conf, ...config };

  if (!config.token) throw new Error('token 未设置');
  if (!config.baseURL) throw new Error('baseURL 未设置');

  const api = new API<ApiResponse>({
    baseURL: config.baseURL,
  });

  api.validate = async (data) => {
    return data.errcode === 0;
  };

  api.format = (data) => data.data;

  const getProject = api.GET<Request.IGetProject, Request.ITokenParam>('api/project/get');
  const getCatList = api.GET<Request.IGetCatList[], Request.ITokenParam>(
    'api/interface/getCatMenu',
  );
  const updateApi = api.POST<Request.IUpdateApi, YApiStruct>('api/interface/up');
  const addApi = api.POST<Request.IUpdateApi, YApiStruct>('api/interface/add');
  const getApiListByCatID = api.GET<Request.IGetApiListByCatID, Request.IGetApiListByCatIDParam>(
    'api/interface/list_cat',
  );
  const addCat = api.POST<Request.IAddCat, Request.IAddCatParam>('api/interface/add_cat', {
    urlencoded: true,
  });

  return {
    config,
    api,
    getProject,
    getCatList,
    updateApi,
    addApi,
    getApiListByCatID,
    addCat,
  };
}

declare namespace Request {
  export interface IGetProject {
    switch_notice: boolean;
    is_mock_open: boolean;
    strice: boolean;
    is_json5: boolean;
    _id: number;
    name: string;
    desc: string;
    basepath: string;
    project_type: string;
    uid: number;
    group_id: number;
    icon: string;
    color: string;
    add_time: number;
    up_time: number;
    tag: [];
    cat: [];
    role: boolean;
  }

  export interface IGetCatList {
    index: number;
    _id: number;
    name: string;
    project_id: number;
    desc: string;
    uid: number;
    add_time: number;
    up_time: number;
    __v: number;
  }

  export interface ITokenParam {
    token: string;
  }

  export interface IUpdateApi {
    ok: number;
    nModified: number;
    n: number;
  }

  export interface IAddCatParam {
    name: string;
    project_id: number | string;
    token: string;
    desc?: string;
  }

  export interface IAddCat {
    index: number;
    name: string;
    project_id: number;
    desc: string;
    uid: number;
    add_time: number;
    up_time: number;
    _id: number;
    __v: number;
  }

  export interface IGetApiListByCatIDParam {
    token: string;
    catid: number | string;
    page: 1;
    limit: number;
  }

  export interface IGetApiListByCatID {
    count: number;
    total: number;
    list: IGetApiListByCatIDData[];
  }

  export interface IGetApiListByCatIDData {
    edit_uid: number;
    status: 'undone' | 'done';
    api_opened: false;
    tag: [];
    _id: number;
    method: string;
    catid: number;
    title: string;
    path: string;
    project_id: number;
    uid: number;
    add_time: number;
  }
}

function readFileSync<T>(file: string): T | null {
  try {
    const out = fs.readFileSync(file, 'utf-8');
    return JSON.parse(out);
  } catch (err) {
    return null;
  }
}

export const KeyWordsEnum = {
  boolean: 'boolean',
  natural: 'natural',
  integer: 'integer',
  float: 'float',
  character: 'character',
  string: 'string',
  range: 'range',
  date: 'date',
  time: 'time',
  datetime: 'datetime',
  now: 'now',
  image: 'image',
  dataImage: 'dataImage',
  color: 'color',
  hex: 'hex',
  rgb: 'rgb',
  rgba: 'rgba',
  hsl: 'hsl',
  paragraph: 'paragraph',
  sentence: 'sentence',
  word: 'word',
  title: 'title',
  cparagraph: 'cparagraph',
  csentence: 'csentence',
  cword: 'cword',
  ctitle: 'ctitle',
  first: 'first',
  last: 'last',
  name: 'name',
  cfirst: 'cfirst',
  clast: 'clast',
  cname: 'cname',
  url: 'url',
  domain: 'domain',
  protocol: 'protocol',
  tld: 'tld',
  email: 'email',
  ip: 'ip',
  region: 'region',
  province: 'province',
  city: 'city',
  county: 'county',
  zip: 'zip',
  capitalize: 'capitalize',
  upper: 'upper',
  lower: 'lower',
  pick: 'pick',
  shuffle: 'shuffle',
  guid: 'guid',
  id: 'id',
  increment: 'increment',
} as const;

function formatMethod(method: string): YApiStruct['method'] {
  if (method.endsWith('R')) {
    return method.replace(/R$/, '') as YApiStruct['method'];
  }
  return method as YApiStruct['method'];
}

function pickJsDocRule(jsDoc?: PropertyDictionary['jsDoc']): string | number {
  if (!jsDoc?.length) return '';

  const fixKey = jsDoc.find((j) => j.name === 'fix');

  if (fixKey) {
    if (!fixKey.text) return 'fix';
    if (/['"']/.test(fixKey.text)) {
      return trimString(fixKey.text);
    }
    return +fixKey.text;
  }

  const key = jsDoc.find((j) => j.name in KeyWordsEnum);

  if (!key) return '';

  return '@' + key.name + (key.text || '');
}

function hasFixRule(jsDoc?: PropertyDictionary['jsDoc']): boolean {
  if (!jsDoc?.length) return false;
  const fixKey = jsDoc.find((j) => j.name === 'fix' && j.text);

  return !!fixKey;
}

function hasEnumRule(jsDoc?: PropertyDictionary['jsDoc']): boolean {
  if (!jsDoc?.length) return false;
  const fixKey = jsDoc.find((j) => j.name === 'enum' && j.text);

  return !!fixKey;
}

function pickEnumDocRule(jsDoc?: PropertyDictionary['jsDoc']): (string | number)[] {
  if (!jsDoc?.length) return [];

  const enumKey = jsDoc.find((j) => j.name === 'enum');

  if (!enumKey || !enumKey.text) return [];

  return trimString(enumKey.text)
    .split('|')
    .map((t) => t.trim());
}

function pickRangeJsDocRule(jsDoc?: PropertyDictionary['jsDoc']): string {
  const range = '|1-30';
  if (!jsDoc?.length) return range;

  const key = jsDoc.find((j) => j.name === 'array');

  if (!key) return range;

  return '|' + (key.text || '1-30');
}

function meetRule(value: string): string {
  switch (value) {
    case 'boolean':
    case 'string':
      return '@' + value;
    case 'number':
      return '@integer';
    default:
      return value;
  }
}

function arrayfy(type: string, v: any): any[] {
  switch (type) {
    case 'ArrayType':
      return [v];
    default:
      return v;
  }
}

function isFormDataHeader(headers: Record<string, any>) {
  return headers?.['Content-Type'] === 'multipart/form-data';
}

function isUrlencodedHeader(headers: Record<string, any>) {
  return headers?.['Content-Type'] === 'application/x-www-form-urlencoded';
}

function trimURL(u: string) {
  return u.replace(/\/:.*$/, '').replace(/\/$/, '');
}

function trimString(s: string) {
  return (s || '').replace(/'/g, '').replace(/"/g, '');
}

function isRestfulMethod(method: string) {
  return method.endsWith('R');
}

function isNoBodyRequest(method: string) {
  return method.includes('GET') || method.includes('DELETE');
}

function ensurePrifixSlash(path: string) {
  path = path.replace(/'/g, '').replace(/"/g, '');
  if (path.startsWith('/') || isHTTP(path)) return path;
  return '/' + path;
}

function ensureSlash(path: string) {
  path = ensurePrifixSlash(path);
  if (path.endsWith('/')) return path;
  return path + '/';
}

function parsePropertyDictionary(
  prop: PropertyDictionary[],
): Record<string, any> | string | Record<string, any>[] {
  let dict: Record<string, any> = {};

  if (prop.length === 1 && prop[0].type === 'ArrayType' && typeof prop[0].value !== 'string') {
    return arrayfy('ArrayType', parsePropertyDictionary(prop[0].value));
  }

  for (let i = 0; i < prop.length; i++) {
    const pr = prop[i];
    if (pr.key) {
      if (pr.type === 'UnionType' && typeof pr.value === 'string' && !hasFixRule(pr.jsDoc)) {
        dict[pr.key + '|1'] = trimString(pr.value)
          .split('|')
          .map((t) => t.trim());
        continue;
      }
      const enumValue = pickEnumDocRule(pr.jsDoc);
      if (!isEmpty(enumValue)) {
        dict[pr.key + '|1'] = enumValue;
        continue;
      }
      if (typeof pr.value !== 'string') {
        const v = arrayfy(pr.type, parsePropertyDictionary(pr.value));
        dict[Array.isArray(v) ? pr.key + pickRangeJsDocRule(pr.jsDoc) : pr.key] = v;
        continue;
      }
      const v = arrayfy(pr.type, pickJsDocRule(pr.jsDoc) || meetRule(pr.value));
      dict[Array.isArray(v) ? pr.key + pickRangeJsDocRule(pr.jsDoc) : pr.key] = arrayfy(
        pr.type,
        pickJsDocRule(pr.jsDoc) || meetRule(pr.value),
      );
      continue;
    } else {
      if (pr.type === 'Native' && typeof pr.value === 'string') {
        return meetRule(pr.value);
      }
    }
  }

  return dict;
}

function parseReqQuery(method: string, prop: PropertyDictionary[]): ReqQuery[] {
  if (!prop.length) return [];
  const querys: ReqQuery[] = [];

  switch (method) {
    case 'POST':
    case 'PUT':
      const p = prop.find((pro) => pro.key === '__query');
      if (!p || typeof p.value === 'string') return [];
      prop = p.value;
      break;
    default:
      break;
  }

  for (let i = 0; i < prop.length; i++) {
    const pr = prop[i];
    if (!pr.key) continue;

    querys.push({ name: pr.key, required: pr.required ? '1' : '0' });
  }

  return querys;
}

function parseHeaders(headers: Record<string, any>): ReqHeaders[] {
  return Object.keys(headers).map((h) => ({ name: h, value: headers[h] }));
}

function parseReqBodyForm(prop: PropertyDictionary[]): ReqBodyForm[] {
  if (!prop.length) return [];
  const forms: ReqBodyForm[] = [];

  for (let i = 0; i < prop.length; i++) {
    const pr = prop[i];
    if (!pr.key) continue;

    forms.push({
      name: pr.key,
      required: pr.required ? '1' : '0',
      type: pr.value === 'Blob' ? 'file' : 'text',
    });
  }

  return forms;
}

function mergeResponse(
  base: PropertyDictionary[],
  response: PropertyDictionary[],
): PropertyDictionary[] {
  const cp = JSON.parse(JSON.stringify(base)) as PropertyDictionary[];

  const find = cp.find((c) => c.key === 'data' || c.value === 'any');

  if (find) {
    find.value = JSON.parse(JSON.stringify(response));
  }

  return cp;
}

type RequiredFlag = '0' | '1';

interface ReqQuery {
  name: string;
  desc?: string;
  required: RequiredFlag;
}

interface ReqHeaders {
  name: string;
  value?: string;
}

interface ReqBodyForm {
  desc?: string;
  name: string;
  required: RequiredFlag;
  type: 'file' | 'text';
}

interface ReqParams {
  name: string;
  desc?: string;
}

interface YApiStruct {
  token: string;
  title: string;
  id: string;
  catid: string;
  path: string;
  method: 'GET' | 'PUT' | 'POST' | 'DELETE';
  status: 'undone' | 'done';

  req_query: ReqQuery[];
  req_headers: ReqHeaders[];
  req_body_form: ReqBodyForm[];
  req_body_type: 'json' | 'form' | 'file' | 'raw';
  req_params: ReqParams[];
  req_body_other: string;
  req_body_is_json_schema?: boolean;
  res_body_is_json_schema?: boolean;
  res_body_type: 'json';
  res_body: string;
}

function transform(file: string | object) {
  const out =
    typeof file === 'string' ? readFileSync<MockDictionary[]>(file) : (file as MockDictionary[]);

  if (isEmpty(out)) return console.log('读取数据为空');

  const apis: YApiStruct[] = [];

  out
    .filter((o) => !isHTTP(o.url))
    .forEach((o) => {
      const response = parsePropertyDictionary(mergeResponse(o.base, o.response));
      const request = parsePropertyDictionary(o.request);
      const method = formatMethod(o.method);

      const isForm = isFormDataHeader(o.headers);
      const isUrlencoded = isUrlencodedHeader(o.headers);
      const isisRestful = isRestfulMethod(o.method);

      const a: YApiStruct = {
        token: '',
        title: o.comment,
        path: isisRestful ? ensureSlash(o.url) + ':id' : ensurePrifixSlash(o.url),
        id: '',
        catid: '',
        method,
        status: 'done',

        req_query: parseReqQuery(method, o.request),
        req_headers: parseHeaders(o.headers),
        req_body_form: isForm ? parseReqBodyForm(o.request) : [],
        req_body_type: isNoBodyRequest(method)
          ? 'json'
          : (isForm && 'form') || (isUrlencoded && 'raw') || 'json',
        req_params: isisRestful ? [{ name: 'id' }] : [],
        req_body_other: JSON.stringify(request),
        req_body_is_json_schema: false,
        res_body_is_json_schema: false,
        res_body_type: 'json',
        res_body: JSON.stringify(response),
      };

      apis.push(a);
    });

  return apis;
}

async function analyze(file: string | object, config: Config) {
  const cfg = createYapi(config);

  const apis = transform(file);
  if (!apis) return console.log('未找到api定义');

  const newApis: YApiStruct[] = [];

  const catListRes = await cfg.getCatList({ token: config?.token });
  if (catListRes.isNotValid) return console.log('获取分类列表失败', catListRes.message);

  const extractApiCat = catListRes.data.find((e) => e.name === cfg.config.catName);

  let catid = 0;
  let projectid = 0;

  if (!extractApiCat) {
    const projectRes = await cfg.getProject({ token: config.token });
    if (projectRes.isNotValid) return console.log('获取项目信息失败', projectRes.message);

    const catRes = await cfg.addCat({
      token: config.token,
      project_id: projectRes.data._id,
      name: cfg.config.catName || conf.catName,
      desc: '自动生成接口列表',
    });

    if (catRes.isNotValid) return console.log('添加列表分类失败', catRes.message);

    catid = catRes.data._id;
    projectid = projectRes.data._id;
  } else {
    catid = extractApiCat._id;
    projectid = extractApiCat.project_id;
  }

  const apiListRes = await cfg.getApiListByCatID({
    token: config.token,
    page: 1,
    limit: 1000,
    catid,
  });

  if (apiListRes.isNotValid) return console.log('获取分类下api列表失败', apiListRes.message);

  const instanceMap = new Map<string, Request.IGetApiListByCatIDData>();

  apiListRes.data.list.forEach((a) => instanceMap.set(trimURL(a.path), a));

  apis.forEach((a) => {
    a.token = config.token;
    const instance = instanceMap.get(trimURL(a.path));
    if (instance) {
      a.catid = instance.catid.toString();
      a.id = instance._id.toString();
    } else {
      a.catid = catid.toString();
      newApis.push(a);
    }
  });

  await Promise.all(apis.filter((a) => !!a.id).map((a) => cfg.updateApi(a)));

  if (newApis.length) {
    await Promise.all(newApis.map((a) => cfg.addApi(a)));
  }
  console.log(
    'Yapi同步成功,您的mock地址为:',
    ensureSlash(cfg.config.baseURL) + 'mock/' + projectid,
  );
}

export function yapi(config: Config) {
  return (file: string | object) => {
    return analyze(file, config);
  };
}

export default yapi;
