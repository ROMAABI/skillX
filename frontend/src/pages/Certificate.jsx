import React, { useRef, useEffect, useState } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import BackButton from "../components/BackButton";

export default function Certificate() {
  const certRef = useRef();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!auth.currentUser) return;
      const snap = await getDoc(doc(db, "users", auth.currentUser.uid));
      if (snap.exists()) setProfile(snap.data());
    };
    fetchProfile();
  }, []);

  if (!profile) return <div>Loading...</div>;

  const getBadge = () => {
    if (!profile) return "🎓 Beginner";
    if (profile.rating >= 4.5) return "🏆 Top Mentor";
    if (profile.rating >= 4) return "⭐ Expert";
    if (profile.rating >= 3) return "👍 Skilled";
    return "🎓 Beginner";
  };

  const downloadPDF = async () => {
    const canvas = await html2canvas(certRef.current);
    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF("landscape");
    pdf.addImage(imgData, "PNG", 10, 10, 280, 150);
    pdf.save("certificate.pdf");
  };

  return (
    <div style={{ padding: "20px" }}>
      <BackButton />
      <div
        ref={certRef}
        style={{
          padding: "40px",
          textAlign: "center",
          background: "linear-gradient(135deg, #2563eb, #38bdf8)",
          color: "white",
          border: "8px solid gold",
          borderRadius: "20px"
        }}
      >
        <h1>🏆 Certificate of Completion</h1>

        <h2>{profile.name}</h2>

        <p>has successfully completed skill exchange sessions</p>

        <h3>🏅 {getBadge()}</h3>

        <p>⭐ Rating: {profile.rating}</p>
        <p>💬 Reviews: {profile.totalReviews}</p>
        <p>🎓 Sessions: {profile.sessionsCompleted}</p>

        <p>SkillX Platform</p>
      </div>

      <button onClick={downloadPDF}>Download</button>
    </div>
  );
}