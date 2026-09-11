import { db } from "../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export default async function useInviteLookup(code) {
  const q = query(collection(db, "leagues"), where("inviteCode", "==", code));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}
