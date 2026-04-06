import { useState } from "react";
import { db, auth } from "../firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useParams, useNavigate } from "react-router-dom";
import { sendNotification } from "../utils/sendNotification";
import BackButton from "../components/BackButton";
export default function ScheduleSession() {

  const { userId } = useParams();
  const navigate = useNavigate();
  const otherUserId = userId;

  const [date,setDate] = useState("");
  const [time,setTime] = useState("");
  const [skill,setSkill] = useState("");

  const scheduleSession = async () => {

    if(!date || !time) return alert("Select date and time");

    await addDoc(collection(db,"scheduledSessions"),{
      teacherId: auth.currentUser.uid,
      learnerId: userId,
      skill,
      scheduledDate: new Date(`${date}T${time}`),
      status:"scheduled",
      createdAt:serverTimestamp(),
      participants: [auth.currentUser.uid, userId]
    });

    await sendNotification(
      userId,
      `📅 New session scheduled for ${skill} on ${date} at ${time}`,
      "session",
      "Session Scheduled"
    );

    alert("Session Request Sent");

    navigate("/my-sessions");
  };

  return (

    <div style={{padding:"30px"}}>
      <BackButton />
      <h2>Schedule Session</h2>

      <br/>

      <input
        placeholder="Skill"
        value={skill}
        onChange={(e)=>setSkill(e.target.value)}
      />

      <br/><br/>

      <input
        type="date"
        value={date}
        onChange={(e)=>setDate(e.target.value)}
      />

      <br/><br/>

      <input
        type="time"
        value={time}
        onChange={(e)=>setTime(e.target.value)}
      />

      <br/><br/>

      <button onClick={scheduleSession}>
        Schedule Session
      </button>

    </div>

  );
}