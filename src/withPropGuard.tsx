import { forwardRef, type ComponentType, type ReactNode } from 'react';

function withPropGuard<K extends string, P extends { [Key in K]: unknown }>(
  WrappedComponent: ComponentType<P>,
  key: K,
  fallback: ReactNode = null,
) {
  type OuterProps = Omit<P, K> & { [Q in K]?: P[Q] | undefined };

  const ComponentWithPropGuard = forwardRef<unknown, OuterProps>(
    function ComponentWithPropGuard(props, ref) {
      const value = (props as Record<string, unknown>)[key];
      if (value === undefined || value === null) {
        return <>{fallback}</>;
      }
      const Wrapped = WrappedComponent as ComponentType<P & { ref?: unknown }>;
      return <Wrapped {...(props as unknown as P)} ref={ref} />;
    },
  );

  const wrappedName =
    WrappedComponent.displayName || WrappedComponent.name || 'Component';
  ComponentWithPropGuard.displayName = `WithPropGuard(${wrappedName})`;

  return ComponentWithPropGuard;
}

export default withPropGuard;
