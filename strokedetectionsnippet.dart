// NOTE: THIS IS A CLASS WITH SEVERAL METHODS !!--------------------------------
class StrokeDetector {
  //final double thresholdFactor = 1.6;     //
  //double threshold = .5;                    // was on the RM8 screen
  double prevThreshold = _threshold; // starting seed value >0 needed
  double baseline = 0.0;
  double previousvalue = 0.0;
  int minStrokeGapMs = 1000; // default value
  int strokeGap = 500;
  int lastStrokeTimeMs = 1;
  int strokeCount = 0;

  double _cadence = _currentSlider3Value;
  double xcadence = 0;
  double xavgCadence = 1.0;

  // StrokeDetector Methods ----------------------------------------------------
  double average(List<double> values) {
    if (values.isEmpty) return 0.0;
    return values.reduce((a, b) => a + b) / values.length;
  }

  //---------------------------------------------------------------------------
  /* Update baseline (slowly) with samples during recovery when "value" falls
  below 115pc of previous threshold. Next..peak must be > 115pc of threshold   */
  double updateBaseline(double value, double localthresh) {
    //double beta = .01;          // baseline EMA
    if (value < 1.15 * localthresh) {
      /* EMA if not 0 safety ! Baseline moves with value if beta = 1 or
      frozen at original value if bata = 0;
      */
      baseline = baseline == 0 ? value : (1 - beta) * baseline + beta * value;
    }
    return baseline;
  }

  //------------------------------------------------------------------------------
  double updateDynamicThreshold({
    required double currentValue,
    required double baseline, // moves with drift or noise
    required double prevThreshold, // seed with floor on first call!!
    /* key: thrspeed .. larger than baseline beta to ensure that threshold
    is adjusted during recovery samples. Baseline alpha small to prevent
    changes due to "noise". THIS SHOULD UPDATE ONLY DURING RECOVERY!!
    WHEN IN STROKEGAP !!     */
  }) {
    /*Only positive deviations count — recovery lobe should not raise threshold.
    THE DEVIATION IS DIFFERENCE BETWEEN BASELINE AND CURRENT VALUE AND THE SCALE
    SETS THE NEXT REQUIREMENT FOR A STROKE TO COUNT. UPDATE IS EMA SMOOTHED BY
    thrspeed.
    NOISE WILL CREATE FALSE POSITIVES IF SCALE IS 1.0  BUT IF SCALE IS 2.0 WE
    MISS STROKES IF ROWER TIRES
    The Practical Effect . . . Scale is essentially controlling how much a stroke
    must "earn" detection relative to recent effort. At 1.2 it's saying:
    the next stroke must be at least as hard as the last one, with 20% to spare
    for noise rejection. It also interacts with thrspeed — a high scale combined
    with high thrspeed means one big stroke raises the bar sharply and the next
    few strokes may be masked. A high scale with low thrspeed means the bar rises
    slowly and the 20% headroom is spread across several strokes.

    NOTE: WE ARE IN EFFECT DETECTING THE SLOPE OF THE ACCEL SIGNAL DURING THE
    RECOVERY AS IT CROSSES THE THRESHOLD TOWARD A PEAK VALUE DURING THE RECOVERY
    (OR DRIVE) PHASE. (-)ACCEL VALUE MEASURES THE DRIVE PHASE WHICH IS CLOSER
    TO EFFORT !!
    */
    final double deviation = (currentValue - baseline).clamp(
      0.0,
      double.infinity,
    );
    final double target = deviation * scale;
    /* Without the clamp, a deep recovery dip would produce a negative deviation,
     making target negative, pulling the threshold down toward (or into) the floor
     aggressively. That would make the detector hypersensitive right before the
     next catch — likely causing false triggers. With the clamp at 0.0, recovery
     simply contributes target = 0, so the threshold drifts down only via the EMA's
     natural decay toward zero, at a rate controlled by thrspeed. It's a gentle,
     predictable descent rather than a sharp pull-down.
     In short: the clamp makes the threshold asymmetric by design — peaks can raise
     it, but troughs cannot lower it faster than the EMA already does.
    */
    double updated = (1 - thrspeed) * prevThreshold + thrspeed * target;
    // Clamp output — this is also what feeds the *next* call's prevThreshold.
    return updated.clamp(floor, ceiling);
  }

  //----------------------------------------------------------------------------
  // THIS IS THE MAIN METHOD OF THE STROKE DETECTOR CLASS
  void detectStroke(double value, int sampleMs) {
    /* THRESHOLD UPDATED ONLY IF DURING RECOVERY */
    strokeGap = sampleMs - lastStrokeTimeMs;
    // TRUE PREVENTS DOUBLE STROKES
    bool pastGap = strokeGap > minStrokeGapMs;
    /* Crossing threshold with increasing value */
    bool crossedUp = previousvalue < _threshold && value >= _threshold;
    /* Conditions for a "recovery" detected. A recovery counts as a stroke */
    if (crossedUp && pastGap) {
      strokeCount++;
      lastStrokeTimeMs = sampleMs;
      strokeTimes.add(lastStrokeTimeMs);
      Vibration.vibrate(duration: 500); //thigh haptic
      // recovery-based cadence
      xcadence = 60000 / strokeGap;
      // INSERT EMA (MASK MISSED OR FALSE STROKES)
      xcadence = (1 - .5) * _cadence + .5 * xcadence;
      _cadence = xcadence;
      liveCadence.add(xcadence);
      xavgCadence = average(liveCadence); // FOR FINAL REPORT SCREEN
    }
    /* Reset previousvalue and return whether or not a stroke is counted !! */
    previousvalue = value;
  }

  // ONLY for avgCadence screen display
  double get avgCadence => xavgCadence;
  set avgCadence(double avgCadence) {
    avgCadence = avgCadence;
  }

  // GETTER METHODS => returns
  int get strokes => strokeCount; // for rowing screen
  double get cadence => xcadence; // for rowing screen
}
