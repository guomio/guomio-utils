import { Observable } from 'rxjs';
import produce, { Draft } from 'immer';
import { combineStrings, isEmpty } from './util';
import { ActionFunction1, ReducerMap, handleActions as handleAction } from 'redux-actions';
import { persistStore, persistReducer, PersistConfig } from 'redux-persist';
import {
  ActionsObservable,
  StateObservable,
  createEpicMiddleware,
  combineEpics,
} from 'redux-observable';
import {
  Reducer,
  compose,
  combineReducers,
  applyMiddleware,
  createStore,
  PreloadedState,
  ReducersMapObject,
  Action,
} from 'redux';

declare global {
  interface Window {
    __REDUX_DEVTOOLS_EXTENSION_COMPOSE__?: (arg: any) => <R>(a: R) => R;
    [key: string]: any;
  }
}

export { createAction } from 'redux-actions';

/**
 * 改造 redux-observable 的 ActionsObservable 类型
 */
export type ActionObservable<
  T extends (...args: any[]) => any = (...args: any[]) => any
> = ActionsObservable<ReturnType<T>>;

export type PickStateType<T> = {
  [K in keyof T]: T[K] extends Record<string, any> ? Partial<T[K]> : T[K];
};

export interface AnyAction<T = any> extends Action {
  payload?: T;
}

/**
 * 初始化 state 参数
 * @param state 模块的 state
 */
export function createState<T>(state: PickStateType<T>) {
  return state as T;
}

/**
 * createReducer 工具函数，定义 state 类型
 */
export function createReducerWithState<S>() {
  return createReducer<S>();
}

export function createReducer<S>() {
  return <T extends (...arg: any) => any>(
    f: T,
    fn: (draft: Draft<S>, payload: ReturnType<T>) => any,
  ) => {
    const func = (state: S, payload: ReturnType<T>) => {
      return produce(state, (draft) => {
        fn(draft, payload);
      });
    };
    func.toString = () => `${f}`;
    return func;
  };
}

/**
 * createEpic 工具函数，定义 state 类型
 */
export function createEpicWithState<S extends any = any>() {
  return createEpic<S>();
}

export function createEpic<S>() {
  return <T extends (...args: any) => any>(
    f: T | string,
    fn: (
      ofType: ActionsObservable<ReturnType<T>>,
      action$: ActionObservable<ReturnType<T>>,
      state$: StateObservable<S>,
    ) => Observable<any>,
  ) => {
    return (action$: ActionObservable<ReturnType<T>>, state$: StateObservable<S>) => {
      return fn(action$.ofType(`${f}`), action$, state$);
    };
  };
}

/**
 * 去除 redux-actions/handleActions 默认类型
 */
export function handleActions<State>(arg: Reducer<any, any>[], state?: State): Reducer<State, any>;
export function handleActions<State>(
  arg: ReducerMap<State, any>,
  state?: State,
): Reducer<State, any>;
export function handleActions<State>(arg: any, state?: State): Reducer<State | undefined, any> {
  const reducers: Record<string, any> = {};
  if (Array.isArray(arg)) {
    arg.forEach((a) => {
      reducers[`${a}`] = a;
    });
  } else {
    for (const i in arg) {
      if (i.includes('/')) {
        reducers[i] = arg[i];
      } else {
        reducers[`${arg[i]}`] = arg[i];
      }
    }
  }
  const reducer = handleAction(reducers, state);
  reducer.toString = () => Object.keys(reducers)[0].replace(/(^[^/]*).*/, '$1');
  return reducer;
}

/**
 * 返回 compose
 * @param useReduxDevTools 是否启用 ReduxDevTools
 */
export function composeEnhancers(useReduxDevTools?: boolean) {
  return useReduxDevTools &&
    typeof window === 'object' &&
    window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
    ? window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__({})
    : compose;
}

/**
 * createEpicStore 配置参数类型
 */
export interface CreateEpicStoreOptions<S> {
  reducers: Reducer<any, any>[];
  epics: ((action$: ActionObservable<any>, state$: StateObservable<S>) => Observable<any>)[];
  state?: PreloadedState<S>;
  useReduxDevTools?: boolean;
  persistConfig?: PersistConfig<S>;
}

/**
 * 初始化 store
 * @param options 配置参数
 */
export function createEpicStore<S, A extends string = string>(options: CreateEpicStoreOptions<S>) {
  const epicMiddleware = createEpicMiddleware();
  const middlewares = [epicMiddleware];

  const reducers: ReducersMapObject<any, any> = {};

  options.reducers.forEach((r) => {
    reducers[`${r}`] = r;
  });

  const enhancer = composeEnhancers(options.useReduxDevTools)(applyMiddleware(...middlewares));
  const persistedReducer = options.persistConfig
    ? (persistReducer<S>(options.persistConfig, combineReducers(reducers)) as Reducer<any, Action>)
    : combineReducers(reducers);
  const store = createStore<S, Action<A>, unknown, unknown>(
    persistedReducer,
    options.state,
    enhancer,
  );
  const persistor = persistStore(store);
  epicMiddleware.run(combineEpics<any>(...options.epics));
  return { store, persistor };
}

/**
 * 返回 combineStrings 函数，绑定给定空间，获得 actionType
 * @param namespace 命名空间
 */
export function createNamespace<T extends string>(namespace: string) {
  function namespaceTyped(...arg: T[]) {
    return combineStrings(namespace, ...arg);
  }
  namespaceTyped.start = (...arg: T[]) => combineStrings(namespace, ...arg, '@@start');
  namespaceTyped.end = (...arg: T[]) => combineStrings(namespace, ...arg, '@@end');
  namespaceTyped.stop = (...arg: T[]) => combineStrings(namespace, ...arg, '@@stop');
  namespaceTyped.type = namespace;
  return namespaceTyped;
}

/**
 * 简写 reducer update
 * @param draft immer
 * @param payload 参数
 */
export const mapPayloadToDraft = (draft: Record<string, any>, payload?: Record<string, any>) => {
  if (!isEmpty(payload)) {
    for (const i in payload) {
      draft[i] = payload[i];
    }
  }
};

/**
 * 简写 reducer updator
 * @param factor createAction 实例
 */
export const updateReducer = <T>(factor: ActionFunction1<T, AnyAction<T>>) =>
  createReducer<any>()(factor, (state, { payload }) => {
    mapPayloadToDraft(state, payload);
  });
