import type { ComponentType, ReactNode } from 'react';

function withPropsGuard<K extends string, P extends { [Key in K]: unknown }>(
  WrappedComponent: ComponentType<P>,
  keys: readonly K[],
  fallback: ReactNode = null,
) {
  type OuterProps = Omit<P, K> & { [Q in K]?: P[Q] | undefined };

  const ComponentWithPropsGuard = (props: OuterProps) => {
    const record = props as Record<string, unknown>;
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (key === undefined) continue;
      const value = record[key];
      if (value === undefined || value === null) {
        return <>{fallback}</>;
      }
    }
    return <WrappedComponent {...(props as unknown as P)} />;
  };

  const wrappedName =
    WrappedComponent.displayName || WrappedComponent.name || 'Component';
  ComponentWithPropsGuard.displayName = `WithPropsGuard(${wrappedName})`;

  return ComponentWithPropsGuard;
}

export default withPropsGuard;
