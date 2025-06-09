import * as handpose from "@tensorflow-models/handpose";
import * as tf from "@tensorflow/tfjs";
import { useEffect, useRef, useState } from "react";

export default function GestureDataCollector() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [model, setModel] = useState<handpose.HandPose | null>(null);
  const [collecting, setCollecting] = useState(false);
  const [label, setLabel] = useState("");
  type Sample = { label: string; landmarks: number[][] };
  const [data, setData] = useState<Sample[]>([]);

  useEffect(() => {
    async function loadModel() {
      await tf.setBackend("webgl");
      const handposeModel = await handpose.load();
      setModel(handposeModel);
    }
    loadModel();

    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
      if (videoRef.current) videoRef.current.srcObject = stream;
    });
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (model && collecting) {
      interval = setInterval(async () => {
        if (!videoRef.current) return;
        const predictions = await model.estimateHands(videoRef.current);
        if (predictions.length > 0) {
          const landmarks = predictions[0].landmarks;
          setData((prev) => {
            const updated = [...prev, { label, landmarks }];
            if (updated.length % 100 === 0) {
              setCollecting(false);
              // setTimeout(() => downloadData(updated), 500); // slight delay to avoid conflicts
            }
            return updated;
          });
          console.log("Collected", label, landmarks);
        }
      }, 200);
    }
    return () => clearInterval(interval);
  }, [collecting, model, label]);

  const downloadData = (customData = data) => {
    const blob = new Blob([JSON.stringify(customData)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gesture-${label}-${customData.length}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <video ref={videoRef} autoPlay playsInline width="400" />
      <div>
        <input
          type="text"
          placeholder="Gesture Label (e.g. hello)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <button
          onClick={() => setCollecting(!collecting)}
          disabled={!label}
          style={{ marginLeft: "10px" }}
        >
          {collecting ? "Stop Collecting" : "Start Collecting"}
        </button>
        <button onClick={() => downloadData()} disabled={data.length === 0}>
          Download Data
        </button>
      </div>
      <p>Collected Samples: {data.length}</p>
    </div>
  );
}
