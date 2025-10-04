import { doc, setDoc, updateDoc, onSnapshot, arrayUnion, arrayRemove, deleteDoc, getDoc, deleteField } from "firebase/firestore";
import { db } from '../firebaseConfig.ts';
import { GroupChat, Message, Partner, UserProfileData, TeachMeCache } from '../types.ts';
import * as geminiService from './geminiService';
import { deleteAudioMessage } from './storageService.ts';

const GROUPS_COLLECTION = 'groupChats';

// 1. Creates the initial group document in Firestore and sets the user's activeGroupId
export const createGroupInFirestore = async (
    groupId: string, 
    creatorId: string, 
    shareLink: string, 
    partner: Partner, 
    initialMessage: Message
): Promise<void> => {
    const groupRef = doc(db, GROUPS_COLLECTION, groupId);
    const userRef = doc(db, "customers", creatorId);

    const newGroup: GroupChat = {
        id: groupId,
        creatorId,
        partner,
        topic: null,
        shareLink,
        members: { [creatorId]: true }, 
        messages: [{...initialMessage, timestamp: Date.now()}], // Add timestamp here
    };

    // FIX: Ensure the group document is created first.
    await setDoc(groupRef, newGroup); 
    // Now update the user's activeGroupId (this triggers the main App's listener)
    await updateDoc(userRef, { activeGroupId: groupId }); 
};

// 2. Starts a listener to sync the group state in real-time
export const subscribeToGroup = (
    groupId: string,
    callback: (group: GroupChat | null) => void
): (() => void) => {
    const groupRef = doc(db, GROUPS_COLLECTION, groupId);
    
    // Returns the unsubscribe function
    return onSnapshot(groupRef, (docSnap) => {
        if (docSnap.exists()) {
            callback(docSnap.data() as GroupChat);
        } else {
            // Group chat was deleted or does not exist
            callback(null);
        }
    });
};

// 3. Adds a new message to the group chat array
export const addMessageToGroup = async (groupId: string, message: Message): Promise<void> => {
    const groupRef = doc(db, GROUPS_COLLECTION, groupId);
    await updateDoc(groupRef, {
        messages: arrayUnion(message)
    });
};

// 4. Updates the group's learning topic
export const updateGroupTopic = async (groupId: string, topic: string): Promise<void> => {
    const groupRef = doc(db, GROUPS_COLLECTION, groupId);
    await updateDoc(groupRef, { topic });
};

// 5. Handles user joining (adds them to the members map)
export const joinGroup = async (groupId: string, userId: string): Promise<void> => {
    const groupRef = doc(db, GROUPS_COLLECTION, groupId);
    const userRef = doc(db, "customers", userId);
    
    // Atomically update the members map and set the user's activeGroupId
    await updateDoc(groupRef, {
        [`members.${userId}`]: true
    });
    await updateDoc(userRef, { activeGroupId: groupId });
};

// 6. Handles user leaving. If the creator leaves, the group is deleted.
export const leaveGroup = async (groupId: string, userId: string): Promise<void> => {
    const groupRef = doc(db, GROUPS_COLLECTION, groupId);
    const userRef = doc(db, "customers", userId);
    
    // Always clear the user's activeGroupId first.
    await updateDoc(userRef, { activeGroupId: null });

    const groupSnap = await getDoc(groupRef); 
    
    if (groupSnap.exists()) {
        const groupData = groupSnap.data() as GroupChat;
        // If the user leaving is the creator, delete the whole group.
        if (groupData.creatorId === userId) {
            
            // --- NEW AUDIO CLEANUP LOGIC ---
            const audioUrlsToDelete = groupData.messages
                .map(m => m.audioUrl)
                .filter((url: string | undefined): url is string => !!url); // Filter out undefined/null
            
            const deletePromises = audioUrlsToDelete.map(url => deleteAudioMessage(url));
            await Promise.all(deletePromises);
            // --- END NEW AUDIO CLEANUP LOGIC ---

            await deleteDoc(groupRef);
        } else {
            // Otherwise, just remove the user from the members map.
            await updateDoc(groupRef, {
                [`members.${userId}`]: deleteField()
            });
        }
    }
};

// 7. Gets a real AI response for the group chat
export const getGroupBotResponse = async (
    messages: Message[],
    partner: Partner,
    userProfile: UserProfileData,
    correctionsEnabled: boolean,
    teachMeCache: TeachMeCache | null
): Promise<Message> => {
    const lastUserMessage = messages.findLast(m => m.sender === 'user');
    
    if (lastUserMessage) {
        try {
            // This now calls the actual Gemini service for a real response
            const aiResponse = await geminiService.getChatResponse(messages, partner, correctionsEnabled, userProfile, teachMeCache, true);
            return aiResponse;
        } catch (error) {
            console.error("Error getting group bot response:", error);
            return { sender: 'ai', text: "Sorry, I'm having trouble connecting right now." };
        }
    }
    // Default message if there's no user message to respond to
    return { sender: 'ai', text: 'Group chat initialized.' };
};

// Fetches a single group document by its ID.
export const getGroupById = async (groupId: string): Promise<GroupChat | null> => {
    const groupRef = doc(db, GROUPS_COLLECTION, groupId);
    const docSnap = await getDoc(groupRef);
    if (docSnap.exists()) {
        return docSnap.data() as GroupChat;
    }
    return null;
};