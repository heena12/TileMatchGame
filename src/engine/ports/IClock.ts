/** Source of time for the engine. Injected so the engine never reads the wall clock. */
export interface IClock {
  /** Milliseconds since the Unix epoch. */
  now(): number;
}
