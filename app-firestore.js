import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export async function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}
export async function logout() {
  return signOut(auth);
}
export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function getCurrentRole() {
  const user = auth.currentUser;
  if (!user) return null;
  const snap = await getDoc(doc(db, "users", user.uid));
  return snap.exists() ? snap.data().role || "staff" : "staff";
}

export async function createEvent(payload) {
  const clientRef = doc(collection(db, "clients"));
  await setDoc(clientRef, {
    name: payload.clientName || "",
    phone: payload.phone || "",
    email: payload.email || "",
    notes: payload.clientNote || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  const eventRef = doc(collection(db, "events"));
  const eventId = `SC-${payload.date.replaceAll("-", "")}-${eventRef.id.slice(0, 5).toUpperCase()}`;
  await setDoc(eventRef, {
    eventId,
    type: payload.type,
    date: payload.date,
    startTime: payload.startTime,
    guestCount: payload.guestCount,
    status: "inquiry",
    clientId: clientRef.id,
    venue: payload.venue,
    createdBy: auth.currentUser?.uid || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  if (typeof payload.pricePerPerson === "number") {
    await setDoc(doc(db, "events", eventRef.id, "private", "finance"), {
      pricePerPerson: payload.pricePerPerson,
      estimatedTotal: payload.guestCount * payload.pricePerPerson,
      updatedAt: serverTimestamp()
    });
  }
  return { id: eventRef.id, eventId };
}

export async function listEvents() {
  const q = query(collection(db, "events"), orderBy("date", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
