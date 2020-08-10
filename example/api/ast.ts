import ast from '../../src/api/ast';
import yapi from '../../src/api/yapi';

const instance = yapi({
  token: 'xxxtoken',
  baseURL: 'https://xxxURL/',
});

instance(ast([...process.argv, 'xxx.ts']));
