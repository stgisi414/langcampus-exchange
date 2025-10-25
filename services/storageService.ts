import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { app } from '../firebaseConfig';

const storage = getStorage(app);

const getExtensionFromMimeType = (mimeType: string): string => {
    // --- FIX: Handle potential parameters in mimeType ---
    const baseMimeType = mimeType.split(';')[0]; // Get 'audio/webm' from 'audio/webm;codecs=opus'
    // --- END FIX ---
    switch (baseMimeType) { // Use baseMimeType
        case 'audio/webm':
            return 'webm';
        case 'audio/mp4':
        case 'audio/aac': // Add AAC as mp4 is often just a container
        case 'audio/x-m4a': // Add m4a for iOS/Safari
            return 'mp4'; // Keep mp4 extension for simplicity or use 'm4a'
        case 'audio/wav':
        case 'audio/wave': // Add wave variations
        case 'audio/x-wav':
            return 'wav';
        case 'audio/ogg': // Add OGG support
            return 'ogg';
        default:
            const parts = baseMimeType.split('/');
            return parts[parts.length - 1] || 'bin';
    }
};

export const uploadAudioMessage = async (audioBlob: Blob, identifier: string, userId: string): Promise<string> => {
    const extension = getExtensionFromMimeType(audioBlob.type);

    const timestamp = Date.now();
    // The rule expects /audio_messages/{userId}/{fileName}
    // 'identifier' (partner name or group ID) should be part of the fileName if needed, not a folder level.
    const fileName = `${identifier}_${userId}_${timestamp}.${extension}`;
    const storagePath = `audio_messages/${userId}/${fileName}`; // Use userId as the folder

    const audioRef = ref(storage, storagePath);

    const snapshot = await uploadBytes(audioRef, audioBlob, {
        contentType: audioBlob.type, // Send the original full mimeType here
        cacheControl: 'public, max-age=86400',
    });

    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
};

export const deleteAudioMessage = async (audioUrl: string): Promise<void> => {
    try {
        const fileRef = ref(storage, audioUrl);
        await deleteObject(fileRef);
    } catch (error) {
        console.warn("Error deleting audio file from Storage:", audioUrl, error);
    }
};