import type {InjectionKey} from 'vue';

/**
 * How a BoxTypeDiagram draws its driver: one driver (the default everywhere), or one of the two Iso-Barik pairs. The Box tab's pair
 * (BoxPairDrawing.vue) provides this; the idSuffix keeps the second drawing's ids distinct from the first's on the same page.
 */
export interface BoxPairContext {
  readonly variant: 'single' | 'clamshell' | 'tandem';
  readonly idSuffix: string;
}

export const BOX_PAIR: InjectionKey<BoxPairContext> = Symbol('box-pair');

export const SINGLE_DRIVER: BoxPairContext = {variant: 'single', idSuffix: ''};
