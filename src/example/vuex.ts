import Vue from 'vue';
import Vuex from 'vuex';
import { named } from '../vuex';
import { VuexModule, Module, Mutation } from 'vuex-module-decorators';

Vue.use(Vuex);

const store = new Vuex.Store<any>({});

const name = named<'outdated'>('app');

@Module(name.Module(store))
class App extends VuexModule {
  version = '1.0.0';

  @Mutation
  SET_VERSION(version = '') {
    this.version = version;
  }

  get outdated() {
    return this.version === '1.0.0';
  }
}

const AppModule = name.getModule(App);

store.subscribe(() => console.log(AppModule.version));

console.log(AppModule.version);

AppModule.SET_VERSION('1.0.1');
AppModule.SET_VERSION('1.0.2');
AppModule.SET_VERSION('1.0.3');
AppModule.SET_VERSION('1.0.4');
