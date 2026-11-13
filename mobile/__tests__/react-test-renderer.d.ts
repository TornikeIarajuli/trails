// react-test-renderer is installed with jest-expo but ships no type declarations.
// This covers the part of its API the render tests use.
declare module 'react-test-renderer' {
  import type { ElementType, ReactElement } from 'react';

  export interface ReactTestInstance {
    type: ElementType | string;
    props: { [propName: string]: any };
    parent: ReactTestInstance | null;
    children: (ReactTestInstance | string)[];
    findAll(predicate: (node: ReactTestInstance) => boolean, options?: { deep: boolean }): ReactTestInstance[];
    findAllByType(type: ElementType, options?: { deep: boolean }): ReactTestInstance[];
  }

  export interface ReactTestRenderer {
    root: ReactTestInstance;
    toJSON(): unknown;
    update(element: ReactElement): void;
    unmount(): void;
  }

  export function create(element: ReactElement): ReactTestRenderer;
  export function act(callback: () => void | Promise<void>): Promise<void>;

  const TestRenderer: { create: typeof create; act: typeof act };
  export default TestRenderer;
}
