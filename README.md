# react-props-guard

Higher-order components (HOCs) that render a fallback when specified props are missing (`undefined` or `null`), so the wrapped component can assume those props are always defined.

Works in both **React** and **React Native** — it's a pure React library with no platform-specific dependencies.

## Why?

When a component requires a prop to be non-nullable but the parent may pass `undefined` while data is still loading, you often end up sprinkling guards like this:

```tsx
{user ? <Profile user={user} /> : null}
```

This library centralizes that pattern into a single HOC, and — importantly — **narrows the prop type inside the wrapped component** so you don't need redundant non-null checks.

## Installation

```sh
npm install react-props-guard
```

or

```sh
yarn add react-props-guard
```

## API

### `withPropGuard(Component, key, fallback?)`

Guards a **single** prop. Renders `fallback` when the specified prop is `undefined` or `null`; otherwise renders the wrapped component with its original prop types (the key is guaranteed to be defined).

```tsx
import { withPropGuard } from 'react-props-guard';

type ProfileProps = {
  user: { name: string };
};

function Profile({ user }: ProfileProps) {
  // `user` is guaranteed to be defined here.
  return <div>{user.name}</div>;
}

const GuardedProfile = withPropGuard(Profile, 'user', <span>Loading…</span>);

// `user` is now optional at the call site.
<GuardedProfile user={maybeUser} />;
```

### `withPropsGuard(Component, keys, fallback?)`

Guards **multiple** props at once. Internally iterates the `keys` array and renders `fallback` if **any** of them is `undefined` or `null`.

```tsx
import { withPropsGuard } from 'react-props-guard';

type DetailProps = {
  user: { name: string };
  post: { title: string };
};

function Detail({ user, post }: DetailProps) {
  // Both `user` and `post` are guaranteed to be defined here.
  return (
    <section>
      <h1>{post.title}</h1>
      <p>by {user.name}</p>
    </section>
  );
}

const GuardedDetail = withPropsGuard(
  Detail,
  ['user', 'post'],
  <span>Loading…</span>,
);

<GuardedDetail user={maybeUser} post={maybePost} />;
```

## `withPropsGuard` can replace `withPropGuard`

`withPropsGuard` is a generalization of `withPropGuard`: passing a single-element key array is functionally equivalent.

```tsx
// These two are equivalent:
withPropGuard(Profile, 'user', fallback);
withPropsGuard(Profile, ['user'], fallback);
```

> **Note:** `withPropsGuard` iterates the `keys` array on every render (short-circuiting on the first missing key). When guarding only one prop, `withPropGuard` avoids the loop overhead and expresses intent more clearly. Use `withPropsGuard` when you truly need to guard multiple props together.

## How it works

Both HOCs transform the component type so that the guarded keys become **optional** on the outer props, but remain **required (non-nullable)** on the inner wrapped component. The runtime check simply bails out to the fallback when any guarded prop is nullish.

```ts
// Outer props (what callers pass)
type OuterProps = Omit<P, K> & { [Q in K]?: P[Q] | undefined };

// Inner props (what the wrapped component sees): unchanged P
```

## License

MIT
