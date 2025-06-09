// In your React component
import * as handpose from "@tensorflow-models/handpose";
import { useEffect, useRef } from "react";

function SignLanguageDetection() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const runHandpose = async () => {
      const net = await handpose.load();
      console.log("Handpose model loaded.");

      // Set up webcam
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        // @ts-ignore
        videoRef.current.srcObject = stream;
        // @ts-ignore
        videoRef.current.onloadedmetadata = () => {
          // @ts-ignore
          videoRef.current.play();
          detect(net);
        };
      }
    };

    // @ts-ignore
    const detect = async (net) => {
      // @ts-ignore
      if (videoRef.current && videoRef.current.readyState === 4) {
        const video = videoRef.current;
        const hand = await net.estimateHands(video);
        // For now, just log the detections
        console.log(hand);

        // You can add drawing logic here later
      }
      requestAnimationFrame(() => detect(net));
    };

    runHandpose();
  }, []);

  return (
    <div>
      <video ref={videoRef} style={{ width: 640, height: 480 }} />
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 640,
          height: 480,
        }}
      />
    </div>
  );
}

export default SignLanguageDetection;
