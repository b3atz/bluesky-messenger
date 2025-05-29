// types.ts
export interface EncryptedData {
  iv: string;
  content: string;
  tag: string;
}
