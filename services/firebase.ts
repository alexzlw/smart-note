
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
      let base64Backup = '';

      // Upload image to storage
      if (item.imageUrl && item.imageUrl.startsWith('data:')) {
          // Keep a copy of the Base64 for DB (AI Analysis fallback)
          // Only if it's smaller than ~900KB to respect Firestore 1MB limit
          if (item.imageUrl.length < 950 * 1024) {
              base64Backup = item.imageUrl;
          }

          try {
             finalImageUrl = await firebaseService.uploadImage(user.uid, item.imageUrl);
          } catch(e) {
              console.error("Image upload failed", e);
              // Fallback: If storage upload fails, use the base64 as the main URL (stored in DB)
              // Ensure it fits in document
              if (item.imageUrl.length < 950 * 1024) {
                  finalImageUrl = item.imageUrl;
              } else {
                  throw new Error("Image upload failed and image is too large for offline backup.");
              }
          }
      }

      // Save to Firestore
      // We use the item.id as the document ID for consistency
      await setDoc(doc(db, 'users', user.uid, 'mistakes', item.id), {
        ...item,
        imageUrl: finalImageUrl,
        imageBase64: base64Backup, // Store backup
        userId: user.uid
      });

    } else {
      // Local Mode
      await localDb.addMistake(item);
    }
  },

  getAllMistakes: async (user: User | null): Promise<MistakeItem[]> => {
    if (user) {
      // Cloud Mode
      const mistakesRef = collection(db, 'users', user.uid, 'mistakes');
      // Order by createdAt desc
      const q = query(mistakesRef, orderBy('createdAt', 'desc'));
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
      // If reflection image changed (is base64), upload it too?
      // For simplicity, we currently store reflectionImage as base64 string in DB (if small enough)
      // or we could implement upload logic similar to main image.
      // Current implementation assumes reflectionImage fits in doc limit or we add logic later.
      
      const docRef = doc(db, 'users', user.uid, 'mistakes', item.id);
      await setDoc(docRef, item, { merge: true });
    } else {
      // Local Mode
      await localDb.updateMistake(item);
    }
  },

  deleteMistake: async (user: User | null, id: string, imageUrl?: string) => {
    if (user) {
      // Cloud Mode
      
      // 1. Delete from Firestore
      await deleteDoc(doc(db, 'users', user.uid, 'mistakes', id));

      // 2. Delete image from Storage if it's a cloud URL
      if (imageUrl && imageUrl.startsWith('http')) {
        try {
            // Extract ref from URL or reconstruction isn't easy with tokens.
            // Easier way: Create a ref from URL
            const imageRef = ref(storage, imageUrl);
            await deleteObject(imageRef);
        } catch (e) {
            console.warn("Failed to delete image from storage (might already be gone)", e);
        }
      }

    } else {
      // Local Mode
      await localDb.deleteMistake(id);
    }
  }
};
