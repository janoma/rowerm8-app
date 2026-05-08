// Public surface of the stroke detection pipeline. Exports are listed
// explicitly (instead of `export *`) because the projector / detector
// share several type names with the gravity / types modules and the
// `import/export` lint rule can't always tell which module truly owns
// each name when type-only imports are forwarded.

export {
  createStrokeDetector,
  DEFAULT_DETECTOR_CONFIG,
  type StrokeDetector,
} from "./detector";
export { gravityFromAngle, subtractGravity } from "./gravity";
export {
  estimateBoatSpeedMps,
  estimatePaceSecondsPer500m,
  type PaceEstimateOptions,
} from "./pace";
export {
  DEFAULT_HANDLE_AXIS_CONFIG,
  DEFAULT_MAGNITUDE_CONFIG,
  DEFAULT_PCA_CONFIG,
  fixedAxisProjector,
  handleAxisProjector,
  magnitudeProjector,
  pcaProjector,
  type Axis,
  type HandleAxisProjectorConfig,
  type MagnitudeProjectorConfig,
  type PcaProjectorConfig,
} from "./projector";
export {
  createStrokeSession,
  type StrokeSession,
  type StrokeSessionConfig,
} from "./session";
export type {
  Angle,
  MotionSample,
  Projector,
  SessionMetrics,
  StrokeDetectorConfig,
  StrokeDetectorPhase,
  StrokeDetectorState,
  StrokeUpdateResult,
  SymMat3,
  Vec3Sample,
} from "./types";
