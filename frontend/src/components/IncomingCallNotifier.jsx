import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { query, collection, where, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function IncomingCallNotifier() {
  const [incomingCall, setIncomingCall] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "calls"),
      where("receiver", "==", auth.currentUser.uid),
      where("status", "==", "ringing")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const callDoc = snapshot.docs[0];
        const data = callDoc.data();
        setIncomingCall({ ...data, docId: callDoc.id });
      } else {
        setIncomingCall(null);
      }
    });

    return () => unsub();
  }, []);

  const handleAccept = async () => {
    if (!incomingCall) return;
    await updateDoc(doc(db, "calls", incomingCall.docId), {
      status: "accepted",
    });
    navigate(`/video-call/${incomingCall.roomID}?User=${incomingCall.caller}&name=${incomingCall.callerName}`);
    setIncomingCall(null);
  };

  const handleReject = async () => {
    if (!incomingCall) return;
    await updateDoc(doc(db, "calls", incomingCall.docId), {
      status: "rejected",
    });
    setIncomingCall(null);
  };

  if (!incomingCall) return null;

  return (
    <>
      <style>{`
        .call-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999999;
          animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .call-card {
          background: linear-gradient(145deg, #1a1a2e, #16213e);
          padding: 40px 50px;
          border-radius: 25px;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          animation: slideUp 0.4s ease;
        }
        @keyframes slideUp {
          from { transform: translateY(50px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .call-avatar {
          width: 100px;
          height: 100px;
          border-radius: 50%;
          background: #4ade80;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          font-size: 50px;
          animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        .call-title {
          color: #4ade80;
          font-size: 14px;
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 2px;
        }
        .call-name {
          color: white;
          font-size: 28px;
          font-weight: 600;
          margin: 0 0 10px;
        }
        .call-type {
          color: #94a3b8;
          font-size: 16px;
          margin-bottom: 30px;
        }
        .call-buttons {
          display: flex;
          gap: 30px;
          justify-content: center;
        }
        .call-btn {
          width: 70px;
          height: 70px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          font-size: 30px;
          transition: transform 0.2s;
        }
        .call-btn:hover {
          transform: scale(1.1);
        }
        .accept-btn {
          background: #22c55e;
          box-shadow: 0 0 20px rgba(34, 197, 94, 0.5);
        }
        .reject-btn {
          background: #ef4444;
          box-shadow: 0 0 20px rgba(239, 68, 68, 0.5);
        }
      `}</style>

      <div className="call-overlay">
        <div className="call-card">
          <div className="call-avatar">📞</div>
          <div className="call-title">Incoming {incomingCall.type || "Video"} Call</div>
          <div className="call-name">{incomingCall.callerName}</div>
          <div className="call-type">Calling...</div>
          <div className="call-buttons">
            <button className="call-btn reject-btn" onClick={handleReject}>✕</button>
            <button className="call-btn accept-btn" onClick={handleAccept}>✓</button>
          </div>
        </div>
      </div>
    </>
  );
}
