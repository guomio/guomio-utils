import { mapState, mapGetters, Store } from 'vuex';
import { VuexModule, getModule } from 'vuex-module-decorators';
import { DynamicModuleOptions } from 'vuex-module-decorators/dist/types/moduleoptions';

interface ConstructorOf<C> {
  new (...args: any[]): C;
}

export interface NamedFunction<T extends string> {
  (): string;
  toString(): string;
  /**
   * 生成 Module 配置项
   * @param store 全局store
   */
  Module(store: Store<any>): DynamicModuleOptions;
  /**
   * mapState 格式化返回值
   */
  mapState(): ReturnType<typeof mapState>;
  /**
   * mapGetters 格式化返回值
   *
   * getters key/value vue computed方法/store get属性
   */
  mapGetters(getters: Record<string, T>): ReturnType<typeof mapGetters>;

  /**
   * 同 vuex-module-decorators/getModule,去除 VuexModule 属性提示
   * @param moduleClass VuexModule
   */
  getModule<M extends VuexModule = VuexModule>(
    moduleClass: ConstructorOf<M>,
  ): ExcludeVuexModule<M> & ThisNamedModule<T>;
}

/**
 * mapState, mapGetters 格式化
 * 类型入参为getter属性枚举值
 * @param name 模块名称
 */
export function named<T extends string = string>(name: string, options?: DynamicModuleOptions) {
  const fn: NamedFunction<T> = function () {
    return name;
  };

  fn.toString = fn;
  fn.Module = (store) => ({ store, dynamic: true, namespaced: true, name, ...options });
  fn.mapState = () => mapState({ [name]: name });
  fn.mapGetters = (getters: Record<string, T>) =>
    mapGetters(
      name,
      Object.keys(getters).reduce((a, b) => ({ ...a, [b]: getters[b] }), {}),
    );
  fn.getModule = function <M extends VuexModule = VuexModule>(
    moduleClass: ConstructorOf<M>,
    store?: Store<any>,
  ) {
    return getThisModule(moduleClass, this, store);
  };
  return fn;
}

interface ThisNamedModule<T extends string> {
  /**
   * vuex 命名空间封装
   */
  named: NamedFunction<T>;
}

type ExcludeVuexModule<M extends VuexModule> = {
  [K in keyof Omit<M, keyof VuexModule>]: M[K];
};

/**
 * 同 getModule ，去除 VuexModule 属性提示
 * @param moduleClass extends VuexModule
 */
export function getThisModule<T extends string = string, M extends VuexModule = VuexModule>(
  moduleClass: ConstructorOf<M>,
  name: NamedFunction<T>,
  store?: Store<any>,
) {
  const module: ExcludeVuexModule<M> & ThisNamedModule<T> = getModule(moduleClass, store) as any;
  module.named = name;
  return module;
}
