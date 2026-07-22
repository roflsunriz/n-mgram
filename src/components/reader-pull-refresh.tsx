import { useCallback, useRef, useState, type TouchEventHandler } from 'react';

const PULL_TO_REFRESH_THRESHOLD_PX = 72;
const MAX_PULL_OFFSET_PX = 96;
const REFRESH_HOLD_OFFSET_PX = 44;
const PULL_RESISTANCE = 0.5;

interface PullGesture {
  startY: number;
  distance: number;
}

export function useReaderPullRefresh({
  enabled,
  onRefresh,
}: {
  enabled: boolean;
  onRefresh: () => void;
}) {
  const [pullOffset, setPullOffset] = useState(0);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const gestureRef = useRef<PullGesture | undefined>(undefined);

  const reset = useCallback(() => {
    gestureRef.current = undefined;
    setPullOffset(0);
    setReady(false);
  }, []);

  const onTouchStart: TouchEventHandler<HTMLDivElement> = useCallback(
    (event) => {
      if (
        !enabled ||
        refreshing ||
        event.currentTarget.scrollTop > 0 ||
        event.touches.length !== 1
      ) {
        if (!refreshing) reset();
        return;
      }
      const touch = event.touches[0];
      if (touch) gestureRef.current = { startY: touch.clientY, distance: 0 };
    },
    [enabled, refreshing, reset],
  );

  const onTouchMove: TouchEventHandler<HTMLDivElement> = useCallback(
    (event) => {
      const gesture = gestureRef.current;
      const touch = event.touches[0];
      if (event.touches.length !== 1) {
        if (!refreshing) reset();
        return;
      }
      if (!gesture || !touch) return;

      const distance = Math.max(0, touch.clientY - gesture.startY);
      gesture.distance = distance;
      setPullOffset(Math.min(MAX_PULL_OFFSET_PX, distance * PULL_RESISTANCE));
      setReady(distance >= PULL_TO_REFRESH_THRESHOLD_PX);
      if (distance > 0) event.preventDefault();
    },
    [refreshing, reset],
  );

  const onTouchEnd: TouchEventHandler<HTMLDivElement> = useCallback(() => {
    const gesture = gestureRef.current;
    gestureRef.current = undefined;
    if (gesture && gesture.distance >= PULL_TO_REFRESH_THRESHOLD_PX) {
      setReady(false);
      setRefreshing(true);
      setPullOffset(REFRESH_HOLD_OFFSET_PX);
      onRefresh();
      return;
    }
    reset();
  }, [onRefresh, reset]);

  const onTouchCancel: TouchEventHandler<HTMLDivElement> = useCallback(() => {
    if (!refreshing) reset();
  }, [refreshing, reset]);

  const settle = useCallback(() => {
    setRefreshing(false);
    reset();
  }, [reset]);

  return {
    pullOffset,
    ready,
    refreshing,
    visible: pullOffset > 0 || refreshing,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel,
    cancelGesture: reset,
    settle,
  };
}

export function ReaderPullRefreshIndicator({
  visible,
  ready,
  refreshing,
  label,
}: {
  visible: boolean;
  ready: boolean;
  refreshing: boolean;
  label: string;
}) {
  return (
    <div
      className={`reader-pull-refresh ${visible ? 'is-visible' : ''} ${ready ? 'is-ready' : ''} ${refreshing ? 'is-refreshing' : ''}`}
      data-testid="reader-pull-refresh"
      role="status"
      aria-label={label}
      aria-live="polite"
      aria-hidden={!visible}
    >
      <span className="reader-pull-spinner" aria-hidden="true" />
    </div>
  );
}
