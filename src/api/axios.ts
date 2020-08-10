import axios from 'axios';
import { ApiInstance } from './index';

export const DefaultAxiosInstance: ApiInstance = (config) => axios.create(config).request;
