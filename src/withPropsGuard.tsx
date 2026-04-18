import { forwardRef, type ComponentType, type ReactNode } from 'react';

function withPropsGuard<
  const K extends string,
  P extends { [Key in K]: unknown },
>(
  WrappedComponent: ComponentType<P>,
  keys: readonly K[],
  fallback: ReactNode = null,
) {
  type OuterProps = Omit<P, K> & { [Q in K]?: P[Q] | undefined };

  const ComponentWithPropsGuard = forwardRef<unknown, OuterProps>(
    function ComponentWithPropsGuard(props, ref) {
      const record = props as Record<string, unknown>;
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (key === undefined) continue;
        const value = record[key];
        if (value === undefined || value === null) {
          return <>{fallback}</>;
        }
      }
      const Wrapped = WrappedComponent as ComponentType<P & { ref?: unknown }>;
      return <Wrapped {...(props as unknown as P)} ref={ref} />;
    },
  );

  const wrappedName =
    WrappedComponent.displayName || WrappedComponent.name || 'Component';
  ComponentWithPropsGuard.displayName = `WithPropsGuard(${wrappedName})`;

  return ComponentWithPropsGuard;
}

export default withPropsGuard;
