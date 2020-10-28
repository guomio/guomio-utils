import ast from '../../api/ast';
import yapi from '../../api/yapi';

const instance = yapi({
  token: 'xxxtoken',
  baseURL: 'https://xxxURL/',
});

instance(ast([...process.argv, 'xxx.ts']));
