import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { app } from '../firebaseConfig';

const storage = getStorage(app);

const getExtensionFromMimeType = (mimeType: string): string => {
    switch (mimeType) {
        case 'audio/webm':
            return 'webm';
        case 'audio/mp4':
            return 'mp4';
        case 'audio/wav':
            return 'wav';
        default:
            const parts = mimeType.split('/');
            return parts[parts.length - 1] || 'bin';
    }
};

export const uploadAudioMessage = async (audioBlob: Blob, identifier: string, userId: string): Promise<string> => {
    const extension = getExtensionFromMimeType(audioBlob.type);
    
    const timestamp = Date.now();
    const fileName = `${identifier}/${userId}_${timestamp}.${extension}`;
    
    const audioRef = ref(storage, `audio_messages/${fileName}`);
    
    const snapshot = await uploadBytes(audioRef, audioBlob, {
        contentType: audioBlob.type,
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