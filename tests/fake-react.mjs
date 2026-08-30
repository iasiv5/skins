/**
 * Minimal React stand-in for component-level public-path tests: hooks with
 * path-keyed PERSISTENT slot frames (local state survives re-renders), element
 * trees as plain objects, and a microtask-checkpoint effect runner. Shared by
 * the panel and switcher test suites (plan L4).
 */

export const jsx = (type, props, key) => ({ type, props: props ?? {}, key });

export function createFakeReact() {
  let rootThunk = null;
  let renderScheduled = false;
  const pendingEffects = [];
  const hookStack = [];
  const framesByKey = new Map(); // path → { slots: [], index: 0 }

  function rerender() {
    if (renderScheduled || rootThunk === null) return;
    renderScheduled = true;
    queueMicrotask(() => {
      renderScheduled = false;
      rootThunk();
    });
  }

  function slot() {
    const frame = hookStack.at(-1);
    if (frame.index >= frame.slots.length) frame.slots.push({});
    return frame.slots[frame.index++];
  }

  function useState(initial) {
    const s = slot();
    if (!("value" in s)) s.value = typeof initial === "function" ? initial() : initial;
    return [s.value, (next) => {
      s.value = typeof next === "function" ? next(s.value) : next;
      rerender();
    }];
  }

  function useEffect(effect) {
    const s = slot();
    if (!s.ran) {
      s.ran = true;
      pendingEffects.push(effect);
    }
  }

  function useRef(initial) {
    const s = slot();
    if (!("ref" in s)) s.ref = { current: initial };
    return s.ref;
  }

  function instantiate(element, path = "root") {
    if (element === null || element === undefined || typeof element === "boolean") return null;
    if (typeof element === "string" || typeof element === "number") return element;
    if (Array.isArray(element)) {
      return element.map((child, index) => instantiate(child, `${path}/[${index}]`));
    }
    if (typeof element.type === "function") {
      const name = element.type.name || "anon";
      const framePath = `${path}/${name}${element.key === undefined ? "" : `#${element.key}`}`;
      let frame = framesByKey.get(framePath);
      if (frame === undefined) {
        frame = { slots: [], index: 0 };
        framesByKey.set(framePath, frame);
      }
      frame.index = 0; // rewind: each render consumes slots left-to-right
      hookStack.push(frame);
      try {
        return instantiate(element.type(element.props ?? {}), framePath);
      } finally {
        hookStack.pop();
      }
    }
    const children = element.props?.children;
    return {
      ...element,
      props: {
        ...element.props,
        children: children === undefined ? undefined : instantiate(children, `${path}/${String(element.type)}`),
      },
    };
  }

  return {
    useState, useEffect, useRef, instantiate,
    render(thunk) {
      rootThunk = thunk;
      const tree = thunk();
      queueMicrotask(() => {
        while (pendingEffects.length > 0) pendingEffects.shift()();
      });
      return tree;
    },
  };
}

export function flatten(node) {
  if (node === null || node === undefined || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  const self = typeof node.type === "string" || node.type === undefined ? [node] : [];
  return [...self, ...flatten(node.props?.children)];
}

export function findButton(tree, text) {
  return flatten(tree).find((node) => node.type === "button" && node.props.children === text) ?? null;
}
