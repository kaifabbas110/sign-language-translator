// src/VideoCall.js
import * as handpose from "@tensorflow-models/handpose";
import * as tf from "@tensorflow/tfjs";
import { useEffect, useRef, useState } from "react";
import Peer from "simple-peer";
import io from "socket.io-client";
import { classifyGestureAPI } from "../utils/classifyGestureAPI";

// Connect to the signaling server
const socket = io("https://7769-182-190-201-222.ngrok-free.app", {
  transports: ["websocket"],
});

export default function VideoCall() {
  // State variables
  const [myID, setMyID] = useState("");
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller] = useState("");
  const [callerSignal, setCallerSignal] = useState();
  const [callAccepted, setCallAccepted] = useState(false);
  const [idToCall, setIdToCall] = useState("");
  const [callEnded, setCallEnded] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [detectedGesture, setDetectedGesture] =
    useState<string>("No Hand Detected");
  const [peerGesture, setPeerGesture] = useState<string>("No Hand Detected");
  // Refs
  const myVideo = useRef<HTMLVideoElement | null>(null);
  const userVideo = useRef<HTMLVideoElement | null>(null);
  const connectionRef = useRef<Peer.Instance | null>(null);
  const handposeModel = useRef<handpose.HandPose | null>(null);

  useEffect(() => {
    const loadHandpose = async () => {
      await tf.setBackend("webgl");
      handposeModel.current = await handpose.load();
      console.log("Handpose model loaded.");
      setModelLoaded(true);
    };
    loadHandpose();
  }, []);

  useEffect(() => {
    if (stream) {
      stream.getTracks().forEach((track) => {
        console.log(
          `Track: ${track.kind}, enabled: ${track.enabled}, muted: ${track.muted}`
        );
      });
    }

    if (myVideo.current && stream) {
      myVideo.current.srcObject = stream;
      myVideo.current
        .play()
        .catch((e) => console.error("Local video error", e));

      myVideo.current.onloadedmetadata = () => {
        myVideo?.current
          ?.play()
          ?.catch((e) => console.error("Error playing video:", e));
      };
      if (myVideo.current.readyState >= 2) {
        myVideo.current
          .play()
          .catch((e) => console.error("Error playing video:", e));
      }
    }
  }, [stream]);

  useEffect(() => {
    const initMedia = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          alert("getUserMedia is not supported on this device/browser");
          return;
        }

        // Step 1: Get video stream
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });

        console.log("Video stream tracks:", videoStream.getTracks());

        // Step 2: Check if audioinput exists
        const devices = await navigator.mediaDevices.enumerateDevices();
        console.log("Available media devices:");
        devices.forEach((device) => console.log(device.kind, device.label));

        const hasMic = devices.some((device) => device.kind === "audioinput");

        // Step 3: Merge video + audio if mic exists
        if (hasMic) {
          try {
            const audioStream = await navigator.mediaDevices.getUserMedia({
              audio: true,
            });
            const combined = new MediaStream([
              ...videoStream.getTracks(),
              ...audioStream.getTracks(),
            ]);
            setStream(combined);
          } catch (err) {
            console.warn(
              "Mic access denied or unavailable. Using video only.",
              err
            );
            setStream(videoStream);
          }
        } else {
          console.warn("No mic found. Using video only.");
          setStream(videoStream);
        }
      } catch (error) {
        console.error("Failed to access media devices:", error);
      }
    };

    initMedia();

    socket.on("me", (id) => {
      console.log({ id });
      setMyID(id);
    });

    socket.on("callUser", (data) => {
      setReceivingCall(true);
      setCaller(data.from);
      setCallerSignal(data.signal);
    });
  }, []);

  // --- Gesture detection + sending to peer ---
  useEffect(() => {
    if (connectionRef.current && connectionRef.current.connected) {
      // Send detected gesture string as JSON to peer
      connectionRef.current.send(
        JSON.stringify({ type: "gesture", gesture: detectedGesture })
      );
    }

    if (stream && modelLoaded && handposeModel.current && !callEnded) {
      const detect = async () => {
        if (myVideo.current) {
          const hands = await handposeModel?.current?.estimateHands(
            myVideo.current,
            false
          );
          if (hands && hands.length > 0 && hands[0].landmarks) {
            console.log("Sending landmarks:", hands[0].landmarks);
            const gesture = await classifyGestureAPI(hands[0].landmarks);
            console.log({ gesture });
            setDetectedGesture(gesture);
          } else {
            setDetectedGesture("No Hand Detected");
          }
        }
      };

      const intervalId = setInterval(detect, 100);
      return () => clearInterval(intervalId);
    }
  }, [stream, modelLoaded, callEnded, detectedGesture]); // added detectedGesture so send happens on change

  // --- Peer data channel handler (to receive gesture from remote) ---
  const setupDataHandler = (peer: Peer.Instance) => {
    peer.on("data", (data) => {
      try {
        const message = JSON.parse(data);
        if (message.type === "gesture") {
          setPeerGesture(message.gesture);
        }
      } catch (err) {
        console.error("Error parsing data channel message", err);
      }
    });
  };

  // --- Call a user ---
  const callUser = (id: string) => {
    stream?.getTracks().forEach((track) => {
      console.log(`Ensuring ${track.kind} track is enabled`);
      track.enabled = true;
    });

    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: stream || undefined,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          {
            urls: "turn:openrelay.metered.ca:80",
            username: "openrelayproject",
            credential: "openrelayproject",
          },
        ],
      },
    });

    console.log("Local stream before sending to peer:", stream);
    if (stream) {
      console.log("Tracks:", stream.getTracks());
    }

    peer.on("signal", (data) => {
      socket.emit("callUser", {
        userToCall: id,
        signalData: data,
        from: myID,
      });
    });

    peer.on("stream", (stream) => {
      console.log("✅ Remote stream received via .on('stream')", stream);
      if (userVideo.current) {
        userVideo.current.srcObject = stream;

        userVideo.current.onloadedmetadata = () => {
          userVideo.current
            ?.play()
            .catch((err) =>
              console.error("✅ Error playing remote video on stream:", err)
            );
        };

        if (userVideo.current.readyState >= 2) {
          userVideo.current
            .play()
            .catch((err) =>
              console.error("✅ Error forcing remote video play (stream):", err)
            );
        }
      }
    });

    peer.on("track", (track, stream) => {
      console.log("✅ Received track", track);
      console.log("Track kind:", track.kind);
      console.log("Stream from track event:", stream);

      if (userVideo.current) {
        userVideo.current.srcObject = stream;

        // ✅ Force play video properly
        userVideo.current.onloadedmetadata = () => {
          userVideo.current
            ?.play()
            .catch((err) =>
              console.error(
                "✅ Error playing remote video on loadedmetadata:",
                err
              )
            );
        };

        if (userVideo.current.readyState >= 2) {
          userVideo.current
            .play()
            .catch((err) =>
              console.error("✅ Error forcing remote video play:", err)
            );
        }
      }
    });

    setupDataHandler(peer); // NEW: setup data channel handler

    socket.on("callAccepted", (signal) => {
      setCallAccepted(true);
      peer.signal(signal);
    });
    peer.on("connect", () => {
      console.log("P2P connection established!");
    });

    connectionRef.current = peer;
  };

  // --- Answer an incoming call ---
  const answerCall = () => {
    stream?.getTracks().forEach((track) => {
      console.log(`Ensuring ${track.kind} track is enabled`);
      track.enabled = true;
    });

    setCallAccepted(true);
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream: stream || undefined,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          {
            urls: "turn:openrelay.metered.ca:80",
            username: "openrelayproject",
            credential: "openrelayproject",
          },
        ],
      },
    });

    console.log("Local stream before sending to peer:", stream);
    if (stream) {
      console.log("Tracks:", stream.getTracks());
    }

    peer.on("signal", (data) => {
      socket.emit("answerCall", { signal: data, to: caller });
    });

    peer.on("stream", (stream) => {
      console.log("✅ Remote stream answered via .on('stream')", stream);
      if (userVideo.current) {
        userVideo.current.srcObject = stream;

        userVideo.current.onloadedmetadata = () => {
          userVideo.current
            ?.play()
            .catch((err) =>
              console.error("✅ Error playing remote video on stream:", err)
            );
        };

        if (userVideo.current.readyState >= 2) {
          userVideo.current
            .play()
            .catch((err) =>
              console.error("✅ Error forcing remote video play (stream):", err)
            );
        }
      }
    });

    peer.on("track", (track, stream) => {
      console.log("✅ Received track", track);
      console.log("Track kind:", track.kind);
      console.log("Stream from track event:", stream);

      if (userVideo.current) {
        userVideo.current.srcObject = stream;

        // ✅ Force play video properly
        userVideo.current.onloadedmetadata = () => {
          userVideo.current
            ?.play()
            .catch((err) =>
              console.error(
                "✅ Error playing remote video on loadedmetadata:",
                err
              )
            );
        };

        if (userVideo.current.readyState >= 2) {
          userVideo.current
            .play()
            .catch((err) =>
              console.error("✅ Error forcing remote video play:", err)
            );
        }
      }
    });

    peer.on("connect", () => {
      console.log("P2P connection established!");
    });

    setupDataHandler(peer); // NEW: setup data channel handler

    peer.signal(callerSignal ?? "");
    connectionRef.current = peer;
  };

  const leaveCall = () => {
    setCallEnded(true);
    if (connectionRef.current) {
      connectionRef.current.destroy();
    }
    window.location.reload();
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Sign Language Video Call</h1>
      <div className="video-container" style={{ display: "flex", gap: "20px" }}>
        <div className="my-video">
          <h3>My Video</h3>
          {stream && (
            <video
              playsInline
              muted
              controls
              ref={myVideo}
              autoPlay
              style={{ width: "400px", border: "2px solid black" }}
            />
          )}
          <h2 style={{ color: "red" }}>Detected: {detectedGesture}</h2>
        </div>
        <div className="user-video">
          <h3>Peer's Video</h3>
          {callAccepted && !callEnded ? (
            <>
              <video
                playsInline
                ref={userVideo}
                autoPlay
                muted={false}
                style={{
                  width: "400px",
                  height: "auto",
                  border: "2px solid black",
                  backgroundColor: "black", // ✅ helpful for debug visibility
                }}
              />
              <h2 style={{ color: "blue" }}>Detected: {peerGesture}</h2>{" "}
              {/* NEW: show peer's detected gesture */}
            </>
          ) : null}
        </div>
      </div>

      <div className="controls" style={{ marginTop: "20px" }}>
        <p>Your ID: {myID}</p>
        <input
          type="text"
          placeholder="ID to call"
          value={idToCall}
          onChange={(e) => setIdToCall(e.target.value)}
        />
        {callAccepted && !callEnded ? (
          <button
            onClick={leaveCall}
            style={{ backgroundColor: "red", color: "white" }}
          >
            Hang Up
          </button>
        ) : (
          <button
            onClick={() => callUser(idToCall)}
            style={{ backgroundColor: "green", color: "white" }}
            disabled={!stream}
          >
            Call
          </button>
        )}
      </div>

      {receivingCall && !callAccepted ? (
        <div className="incoming-call" style={{ marginTop: "20px" }}>
          <h3>{caller} is calling you</h3>
          <button onClick={answerCall}>Answer</button>
        </div>
      ) : null}
    </div>
  );
}
