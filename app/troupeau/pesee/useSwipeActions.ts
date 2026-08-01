"use client";

import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  clampSwipeOffset,
  detectSwipeAxis,
  isSwipeInteractiveTarget,
  settledSwipeOffset,
  stableSwipeOffset,
  SWIPE_ACTION_WIDTH,
  type SwipeAxis,
} from "@/lib/field-weighing";

export function useSwipeActions({
  open,
  disabled,
  onOpenChange,
}: {
  open: boolean;
  disabled: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pointerStartRef = useRef({ x: 0, y: 0, offset: 0 });
  const activePointerRef = useRef<number | null>(null);
  const gestureAxisRef = useRef<SwipeAxis>("pending");
  const offsetRef = useRef(stableSwipeOffset(open));
  const [offset, setOffset] = useState(offsetRef.current);
  const [dragging, setDragging] = useState(false);

  const updateOffset = useCallback((value: number) => {
    offsetRef.current = value;
    setOffset(value);
  }, []);

  useEffect(() => {
    updateOffset(stableSwipeOffset(open));
  }, [open, updateOffset]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        updateOffset(0);
        onOpenChange(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [open, onOpenChange, updateOffset]);

  function start(event: ReactPointerEvent<HTMLDivElement>) {
    if (disabled || isSwipeInteractiveTarget(event.target as HTMLElement)) return;
    const startOffset = stableSwipeOffset(open);
    updateOffset(startOffset);
    pointerStartRef.current = { x: event.clientX, y: event.clientY, offset: startOffset };
    activePointerRef.current = event.pointerId;
    gestureAxisRef.current = "pending";
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event: ReactPointerEvent<HTMLDivElement>) {
    if (activePointerRef.current !== event.pointerId) return;
    const deltaX = event.clientX - pointerStartRef.current.x;
    const deltaY = event.clientY - pointerStartRef.current.y;

    if (gestureAxisRef.current === "pending") {
      const axis = detectSwipeAxis(deltaX, deltaY);
      if (axis === "pending") return;
      gestureAxisRef.current = axis;
      if (axis === "vertical") {
        activePointerRef.current = null;
        updateOffset(stableSwipeOffset(open));
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        return;
      }
      setDragging(true);
    }

    if (gestureAxisRef.current === "horizontal") {
      updateOffset(clampSwipeOffset(pointerStartRef.current.offset + deltaX));
    }
  }

  function finish(event: ReactPointerEvent<HTMLDivElement>, settle: boolean) {
    if (activePointerRef.current !== event.pointerId) return;
    const finalOffset = settle && gestureAxisRef.current === "horizontal"
      ? settledSwipeOffset(offsetRef.current, pointerStartRef.current.offset)
      : stableSwipeOffset(open);

    activePointerRef.current = null;
    gestureAxisRef.current = "pending";
    setDragging(false);
    updateOffset(finalOffset);
    onOpenChange(finalOffset === -SWIPE_ACTION_WIDTH);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return {
    wrapperRef,
    offset,
    dragging,
    pointerHandlers: {
      onPointerDown: start,
      onPointerMove: move,
      onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => finish(event, true),
      onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => finish(event, false),
      onLostPointerCapture: (event: ReactPointerEvent<HTMLDivElement>) => finish(event, false),
    },
  };
}
