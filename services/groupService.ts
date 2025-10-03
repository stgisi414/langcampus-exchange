import { doc, setDoc, updateDoc, onSnapshot, arrayUnion, arrayRemove, deleteDoc, getDoc } from "firebase/firestore"; 
import { db } from '../firebaseConfig.ts';
import { GroupChat, Message, Partner } from '../types.ts';

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
        members: [creatorId],
        messages: [initialMessage],
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

// 5. Handles user joining (adds them to the members array)
export const joinGroup = async (groupId: string, userId: string): Promise<void> => {
    const groupRef = doc(db, GROUPS_COLLECTION, groupId);
    const userRef = doc(db, "customers", userId);
    
    // Atomically update the members array and set the user's activeGroupId
    await updateDoc(groupRef, {
        members: arrayUnion(userId)
    });
    await updateDoc(userRef, { activeGroupId: groupId });
};

// 6. Handles user leaving (removes them from the members array and clears activeGroupId)
export const leaveGroup = async (groupId: string, userId: string): Promise<void> => {
    const groupRef = doc(db, GROUPS_COLLECTION, groupId);
    const userRef = doc(db, "customers", userId);
    
    // 1. Remove the user from the group members array
    await updateDoc(groupRef, {
        members: arrayRemove(userId)
    });
    // 2. Clear the user's activeGroupId
    await updateDoc(userRef, { activeGroupId: null });

    // CRITICAL FIX: Check if the group is now empty and delete it.
    // Re-read the document to check the new members list size.
    const groupSnap = await getDoc(groupRef); 
    
    if (groupSnap.exists()) {
        const groupData = groupSnap.data() as GroupChat;
        if (groupData.members.length === 0) {
            // Group is empty, clean up the document.
            await deleteDoc(groupRef);
        }
    }
};

// 7. Simulates a bot response for the group chat (Placeholder)
export const getGroupBotResponse = (messages: Message[]): Message => {
    const lastUserMessage = messages.findLast(m => m.sender === 'user');
    
    if (lastUserMessage) {
        // This is a placeholder for a real AI call (geminiService.getChatResponse)
        const responseText = `(Bot echo): I see that ${lastUserMessage.text} was just sent to the group.`;
        return {
            sender: 'ai',
            text: responseText,
        };
    }
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