export type Mods =
  | string
  | boolean
  | undefined
  | { [key: string]: string | number | boolean | undefined };

export interface Delimiters {
  element?: string;
  elementVal?: string;
  mod?: string;
  modVal?: string;
}

export class BEM {
  public name: string = '';

  private ELEMENT = '__';
  private ELEMENTVAL = '_';
  private MOD = '--';
  private MODVAL = '-';

  private elementClasses: string[] = [];
  private modClasses: string[] = [];

  constructor(name: string, delimiters?: Delimiters) {
    this.name = name;
    if (delimiters) {
      this.ELEMENT = delimiters.element || this.ELEMENT;
      this.ELEMENTVAL = delimiters.elementVal || this.ELEMENTVAL;
      this.MOD = delimiters.mod || this.MOD;
      this.MODVAL = delimiters.modVal || this.MODVAL;
    }
  }

  private joinElement = (element: Mods): string[] => {
    if (!element) return [this.name];

    let classNames: string[] = [];

    const join = (el: string, val?: string) =>
      this.name + this.ELEMENT + el + (val ? this.ELEMENTVAL + val : '');
    if (typeof element === 'string') {
      const className = join(element);
      this.elementClasses.push(className);
      return [className];
    }
    if (typeof element === 'object') {
      Object.keys(element).forEach((key) => {
        const item = element[key];
        if (true === item) {
          const className = join(key);
          this.elementClasses.push(className);
          return classNames.push(className);
        }
        if (typeof item === 'string') {
          const className = join(key, item);
          this.elementClasses.push(className);
          return classNames.push(className);
        }
      });
    }
    return classNames;
  };

  private joinMod = (mod: Mods, elementClass?: string) => {
    if (!mod) return;
    const join = (el: string, val?: string) =>
      (elementClass || this.name) + this.MOD + el + (val ? this.MODVAL + val : '');
    if (typeof mod === 'string') {
      return this.modClasses.push(join(mod));
    }
    if (typeof mod === 'object') {
      Object.keys(mod).forEach((key) => {
        const item = mod[key];
        if (true === item) {
          return this.modClasses.push(join(key));
        }
        if (typeof item === 'string') {
          return this.modClasses.push(join(key, item));
        }
      });
    }
  };

  private clear = () => {
    this.elementClasses = [];
    this.modClasses = [];
  };

  public e = (...element: Mods[]) => {
    element.filter(Boolean).forEach(this.joinElement);
    return this;
  };

  public m = (...modifier: Mods[]) => {
    modifier.filter(Boolean).forEach((m) => this.joinMod(m));
    return this;
  };

  public em = (...em: [Mods, Mods][]) => {
    em.filter(([e]) => e !== false).forEach(([e, m]) => {
      const elementClasses = this.joinElement(e);
      elementClasses.forEach((elementClass) => this.joinMod(m, elementClass));
    });
    return this;
  };

  /**
   * 输出 class 名称
   */
  public c = (...extraClass: (string | undefined)[]) => {
    const classes = [
      this.name,
      ...this.elementClasses,
      ...this.modClasses,
      ...extraClass.filter((c) => !!c),
    ].join(' ');
    this.clear();
    return classes;
  };

  /**
   * 输出 class 名称，不包含 block 名称
   */
  public emc = (...extraClass: (string | undefined)[]) => {
    const classes = [
      ...this.elementClasses,
      ...this.modClasses,
      ...extraClass.filter((c) => !!c),
    ].join(' ');
    this.clear();
    return classes;
  };

  /**
   * 输出 class 名称，不包含 block，modifier 名称
   */
  public ec = (...extraClass: (string | undefined)[]) => {
    const classes = [...this.elementClasses, ...extraClass.filter((c) => !!c)].join(' ');
    this.clear();
    return classes;
  };

  /**
   * 输出 class 名称，不包含 block，element 名称
   */
  public mc = (...extraClass: (string | undefined)[]) => {
    const classes = [...this.modClasses, ...extraClass.filter((c) => !!c)].join(' ');
    this.clear();
    return classes;
  };
}

/**
 * CSS BEM adaptor
 * ### Example
 * ```ts
 * const b = createBEM('zr-button');
 *
 * b.e('round', 'outline').c();
 * // zr-button zr-button__round zr-button__outline
 * b.m('disabled', 'loading').c();
 * // zr-button zr-button--disabled zr-button--loading
 * b.em(['contained', { disabled: true }]).m({ loading: false }).c('extra-class');
 * // zr-button zr-button__contained zr-button__contained--disabled extra-class
 * b.e('circular').emc();
 * // zr-button__circular;
 * ```
 */
export function createBEM(name: string, delimiters?: Delimiters) {
  return new BEM(name, delimiters);
}
