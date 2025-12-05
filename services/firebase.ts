
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs, orderBy, setDoc } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { MistakeItem } from '../types';
import { dbService as localDb } from './db';

// ------------------------------------------------------------------
// 【重要】请将下面的 firebaseConfig 内容替换为你从 Firebase 控制台复制的内容
// 1. Go to Firebase Console -> Project Settings (左上角齿轮图标)
// 2. Scroll down to "Your apps" (如果没有 App，点击 </> 图标创建一个 Web App)
// 3. Copy the "firebaseConfig" object
// ------------------------------------------------------------------
const firebaseConfig = {
  // 这里的 YOUR_... 都是占位符，请用真实数据替换整个对象
  apiKey: "AIzaSyBnZqJXPcGovWkiB2UX_UquydvV3jE8tLM",
  authDomain: "smartnote-for-genya.firebaseapp.com",
  projectId: "smartnote-for-genya",
  storageBucket: "smartnote-for-genya.firebasestorage.app",
  messagingSenderId: "581226886294",
  appId: "1:581226886294:web:c6b40ba38eb461344b7eb7",
  measurementId: "G-HBFH08MSQ9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
const provider = new GoogleAuthProvider();

export const firebaseService = {
  // --- Auth ---
  login: async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
      throw error;
    }
  },

  logout: async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  },

  // --- Hybrid Logic (Cloud vs Local) ---
  
  // Helper to upload image to Firebase Storage if logged in
  uploadImage: async (userId: string, dataUrl: string): Promise<string> => {
    // If it's not base64/dataurl, assume it's already a URL
    if (!dataUrl.startsWith('data:')) return dataUrl;

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const storageRef = ref(storage, `users/${userId}/images/${timestamp}_${random}.jpg`);
    
    // 60s timeout for high quality images
    const timeoutMs = 60000; 
    
    const uploadTask = uploadString(storageRef, dataUrl, 'data_url');
    
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Image upload timed out (60s). Check connection.")), timeoutMs);
    });

    await Promise.race([uploadTask, timeoutPromise]);
    return await getDownloadURL(storageRef);
  },

  // --- Database Operations ---

  addMistake: async (user: User | null, item: MistakeItem) => {
    if (user) {
      // Cloud Mode
      let finalImageUrl = item.imageUrl || '';
      // Upload image to storage to save DB space
      if (item.imageUrl && item.imageUrl.startsWith('data:')) {
          try {
             finalImageUrl = await firebaseService.uploadImage(user.uid, item.imageUrl);
          } catch(e) {
              console.error("Image upload failed", e);
              // Since on Blaze, we prefer to fail rather than bloating DB with base64 
              // (unless you want a fallback, but users usually prefer knowing it failed)
              throw new Error("Failed to upload image. Please check network.");
          }
      }

      const docRef = doc(db, 'users', user.uid, 'mistakes', item.id);
      await setDoc(docRef, { ...item, imageUrl: finalImageUrl });
    } else {
      // Local Mode
      await localDb.addMistake(item);
    }
  },

  getAllMistakes: async (user: User | null): Promise<MistakeItem[]> => {
    if (user) {
      // Cloud Mode
      const q = query(collection(db, 'users', user.uid, 'mistakes'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as MistakeItem);
    } else {
      // Local Mode
      return await localDb.getAllMistakes();
    }
  },

  updateMistake: async (user: User | null, item: MistakeItem) => {
    if (user) {
      // Cloud Mode
      let finalImageUrl = item.imageUrl || '';
      
      // If image changed to a new base64, upload it
      if (item.imageUrl && item.imageUrl.startsWith('data:')) {
           finalImageUrl = await firebaseService.uploadImage(user.uid, item.imageUrl);
      }

      const docRef = doc(db, 'users', user.uid, 'mistakes', item.id);
      await updateDoc(docRef, { ...item, imageUrl: finalImageUrl });
    } else {
      // Local Mode
      await localDb.updateMistake(item);
    }
  },

  deleteMistake: async (user: User | null, id: string, imageUrl?: string) => {
    if (user) {
      // Cloud Mode
      await deleteDoc(doc(db, 'users', user.uid, 'mistakes', id));
      
      // Try delete image from storage if it is a cloud URL
      if (imageUrl && imageUrl.includes('firebasestorage')) {
          try {
              const imageRef = ref(storage, imageUrl);
              await deleteObject(imageRef);
          } catch(e) {
              console.log("Could not delete cloud image (might not exist)", e);
          }
      }
    } else {
      // Local Mode
      await localDb.deleteMistake(id);
    }
  }
};
