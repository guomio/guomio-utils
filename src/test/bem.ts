import { createBEM } from '../bem';

const b = createBEM('zr-button');

console.log(b.e('round', 'outline').c());
console.log(b.m('disabled', 'loading').c());
console.log(
  b
    .em(['contained', { disabled: true }])
    .m({ loading: false })
    .c('extra-class'),
);
console.log(b.e('circular').emc());
