import { useEffect } from "react";
import { useState } from "react";
import Sidebar from "../components/Sidebar";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import {
  doc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  getDocs,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";
import SessionReminder from "../components/SessionReminder";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";


export default function Dashboard() {
  const navigate = useNavigate();
  const [callHistory, setCallHistory] = useState([]);
  const [userMap, setUserMap] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState({
    skills: 0,
    incoming: 0,
    open: 0,
    matches: 0,
  });
  const [chartData, setChartData] = useState([]);
  const [callHistoryCount, setCallHistoryCount] = useState(0);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "callHistory"),
      where("participants", "array-contains", auth.currentUser.uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const calls = snap.docs.map(d => d.data());
      setCallHistoryCount(snap.size);

      const last7Days = [];
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        
        const dayCalls = calls.filter(c => {
          if (!c.createdAt) return false;
          const callDate = c.createdAt.toDate();
          return callDate >= date && callDate < nextDate;
        }).length;

        last7Days.push({
          day: dayNames[date.getDay()],
          calls: dayCalls
        });
      }

      setChartData(last7Days);
    });

    return () => unsub();
  }, []);

  const timeAgo = (timestamp) => {
    if (!timestamp) return "";

    const now = new Date();
    const past = timestamp.toDate();
    const diff = Math.floor((now - past) / 1000);

    if (diff < 60) return "Just now";
    if (diff < 3600) return Math.floor(diff / 60) + " mins ago";
    if (diff < 86400) return Math.floor(diff / 3600) + " hrs ago";
    return Math.floor(diff / 86400) + " days ago";
  };

  const [toast, setToast] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [mySkills, setMySkills] = useState([]);
  const [learnSkills, setLearnSkills] = useState([]);
  const [matchCount, setMatchCount] = useState(0);
  const [topMatchUser, setTopMatchUser] = useState("");
  const [gamification, setGamification] = useState({ level: 1, points: 0, badges: [] });
  const [notifCount, setNotifCount] = useState(0);
  const [scheduledCount, setScheduledCount] = useState(0);
  /* ---------------- NOTIFICATION COUNT (REALTIME) ---------------- */
  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", auth.currentUser.uid),
      where("seen", "==", false)
    );

    const unsub = onSnapshot(q, (snap) => {
      setNotifCount(snap.size);
    });

    return () => unsub();
  }, []);

  /* ---------------- SCHEDULED SESSIONS COUNT ---------------- */
  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "scheduledSessions"),
      where("participants", "array-contains", auth.currentUser.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      const now = new Date();
      const count = snap.docs.filter((d) => {
        const data = d.data();
        const sessionDate = data.scheduledDate?.toDate?.();
        return sessionDate && sessionDate >= now;
      }).length;
      setScheduledCount(count);
    });

    return () => unsub();
  }, []);

  /* ---------------- ONLINE / LAST SEEN ---------------- */
  useEffect(() => {
    if (!auth.currentUser) return;

    const userRef = doc(db, "users", auth.currentUser.uid);

    updateDoc(userRef, {
      online: true,
      lastSeen: serverTimestamp(),
    });

    const handleOffline = async () => {
      await updateDoc(userRef, {
        online: false,
        lastSeen: serverTimestamp(),
      });
    };

    window.addEventListener("beforeunload", handleOffline);

    return () => {
      handleOffline();
      window.removeEventListener("beforeunload", handleOffline);
    };
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const map = {};
      snap.forEach(doc => {
        map[doc.id] = doc.data().name || "User";
      });
      setUserMap(map);
    });

    return () => unsub();
  }, []);

  /* ---------------- CALL HISTORY (REALTIME) ---------------- */
  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(collection(db, "callHistory"),
   
      orderBy("createdAt","desc")
    );
    

    const unsub = onSnapshot(q, (snap) => {
      setCallHistory(
        snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(call =>
          call.caller === auth.currentUser.uid ||
          call.receiver === auth.currentUser.uid
        )
        
      );
    });

    return () => unsub();
  }, []);

  /* ---------------- DASHBOARD REALTIME STATS ---------------- */
  useEffect(() => {
    if (!auth.currentUser) return;

    const uid = auth.currentUser.uid;

    /* ---------------- MY SKILLS ---------------- */
    const userRef = doc(db, "users", uid);

    const unsubUser = onSnapshot(userRef, (docSnap) => {
      const data = docSnap.data();
      setStats((prev) => ({
        ...prev,
        skills: (data?.teachSkills?.length || 0),
      }));
    });

    /* ---------------- INCOMING REQUESTS (skillRequests) ---------------- */
    const incomingQuery = query(
      collection(db, "skillRequests"),
      where("receiverId", "==", uid),
      where("status", "==", "pending")
    );

    const unsubIncoming = onSnapshot(incomingQuery, (snap) => {
      setStats((prev) => ({
        ...prev,
        incoming: snap.size,
      }));
    });

    /* ---------------- OPEN REQUESTS (openRequests) ---------------- */
    const openQuery = query(
      collection(db, "openRequests"),
      where("status", "==", "open")
    );

    const unsubOpen = onSnapshot(openQuery, (snap) => {
      setStats((prev) => ({
        ...prev,
        open: snap.size,
      }));
    });

    /* ---------------- ACTIVE MATCHES (Mutual Matches) ---------------- */
    const allOpenQuery = query(
      collection(db, "openRequests"),
      where("status", "==", "open")
    );

    const unsubMatches = onSnapshot(allOpenQuery, (snap) => {
      const allRequests = snap.docs.map((d) => ({
        id: d.id,
        createdBy: d.data().createdBy,
        skill: d.data().skill,
        mySkills: d.data().mySkills || [],
      }));

      const myRequests = allRequests.filter((r) => r.createdBy === uid);

      let matchCount = 0;
      let matchedUserIds = [];
      myRequests.forEach((myReq) => {
        allRequests.forEach((otherReq) => {
          if (otherReq.createdBy === uid) return;
          if (
            otherReq.mySkills.includes(myReq.skill) &&
            myReq.mySkills.includes(otherReq.skill)
          ) {
            matchCount++;
            if (!matchedUserIds.includes(otherReq.createdBy)) {
              matchedUserIds.push(otherReq.createdBy);
            }
          }
        });
      });

      setStats((prev) => ({
        ...prev,
        matches: matchCount,
      }));
      setMatchCount(matchCount);

      /* Find top-rated match user */
      if (matchedUserIds.length > 0) {
        const usersRef = collection(db, "users");
        getDocs(usersRef).then((usersSnap) => {
          const allUsers = usersSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));
          const matchedUsers = allUsers.filter((u) =>
            matchedUserIds.includes(u.id)
          );
          matchedUsers.sort((a, b) => (b.rating || 0) - (a.rating || 0));
          if (matchedUsers.length > 0) {
            setTopMatchUser(matchedUsers[0].name || "User");
          }
        });
      } else {
        setTopMatchUser("");
      }
    });

    return () => {
      unsubUser();
      unsubIncoming();
      unsubOpen();
      unsubMatches();
    };
  }, []);

  /* ---------------- LIVE ACTIVITY ---------------- */
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    const q = query(collection(db, "requests"));

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => doc.data());
      setActivities(data.slice(0, 5));
    });

    return () => unsub();
  }, []);

  /* ---------------- ONLINE USERS ---------------- */
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    const q = query(collection(db, "users"), where("online", "==", true));

    const unsub = onSnapshot(q, (snap) => {
      setOnlineUsers(
        snap.docs.map(d => d.data().name || "User")
      );
    });

    return () => unsub();
  }, []);

  /* ---------------- INCOMING REQUESTS TOAST ---------------- */
  useEffect(() => {
    if (!auth.currentUser) return;

    const uid = auth.currentUser.uid;
    const incomingQuery = query(
      collection(db, "skillRequests"),
      where("receiverId", "==", uid),
      where("status", "==", "pending")
    );

    let previousCount = 0;

    const unsub = onSnapshot(incomingQuery, (snap) => {
      if (snap.size > previousCount && previousCount > 0) {
        setToast("🔥 New Request Received!");
        setTimeout(() => setToast(""), 3000);
      }
      previousCount = snap.size;
    });

    return () => unsub();
  }, []);

  /* ---------------- AI SUGGESTIONS (REALTIME) ---------------- */
  useEffect(() => {
    if (!auth.currentUser) return;

    const userRef = doc(db, "users", auth.currentUser.uid);
    const unsub = onSnapshot(userRef, (snap) => {
      if (!snap.exists()) return;

      const data = snap.data();
      const teachSkills = (data?.teachSkills || []).map((s) =>
        typeof s === "string" ? s.toLowerCase() : (s.name || "").toLowerCase()
      );
      const learnSkills = (data?.learnSkills || []).map((s) =>
        typeof s === "string" ? s.toLowerCase() : (s.name || "").toLowerCase()
      );
      const sessionsCompleted = data?.sessionsCompleted || 0;

      const skillMap = {
        java: ["spring boot", "microservices", "backend"],
        javascript: ["react", "node.js", "typescript"],
        react: ["next.js", "redux", "tailwind css"],
        python: ["django", "flask", "machine learning"],
        "node.js": ["express.js", "mongodb", "rest api"],
        html: ["css", "responsive design", "tailwind css"],
        css: ["sass", "tailwind css", "animations"],
        mongodb: ["mongoose", "firebase", "postgresql"],
        sql: ["postgresql", "database design", "mysql"],
        flutter: ["dart", "firebase", "mobile ui"],
        firebase: ["cloud functions", "firestore", "authentication"],
        git: ["github actions", "ci/cd", "version control"],
        "machine learning": ["tensorflow", "pytorch", "data science"],
        ai: ["prompt engineering", "llm", "nlp"],
      };

      const trendingSkills = [
        "ai & prompt engineering",
        "next.js",
        "tailwind css",
        "typescript",
        "docker",
      ];

      const suggestions = [];

      /* Line 1: Related skills based on user's skills */
      let relatedSuggestion = null;
      for (const skill of teachSkills) {
        for (const [key, related] of Object.entries(skillMap)) {
          if (skill.includes(key) || key.includes(skill)) {
            const unlearned = related.filter(
              (r) =>
                !teachSkills.some((ts) => ts.includes(r)) &&
                !learnSkills.some((ls) => ls.includes(r))
            );
            if (unlearned.length > 0) {
              relatedSuggestion = `Learn ${unlearned[0]}`;
              break;
            }
          }
        }
        if (relatedSuggestion) break;
      }

      if (!relatedSuggestion && teachSkills.length > 0) {
        relatedSuggestion = `Master ${teachSkills[0]} advanced concepts`;
      }

      if (!relatedSuggestion) {
        relatedSuggestion = `Learn ${trendingSkills[0]}`;
      }

      suggestions.push(relatedSuggestion);

      /* Line 2: Explore trending / new skills */
      const unlearnedTrending = trendingSkills.filter(
        (t) =>
          !teachSkills.some((ts) => ts.includes(t)) &&
          !learnSkills.some((ls) => ls.includes(t))
      );

      if (unlearnedTrending.length > 0) {
        suggestions.push(`Explore ${unlearnedTrending[0]}`);
      } else {
        suggestions.push("Explore cross-discipline skills");
      }

      /* Line 3: Activity-based suggestion */
      if (sessionsCompleted === 0) {
        suggestions.push("Start your first session 🚀");
      } else if (sessionsCompleted < 3) {
        suggestions.push("Connect with similar users");
      } else {
        suggestions.push("Share your knowledge with beginners");
      }

      setSuggestions(suggestions);
    });

    return () => unsub();
  }, []);

  /* ---------------- MY SKILLS (REALTIME) ---------------- */
  useEffect(() => {
    if (!auth.currentUser) return;

    const userRef = doc(db, "users", auth.currentUser.uid);
    const unsub = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const skills = data?.teachSkills || [];
        const learn = data?.learnSkills || [];
        setMySkills(Array.isArray(skills) ? skills : []);
        setLearnSkills(Array.isArray(learn) ? learn : []);

        /* Gamification calculation */
        const sessionsCompleted = data?.sessionsCompleted || 0;
        const rating = data?.rating || 0;
        const totalReviews = data?.totalReviews || 0;

        let points = 0;
        points += sessionsCompleted * 50;
        points += totalReviews * 20;
        if (rating >= 4) points += 100;
        else if (rating >= 3) points += 50;

        let level = 1;
        if (points >= 500) level = 5;
        else if (points >= 350) level = 4;
        else if (points >= 200) level = 3;
        else if (points >= 100) level = 2;

        const badges = [];
        if (sessionsCompleted >= 1) badges.push("🎯");
        if (rating >= 4) badges.push("🏆");
        if (totalReviews >= 3) badges.push("⭐");
        if (sessionsCompleted >= 5) badges.push("🔥");
        if (rating >= 4.5) badges.push("🥇");
        if (badges.length === 0) badges.push("🌱");

        setGamification({ level, points, badges });
      }
    });

    return () => unsub();
  }, []);


  const logout = async () => {
    if (auth.currentUser) {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        online: false,
        lastSeen: serverTimestamp(),
      });
    }
    await signOut(auth);
    window.location.href = "/login";
  };


  /* ---------------- BUTTON ACTIONS ---------------- */
  const handleStartConnect = () => {
    navigate("/send-request");
  };

  return (
    <div className="dashboard-page">
      
    <div className="dashboard-layout">
      <SessionReminder />
      <Sidebar isOpen={sidebarOpen} />

      <div className="dashboard-main">

        {/* {false && profile.photoURL &&<img src={Profile.photoURL}/>} */}
        {/* TOPBAR */}
        <div className="topbar">
          <button className="menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
          <div className="notif-wrapper" onClick={() => navigate("/notifications")}>
            <button className="notif-btn">🔔</button>
            {notifCount > 0 && <span className="notif-badge">{notifCount}</span>}
          </div>
          <button onClick={() => navigate("/my-sessions")}>
            📅 My Sessions {scheduledCount > 0 && <span className="scheduled-badge">{scheduledCount}</span>}
          </button>
          <button className="logout-btn" onClick={logout}> 
            Logout
          </button>
        </div>

        <div className="dashboard-content">
          <h1>Dashboard</h1>
          <p className="subtitle">Realtime Skill Exchange Platform</p>

          {/* STATS */}
          <div className="stats">
            <div className="card">⭐ <h2>{stats.skills}</h2><p>My Skills</p></div>
            <div className="card">📩 <h2>{stats.incoming}</h2><p>Incoming Requests</p></div>
            <div className="card">📂 <h2>{stats.open}</h2><p>Open Requests</p></div>
            <div className="card">⚡ <h2>{stats.matches}</h2><p>Active Matches</p></div>
          </div>

          {/* QUICK ACTIONS */}
          <div className="welcome-box">
            <h3>Welcome 👋 {auth.currentUser?.email}</h3>
            <p>Start connecting and explore realtime collaboration 🚀</p>

            <div className="actions">
              <button onClick={handleStartConnect}>🤝 Start Connect</button>
              <button onClick={() => navigate("/send-request")}>➕ Create Request</button>
              <button onClick={() => navigate("/open-requests")}>🔍 Find Matches</button>
            </div>
          </div>

          {/* MAIN GRID */}
          <div className="grid">

            {/* LEFT SIDE */}
            <div className="left">
              <div className="panel">
                <h3>🤖 Recommended</h3>
                {learnSkills.length === 0 && matchCount === 0 && !topMatchUser && (
                  <p>No recommendations yet</p>
                )}
                {learnSkills.map((s, i) => (
                  <p key={`learn-${i}`}>• Learn {typeof s === "string" ? s : s.name}</p>
                ))}
                {matchCount > 0 && (
                  <p>• {matchCount} Matching Request{matchCount > 1 ? "s" : ""}</p>
                )}
                {topMatchUser && (
                  <p>• Connect with {topMatchUser}</p>
                )}
              </div>

              <div className="panel">
                <h3>🏆 Level {gamification.level}</h3>
                <p>Points: {gamification.points}</p>
                <p>Badges: {gamification.badges.join(" ")}</p>
              </div>

              <div className="panel">
                <h3>🤖 AI Suggestions</h3>
                {suggestions.map((s, i) => (
                  <p key={i}>• {s}</p>
                ))}
              </div>
            </div>

            {/* RIGHT SIDE */}
            <div className="right">
              <div className="panel">
                <h3>🔥 Live Activity</h3>
                {activities.map((item, i) => (
                  <p key={i}>
                    {item.sender || "User"} created request
                  </p>
                ))}
              </div>

              <div className="panel">
                <h3>📞 Recent Calls</h3>
                {callHistory.length === 0 ? (
                  <p>No calls yet</p>
                ) : (
                  callHistory.slice(0, 5).map(call => {
                    const otherUid = call.caller === auth.currentUser.uid ? call.receiver : call.caller;
                    const otherName = userMap[otherUid] || "User";
                    return (
                      <p key={call.id}>
                        {otherName} - {timeAgo(call.createdAt)}
                      </p>
                    );
                  })
                )}
              </div>

              <div className="panel">
                <h3>🟢 Online Users</h3>
                {onlineUsers.map((user, i) => (
                  <p key={i}>{user}</p>
                ))}
              </div>

              <div className="panel">
                <h3>⭐ My Skills</h3>
                {mySkills.length === 0 ? (
                  <p>No skills added yet</p>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {mySkills.map((s, i) => (
                      <span
                        key={i}
                        style={{
                          background: "#e0f2fe",
                          color: "#0369a1",
                          padding: "4px 12px",
                          borderRadius: "20px",
                          fontSize: "12px",
                          fontWeight: "500",
                        }}
                      >
                        {s.name} ({s.level})
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* GRAPH */}
          <div className="graph">
            <h3>📈 Activity Overview</h3>

            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="calls" stroke="#2563eb" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {toast && (
          <div className="toast">
            {toast}
          </div>
        )}

        {/* FLOAT CHAT */}
        <div className="chat-btn" onClick={() => navigate("/messages")}>💬</div>
</div>

      </div>
    </div>

  );
}