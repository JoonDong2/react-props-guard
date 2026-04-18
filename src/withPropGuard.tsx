import type { ComponentType, ReactNode } from 'react';

function withPropGuard<K extends string, P extends { [Key in K]: unknown }>(
  WrappedComponent: ComponentType<P>,
  key: K,
  fallback: ReactNode = null,
) {
  type OuterProps = Omit<P, K> & { [Q in K]?: P[Q] | undefined };

  const ComponentWithPropGuard = (props: OuterProps) => {
    const value = (props as Record<string, unknown>)[key];
    if (value === undefined || value === null) {
      return <>{fallback}</>;
    }
    return <WrappedComponent {...(props as unknown as P)} />;
  };

  const wrappedName =
    WrappedComponent.displayName || WrappedComponent.name || 'Component';
  ComponentWithPropGuard.displayName = `WithPropGuard(${wrappedName})`;

  return ComponentWithPropGuard;
}

export default withPropGuard;
