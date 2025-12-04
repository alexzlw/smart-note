import { MistakeItem } from '../types';

const DB_NAME = 'SmartNoteDB';
const DB_VERSION = 1;
const STORE_NAME = 'mistakes';

// Open database connection
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("IndexedDB error:", event);
      reject("Error opening database");
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };
  });
};

export const dbService = {
  // Get all mistakes
  getAllMistakes: async (): Promise<MistakeItem[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        // Sort by createdAt desc (newest first)
        const results = request.result as MistakeItem[];
        results.sort((a, b) => b.createdAt - a.createdAt);
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  },

  // Add a new mistake
  addMistake: async (item: MistakeItem): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  // Update an existing mistake
  updateMistake: async (item: MistakeItem): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  // Import multiple mistakes (Merge strategy: Overwrite if exists, add if new)
  importData: async (items: MistakeItem[]): Promise<void> => {
    if (!items || items.length === 0) return;
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        let processedCount = 0;
        let errorCount = 0;

        transaction.oncomplete = () => {
            console.log(`Import completed. Processed: ${processedCount}, Errors: ${errorCount}`);
            resolve();
        };

        transaction.onerror = () => {
             reject(transaction.error);
        };

        items.forEach(item => {
            // Basic validation
            if(item.id && item.questionText) {
                store.put(item);
                processedCount++;
            } else {
                errorCount++;
            }
        });
    });
  },

  // Delete a mistake
  deleteMistake: async (id: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },
  
  // Clear all data (for testing or reset)
  clearAll: async (): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
};