import { db, auth } from "../firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

const uploadToCloudinary = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", "skillx_files");

  try {
    const res = await fetch(
      "https://api.cloudinary.com/v1_1/dyvfflwuo/auto/upload",
      {
        method: "POST",
        body: formData,
      }
    );
    const data = await res.json();
    return data.secure_url;
  } catch (err) {
    console.error("Cloudinary upload error:", err);
    return null;
  }
};

export default function FileUpload({ chatId }) {

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const url = await uploadToCloudinary(file);
    if (!url) return;

    await addDoc(collection(db, "chats", chatId, "messages"), {
      type: "file",
      fileUrl: url,
      fileName: file.name,
      senderId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      seenBy: [auth.currentUser.uid]
    });
  };

  return (
    <label style={{ cursor: "pointer", fontSize: "20px", display: "flex", alignItems: "center" }}>
      📎
      <input
        type="file"
        onChange={handleFile}
        style={{ display: "none" }}
      />
    </label>
  );
}
