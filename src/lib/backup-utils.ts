import { collection, getDocs, setDoc, doc } from 'firebase/firestore';
import { db as firestoreDb } from './firebase';

const COLLECTIONS = [
  'store_settings', 'categories', 'products', 'vouchers',
  'transactions', 'transaction_items', 'suppliers',
  'stock_ins', 'stock_outs', 'hpp_history', 'payment_methods', 'users'
];

export async function exportAllDataToJSON(): Promise<Blob | null> {
  try {
    const backupData: Record<string, any[]> = {};
    for (const colName of COLLECTIONS) {
      const colRef = collection(firestoreDb, colName);
      const snapshot = await getDocs(colRef);
      backupData[colName] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    const backupBlob = new Blob([JSON.stringify({
      version: '1.0',
      timestamp: new Date().toISOString(),
      data: backupData
    })], { type: 'application/json' });

    return backupBlob;
  } catch (error) {
    console.error('Error exporting data:', error);
    return null;
  }
}

export async function importAllDataFromJSON(file: File): Promise<{ success: boolean; imported: number }> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    
    if (!parsed.data) {
        throw new Error('Invalid backup format');
    }

    let importedCount = 0;
    
    for (const colName of COLLECTIONS) {
      if (parsed.data[colName]) {
        for (const item of parsed.data[colName]) {
            const docRef = doc(firestoreDb, colName, item.id);
            await setDoc(docRef, item, { merge: true });
            importedCount++;
        }
      }
    }
    
    return { success: true, imported: importedCount };
  } catch (error) {
    console.error('Error importing data:', error);
    return { success: false, imported: 0 };
  }
}
