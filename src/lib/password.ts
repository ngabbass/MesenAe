/**
 * Utility functions for password hashing using Web Crypto API.
 * This avoids external dependencies like bcrypt which can cause issues in browser/Vite builds.
 */

import { hashSync, compareSync } from 'bcrypt-ts';

/**
 * Hashes a password and returns a standard bcrypt hash ($2a$10$...)
 */
export const hashPassword = async (password: string): Promise<string> => {
  return hashSync(password, 10);
};

/**
 * Verifies a password against a stored hash.
 * Supports standard bcrypt hashes.
 */
export const verifyPassword = async (password: string, storedHash: string): Promise<boolean> => {
  if (!storedHash) return false;

  // Cek apakah ini hash bcrypt asli (diawali dengan $2a$, $2b$, atau $2y$)
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
    return compareSync(password, storedHash);
  }

  // Jika hash menggunakan sha256 (fallback versi sebelumnya)
  if (storedHash.startsWith('sha256:')) {
    // Kita buat dummy false karena hashSync tidak bisa mencocokkan SHA.
    // Jika Anda ingin mendukung login user lama yang sudah terlanjur sha256,
    // Anda bisa mengizinkannya di sini. Untuk sekarang kita pastikan password
    // sama persis atau false.
    const parts = storedHash.split(':');
    if (parts.length === 3) {
      const [, salt, hash] = parts;
      const encoder = new TextEncoder();
      const data = encoder.encode(`${password}${salt}`);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex === hash;
    }
  }

  // Fallback to plain text match (e.g. untuk setup awal admin123)
  return password === storedHash;
};
