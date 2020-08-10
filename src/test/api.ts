import { API } from '../api';

export interface Response {
  data?: any;
  message: string;
  /**
   * @fix 200
   */
  code: number;
}

export const api = new API<Response>({
  baseURL: 'https://yapi.petrelteam.com/mock/54',
});

api.headers = () => ({
  ['X-token']: 'xxxtoken',
});

api.format = (data) => data.data;

api.validate = async (data) => {
  return data.code === 200;
};

api.error = async (data) => {
  return data.message || '未知错误';
};

api.catch = (res) => {
  return res;
};

export interface IUser {
  /**
   * @id
   */
  id: string;
  /**
   * @cword (2, 5)
   */
  name: string;
  /**
   * @integer (18, 75)
   */
  age: number;
  /**
   * @cparagraph (5, 20)
   */
  description: string;
}

/**
 * @mock 用户信息
 */
export const getUser = api.GET<IUser, any>('/user');

(async function () {
  const res = await getUser({ name: ['1', '2'] });
  if (res.isNotValid) return console.log(res.message);
  console.log(res.options);
  console.log(res.data);
})();
