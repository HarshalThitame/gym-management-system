"use client";

import { useCallback, useReducer } from "react";

type Action<T> =
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "SET"; newPresent: T }
  | { type: "RESET"; initialPresent: T };

type State<T> = {
  past: T[];
  present: T;
  future: T[];
};

const MAX_HISTORY = 50;

function undoReducer<T>(state: State<T>, action: Action<T>): State<T> {
  switch (action.type) {
    case "UNDO": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1] as T;
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future]
      };
    }
    case "REDO": {
      if (state.future.length === 0) return state;
      const next = state.future[0] as T;
      return {
        past: [...state.past, state.present],
        present: next,
        future: state.future.slice(1)
      };
    }
    case "SET": {
      if (JSON.stringify(action.newPresent) === JSON.stringify(state.present)) return state;
      return {
        past: [...state.past.slice(-(MAX_HISTORY - 1)), state.present],
        present: action.newPresent,
        future: []
      };
    }
    case "RESET":
      return { past: [], present: action.initialPresent, future: [] };
    default:
      return state;
  }
}

export function useUndoRedo<T>(initialPresent: T) {
  const [state, dispatch] = useReducer(undoReducer<T>, {
    past: [],
    present: initialPresent,
    future: []
  });

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const redo = useCallback(() => dispatch({ type: "REDO" }), []);
  const set = useCallback((newPresent: T) => dispatch({ type: "SET", newPresent }), []);
  const reset = useCallback((initial: T) => dispatch({ type: "RESET", initialPresent: initial }), []);

  return { state: state.present, set, undo, redo, reset, canUndo, canRedo };
}
