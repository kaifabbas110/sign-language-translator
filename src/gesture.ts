// This is our simplified classification logic
export const classifyGesture = (landmarks: number[][]) => {
  if (landmarks.length === 0) {
    return "No Hand";
  }

  // A simple check for a fist:
  // Are the fingertips (e.g., landmark 8 for index finger tip)
  // lower (higher y-value) than the middle knuckle (landmark 6)?

  const indexTipY = landmarks[8][1]; // landmark 8, y-coordinate
  const indexKnuckleY = landmarks[6][1]; // landmark 6, y-coordinate

  const middleTipY = landmarks[12][1];
  const middleKnuckleY = landmarks[10][1];

  const ringTipY = landmarks[16][1];
  const ringKnuckleY = landmarks[14][1];

  const pinkyTipY = landmarks[20][1];
  const pinkyKnuckleY = landmarks[18][1];

  // If all fingertips are below their respective knuckles, it's likely a fist
  if (
    indexTipY > indexKnuckleY &&
    middleTipY > middleKnuckleY &&
    ringTipY > ringKnuckleY &&
    pinkyTipY > pinkyKnuckleY
  ) {
    return "Fist ✊";
  }

  // A simple check for an open palm:
  // This is less precise, but we can assume if it's not a fist and a hand is present, it's open.
  // A better check would be to see if fingertips are far from the palm base.
  // For now, this is enough for a demo.

  // Let's add a "Thumbs Up" check for variety
  const thumbTipY = landmarks[4][1];
  const thumbDipY = landmarks[3][1]; // The joint below the tip

  // If the thumb tip is significantly above its lower joint, and other fingers are curled...
  if (
    thumbTipY < thumbDipY &&
    indexTipY > indexKnuckleY &&
    middleTipY > middleKnuckleY
  ) {
    return "Thumbs Up 👍";
  }

  return "Open Palm 🖐️";
};
