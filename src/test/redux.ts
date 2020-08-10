import {
  createNamespace,
  handleActions,
  createAction,
  createReducerWithState,
  createEpicWithState,
  createState,
  createEpicStore,
  updateReducer,
} from '../redux';
import { of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

interface StateType {
  version: string;
}

interface GlobalState {
  global: StateType;
}

const space = createNamespace('global');
const createEpic = createEpicWithState<GlobalState>();
const createReducer = createReducerWithState<StateType>();

const state = createState<StateType>({
  version: '1.0.0',
});

const update = createAction<Partial<StateType>>(space('update'));
const init = createAction<string>(space('init'));
const increment = createAction<Partial<StateType>>(space('increment'));

const incrementEpic = createEpic(increment, (ofType, action$, state$) => {
  return ofType.pipe(
    switchMap((action) => {
      return of(update({ ...action.payload }));
    }),
  );
});

const initReducer = createReducer(init, (state, { payload }) => {
  state.version = payload;
});

const reducers = handleActions([updateReducer(update), initReducer], state);

const { store } = createEpicStore<GlobalState>({
  epics: [incrementEpic],
  reducers: [reducers],
});

console.log(store.getState());

const unsubscribe = store.subscribe(() => console.log(store.getState()));

store.dispatch(update({ version: '1.0.1' }));
store.dispatch(update({ version: '1.0.2' }));
store.dispatch(update({ version: '1.0.3' }));

unsubscribe();
