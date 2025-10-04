// stgisi414/langcampus-exchange/langcampus-exchange-d72c797a2a7bb28fccb9bc66a4ef358f7d981029/services/storageService.ts

import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { app } from '../firebaseConfig'; // Assuming storage uses the initialized app

// Initialize Firebase Storage
const storage = getStorage(app);

/**
 * Uploads a Blob (audio file) to Firebase Storage in a temporary location.
 * @param audioBlob The Blob object containing the audio data.
 * @param identifier A unique identifier (group ID or partner name) for the path.
 * @param userId The UID of the user who sent the message.
 * @returns The public URL of the uploaded audio file.
 */
export const uploadAudioMessage = async (audioBlob: Blob, identifier: string, userId: string): Promise<string> => {
    // Generate a unique file name
    const timestamp = Date.now();
    const fileName = `${identifier}/${userId}_${timestamp}.webm`; 
    
    // Create a reference to the storage location
    const audioRef = ref(storage, `audio_messages/${fileName}`);
    
    // Upload the file. We set max-age=86400 (1 day) on the client, and a rule in Firebase 
    // Storage Security Rules or a Cloud Function will handle permanent cleanup.
    const snapshot = await uploadBytes(audioRef, audioBlob, {
        contentType: audioBlob.type,
        cacheControl: 'public, max-age=86400', // 1 day cache
    });

    // Get the public download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
};

/**
 * Deletes an audio file from Firebase Storage using its full URL.
 * @param audioUrl The public URL of the uploaded audio file.
 */
export const deleteAudioMessage = async (audioUrl: string): Promise<void> => {
    try {
        const fileRef = ref(storage, audioUrl);
        await deleteObject(fileRef);
    } catch (error) {
        // Log the error but don't re-throw. We want the chat deletion to succeed
        // even if the file is already gone or there's a permission error.
        console.warn("Error deleting audio file from Storage:", audioUrl, error);
    }
};