import { useEffect, useMemo, useRef, useState } from 'react';
import type { StepRecord } from '@state/gameSessionStore';
import { ANIMATION } from './timings';
import { EMPTY_PLAN, isEmptyPlan, planStep } from './stepModel';
import type { AnimationPlan, Geometry } from './stepModel';

export interface StepAnimations {
  plan: AnimationPlan;
  /** Tiles still in the air; the tray keeps their slot empty until they land. */
  hiddenTileIds: ReadonlySet<number>;
}

/**
 * Reacts to each new step by adding its effects to the layer and removing
 * them when they finish. With reduced motion, nothing is drawn.
 */
export function useStepAnimations(
  step: StepRecord | null,
  geometry: Geometry | null,
  reducedMotion: boolean,
): StepAnimations {
  const [plan, setPlan] = useState<AnimationPlan>(EMPTY_PLAN);
  const [handledSeq, setHandledSeq] = useState<number | null>(null);
  const geometryRef = useRef(geometry);
  geometryRef.current = geometry;
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const active = timers.current;
    return () => {
      active.forEach(clearTimeout);
      active.clear();
    };
  }, []);

  useEffect(() => {
    const current = geometryRef.current;
    if (!step || reducedMotion || !current) {
      return;
    }
    const next = planStep(step, current);
    if (isEmptyPlan(next)) {
      setHandledSeq(step.seq);
      return;
    }

    setHandledSeq(step.seq);
    setPlan(prev => ({
      flights: [...prev.flights, ...next.flights],
      bursts: [...prev.bursts, ...next.bursts],
      flashes: [...prev.flashes, ...next.flashes],
    }));

    const later = (ms: number, drop: (p: AnimationPlan) => AnimationPlan) => {
      const id = setTimeout(() => {
        timers.current.delete(id);
        setPlan(drop);
      }, ms + ANIMATION.cleanupSlackMs);
      timers.current.add(id);
    };
    const keys = (items: readonly { key: string }[]) =>
      new Set(items.map(i => i.key));

    const flightKeys = keys(next.flights);
    const burstKeys = keys(next.bursts);
    const flashKeys = keys(next.flashes);
    later(ANIMATION.flightMs, p => ({
      ...p,
      flights: p.flights.filter(f => !flightKeys.has(f.key)),
    }));
    later(
      ANIMATION.flightMs + Math.max(ANIMATION.burstMs, ANIMATION.celebrateMs),
      p => ({
        ...p,
        bursts: p.bursts.filter(b => !burstKeys.has(b.key)),
      }),
    );
    later(ANIMATION.flashMs, p => ({
      ...p,
      flashes: p.flashes.filter(f => !flashKeys.has(f.key)),
    }));
    // Only a new step should trigger this; geometry is read through the ref.
  }, [step, reducedMotion]);

  // The step renders one commit before its effect adds the flight. Hide the new
  // tile in that gap too, or it flashes in the tray and then flies in.
  const unplanned =
    step !== null &&
    !reducedMotion &&
    geometry !== null &&
    step.seq !== handledSeq;
  const pendingTileId = unplanned ? step?.tile?.id : undefined;
  const hiddenTileIds = useMemo(() => {
    const ids = new Set(plan.flights.map(f => f.tileId));
    if (pendingTileId !== undefined) {
      ids.add(pendingTileId);
    }
    return ids;
  }, [plan.flights, pendingTileId]);
  return { plan, hiddenTileIds };
}
